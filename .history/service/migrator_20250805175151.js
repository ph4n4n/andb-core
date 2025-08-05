const path = require('path');
const util = require('util');
const mysql = require('mysql2');

const {
  STATUSES: { NEW, UPDATED, DEPRECATED, OTE },
  DDL: { TABLES, PROCEDURES, FUNCTIONS, TRIGGERS }
} = require('../configs/constants');

// Remove direct import of file helper
// const {
//   readFromFile, saveToFile, copyFile, makeSureFolderExisted, removeFile
// } = require('../utils/file.helper');
// YYYY_MM_DD
const _backupFolder = `backup/${new Date().getFullYear()}_${new Date().getMonth() + 1}_${new Date().getDate()}`


/**
 * Migrator function that migrates DDL from one environment to another
 * 
 * @param {Object} dependencies - The dependencies object containing database functions
 * @param {Function} dependencies.getSourceEnv - Function to get source environment
 * @param {Function} dependencies.getDBName - Function to get database name
 * @param {Function} dependencies.getDBDestination - Function to get database destination config
 * @param {Function} dependencies.replaceWithEnv - Function to replace environment in SQL
 * @returns {Function} - A function that takes DDL type and status, returns function for environment
 */
module.exports = class MigratorService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }
  }

  /**
   * This function migrates functions from one database to another.
   * 
   * @param {object} destConnection - The destination database connection.
   * @param {object} dbConfig - The database configuration.
   * @param {string} fromList - The list of functions to migrate.
   * @returns {number} - The number of functions migrated.
   */
  async migrateFunctions(destConnection, dbConfig, fromList = NEW) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${FUNCTIONS}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${FUNCTIONS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const fnFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
      const fnList = `${fromList}.list`;
      const functionNames = this.fileManager.readFromFile(fnFolder, fnList, 1)

      // Check if there are functions to migrate
      if (!functionNames.length) {
        alog.dev(`No FUNCTION to migrate to ${dbConfig.envName}`);
        return 0;
      }
      if (+process.env.EXPERIMENTAL < 1) {
        // Start a transaction
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const functionName of functionNames) {
          const fileName = `${functionName}.sql`;
          const dropQuery = `DROP FUNCTION IF EXISTS \`${functionName}\`;`;
          const importQuery = this.fileManager.readFromFile(srcFolder, fileName);
          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            alog.warn('Dropped...', functionName);

            if (this.isNotMigrateCondition(functionName)) {
              continue;
            }
            await util.promisify(destConnection.query).call(destConnection, importQuery);
            alog.info('Created...', functionName, '\n');
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        // clean after migrated done
        this.fileManager.saveToFile(fnFolder, fnList, '');
        if (+process.env.EXPERIMENTAL < 1) {
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return functionNames?.length;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading functions-migrate.list: ', err);
      return 0;
    }
  }
  // DON'T migrate OTE_,test normally
  isNotMigrateCondition(functionName) {
    return functionName
      .toLowerCase()
      .indexOf('test') > -1
      || functionName
        .indexOf('OTE_') > -1;
  }

  /**
   * Migrates procedures from one database to another.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {*} fromList The list of procedures to migrate. 
   * @returns The number of procedures migrated. 
   */
  async migrateProcedures(destConnection, dbConfig, fromList = NEW) {
    // Get the source environment and folders
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${PROCEDURES}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const spList = `${fromList}.list`;
      const procedureNames = this.fileManager.readFromFile(spFolder, spList, 1)
      // Check if there are procedures to migrate
      if (!procedureNames?.length) {
        alog.dev(`No PROCEDURE to migrate to ${dbConfig.envName}`);
        return 0;
      }
      // Start a transaction if experimental flag is not set
      if (+process.env.EXPERIMENTAL < 1) {
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        // Migrate each procedure
        for (const procedureName of procedureNames) {
          const fileName = `${procedureName}.sql`;
          const dropQuery = `DROP PROCEDURE IF EXISTS \`${procedureName}\`;`;
          const importQuery = this.fileManager.readFromFile(srcFolder, fileName);

          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Drop the procedure, import the new one, and create a backup
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            alog.warn('Dropped...', procedureName);
            if (this.isNotMigrateCondition(procedureName)) {
              continue;
            }

            await util.promisify(destConnection.query).call(destConnection, this.replaceWithEnv(importQuery, dbConfig.envName));
            alog.info('Created...', procedureName, '\n');
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        // Clean up the procedure list after migration
        this.fileManager.saveToFile(spFolder, spList, '');
        // Commit the transaction if all queries are successful
        if (+process.env.EXPERIMENTAL < 1) {
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return procedureNames?.length;
      } catch (err) {
        // Rollback the transaction in case of an error
        if (+process.env.EXPERIMENTAL < 1) {
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading procedures-migrate.list: ', err);
      return 0;
    }
  }
  // complete this function  like migrateProcedures and migrateFunctions
  async migrateTriggers(destConnection, dbConfig, fromList = NEW) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${TRIGGERS}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${TRIGGERS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const triggerFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
      const triggerList = `${fromList}.list`;
      const triggerNames = this.fileManager.readFromFile(triggerFolder, triggerList, 1);
      if (!triggerNames?.length) {
        alog.dev(`No TRIGGER to migrate to ${dbConfig.envName}`);
        return 0;
      }
      if (+process.env.EXPERIMENTAL < 1) {
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const triggerName of triggerNames) {
          const fileName = `${triggerName}.sql`;
          const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
          const importQuery = this.fileManager.readFromFile(srcFolder, fileName);
          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            alog.warn('Dropped...', triggerName);
            await util.promisify(destConnection.query).call(destConnection, this.replaceWithEnv(importQuery, dbConfig.envName));
            alog.info('Created...', triggerName, '\n');
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading triggers-migrate.list: ', err);
      return 0;
    }
  }

  /**
   * This function deprecate functions from destination db.
   * 
   * @param {object} destConnection - The destination database connection.
   * @param {object} dbConfig - The database configuration.
   * @returns {number} - The number of functions migrated.
   */
  async deprecateFunctions(destConnection, dbConfig, fnList = 'deprecated.list') {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    try {
      const fnFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
      const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${FUNCTIONS}`;
      const functionNames = this.fileManager.readFromFile(fnFolder, fnList, 1);
      if (!functionNames.length) {
        alog.dev(`No FUNCTION to deprecated to ${dbConfig.envName}`);
        return 0;
      }
      if (+process.env.EXPERIMENTAL < 1) {
        // Start a transaction
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const functionName of functionNames) {
          const dropQuery = `DROP FUNCTION IF EXISTS \`${functionName}\`;`;
          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { dropQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            alog.warn('Dropped...', functionName);
            // soft delete
            this.fileManager.removeFile(destFolder, `${functionName}.sql`);
          }
        }
        if (+process.env.EXPERIMENTAL < 1) {
          // clean after migrated done
          this.fileManager.saveToFile(fnFolder, fnList, '');
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return functionNames?.length;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading functions-migrate.list: ', err);
      return 0;
    }
  }

  /**
   * removed deprecated procedures from destination db.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @returns The number of procedures migrated. 
   */
  async deprecateProcedures(destConnection, dbConfig, spList = 'deprecated.list') {
    // Get the source environment and folders
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${PROCEDURES}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
      const procedureNames = this.fileManager.readFromFile(spFolder, spList, 1);
      // Check if there are procedures to migrate
      if (!procedureNames?.length) {
        alog.dev(`No PROCEDURE to deprecated to ${dbConfig.envName}`);
        return 0;
      }
      // Start a transaction if experimental flag is not set
      if (+process.env.EXPERIMENTAL < 1) {
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        // Migrate each procedure
        for (const procedureName of procedureNames) {
          const dropQuery = `DROP PROCEDURE IF EXISTS \`${procedureName}\`;`;

          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { dropQuery });
          } else {
            // Drop the procedure, import the new one, and create a backup
            alog.warn('Dropped...', procedureName);
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            // soft delete
            this.fileManager.removeFile(destFolder, `${procedureName}.sql`);
          }
        }
        // Commit the transaction if all queries are successful
        if (+process.env.EXPERIMENTAL < 1) {
          // Clean up the procedure list after migration
          this.fileManager.saveToFile(spFolder, spList, '');
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return procedureNames?.length;
      } catch (err) {
        // Rollback the transaction in case of an error
        if (+process.env.EXPERIMENTAL < 1) {
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading procedures-migrate.list: ', err);
      return 0;
    }
  }
  /**
   * Remove deprecated triggers from destination db.
   * @param {*} destConnection 
   * @param {*} dbConfig 
   * @param {*} triggerList 
   * @returns 
   */
  async deprecateTriggers(destConnection, dbConfig, triggerList = 'deprecated.list') {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const triggerFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
    const triggerNames = this.fileManager.readFromFile(triggerFolder, triggerList, 1);
    if (!triggerNames?.length) {
      alog.dev(`No TRIGGER to deprecated to ${dbConfig.envName}`);
      return 0;
    }
    if (+process.env.EXPERIMENTAL < 1) {
      await util.promisify(destConnection.beginTransaction).call(destConnection);
    }
    try {
      for (const triggerName of triggerNames) {
        const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
        if (+process.env.EXPERIMENTAL === 1) {
          alog.warn('Experimental Run::', { dropQuery });
        } else {
          await util.promisify(destConnection.query).call(destConnection, dropQuery);
          alog.warn('Dropped...', triggerName);
          // soft delete
          this.fileManager.removeFile(triggerFolder, `${triggerName}.sql`);
        }
      }
    } catch (err) {
      alog.error('Error reading triggers-migrate.list: ', err);
      return 0;
    }
  }


  async isTableExists(connection, tableName) {
    try {
      const rows = await util.promisify(connection.query)
        .call(connection, `SHOW TABLES LIKE ?`, [tableName]);
      return rows?.length > 0;
    } catch (err) {
      alog.error(`Error checking if table ${tableName} exists:`, err);
      return false;
    }
  }

  async migrateTables(destConnection, dbConfig) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TABLES}`;
    try {
      const tblFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TABLES}`
      const tblList = `${NEW}.list`;
      const tableNames = this.fileManager.readFromFile(tblFolder, tblList, 1);
      if (!tableNames?.length) {
        alog.dev(`No TABLE to migrate to ${dbConfig.envName}`);
        return 0;
      }
      let tablesMigrated = 0;
      if (+process.env.EXPERIMENTAL < 1) {
        // Start a transaction
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const tableName of tableNames) {
          if (tableName.indexOf('pt_') === 0) {
            continue;
          }
          const fileName = `${tableName}.sql`;

          if (await this.isTableExists(destConnection, tableName)) {
            alog.dev(`Table ${tableName} already exists in the destination database.`);
            continue;
          }

          const importQuery = this.fileManager.readFromFile(srcFolder, fileName);

          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('Experimental Run::', { importQuery });
          } else {
            console.log(importQuery);
            await util.promisify(destConnection.query).call(destConnection, importQuery);
            alog.info('Created...', tableName, '\n');
          }
          tablesMigrated++;
        }
        // clean after migrated done
        this.fileManager.saveToFile(tblFolder, tblList, '');
        if (+process.env.EXPERIMENTAL < 1) {
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return tablesMigrated;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
          alog.error(`Error during table migration:`, err);
        }
        return 0;
      }
    } catch (err) {
      alog.error('Error reading tables-migrate.list:', err);
      return 0;
    }
  }

  async alterTableColumns(destConnection, dbConfig, alterType = 'columns') {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const tableMap = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/tables`;
    try {
      const tableNames = this.fileManager.readFromFile(tableMap, `alter-${alterType}.list`, 1);

      if (!tableNames?.length) {
        alog.dev(`No TABLE to alter for ${dbConfig.envName}`);
        return 0;
      }
      let tablesAltered = 0;

      if (+process.env.EXPERIMENTAL < 1) {
        // Start a transaction
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const tableName of tableNames) {
          if (!(await this.isTableExists(destConnection, tableName))) {
            alog.dev(`Table ${tableName} does not exist in the destination database.`);
            continue;
          }
          const alterQuery = this.fileManager.readFromFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
          if (+process.env.EXPERIMENTAL === 1) {
            alog.warn('::Experimental Run::', { alterQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, alterQuery);
            alog.info('Updated...', alterQuery);
            this.fileManager.removeFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
          }
          tablesAltered++;
        }
        this.fileManager.saveToFile(tableMap, `alter-${alterType}.list`, '');

        if (+process.env.EXPERIMENTAL < 1) {
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return tablesAltered;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        alog.error(`Error during table alteration:`, err);
        return 0;
      }
    } catch (err) {
      alog.error('Error reading tables/alters.list:', err);
      return 0;
    }
  }

  async seedDataToTables(sourceConnection, destConnection, dbConfig) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    try {
      const tblFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TABLES}`
      const tblList = `seeding.list`;
      const tableNames = this.fileManager.readFromFile(tblFolder, tblList, 1);


      if (!tableNames?.length) {
        alog.dev(`No TABLE to seed to ${dbConfig.envName}`);
        return 0;
      }
      let tablesSeeded = 0;
      for (const tableName of tableNames) {
        // check if table exists in destination db
        if (!(await this.isTableExists(destConnection, tableName))) {
          alog.info(`Table ${tableName} does not exist in the destination database.`);
          continue;
        }
        // check if table exists in source db
        if (!(await this.isTableExists(sourceConnection, tableName))) {
          alog.info(`Table ${tableName} does not exist in the source database.`);
          continue;
        }

        // Get all data from table via select from dest db
        const selectQuery = `SELECT * FROM ${tableName}`;
        const destData = await util.promisify(destConnection.query)
          .call(destConnection, selectQuery);

        // check is dest data empty
        if (destData.length) {
          alog.info(`Table ${tableName} already seeded in the destination database.`);
          continue;
        }

        // Get all data from table via select from source db
        const sourceQuery = `SELECT * FROM ${tableName}`;
        const sourceData = await util.promisify(sourceConnection.query).call(sourceConnection, sourceQuery);

        // list all columns of table
        const columns = await util.promisify(sourceConnection.query).call(sourceConnection, `SHOW COLUMNS FROM ${tableName}`);
        // create insert query from list fields of table without id
        const insertFields = columns
          .filter(column => column.Field !== 'id')
          .map(column => column.Field)
          .join(',');
        // loop data and insert into destination db and make sure same field name
        const values = sourceData.map(row => columns
          .filter(column => column.Field !== 'id')
          .map(column =>
            // check if field is string then add quote and handle json value
            typeof row[column.Field] === 'string'
              ? `'${JSON.stringify(row[column.Field])}'`
              : row[column.Field]
          )
        );

        try {
          if (+process.env.EXPERIMENTAL < 1) {
            // Start a transaction
            await util.promisify(destConnection.beginTransaction).call(destConnection);
          }
          for (let row of values) {
            const insertQuery = `INSERT INTO ${tableName} (${insertFields}) VALUES (${row.join(',')})`;
            if (+process.env.EXPERIMENTAL === 1) {
              alog.warn('Experimental Run::', { insertQuery });
            } else {
              alog.info('Seeding...', insertQuery);
              await util.promisify(destConnection.query).call(destConnection, insertQuery);
            }
          };
          if (+process.env.EXPERIMENTAL < 1) {
            // Commit the transaction if all queries are successful
            await util.promisify(destConnection.commit).call(destConnection);
          }
        } catch (err) {
          if (+process.env.EXPERIMENTAL < 1) {
            // Rollback the transaction in case of an error
            await util.promisify(destConnection.rollback).call(destConnection);
          }
          alog.error(`Error during seeding data:`, err);
        }
        tablesSeeded++;
      }

      return tablesSeeded;
    } catch (err) {
      alog.error('Error reading tables-migrate.list:', err);
      return 0;
    }
  }


  migrate(ddl, fromList) {
    return (env) => {
      alog.warn(`Start migrating ${fromList} ${ddl} changes for...`, env);
      const start = Date.now();
      const dbConfig = this.getDBDestination(env);
      const destConnection = mysql.createConnection({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port
      });
      destConnection.connect(err => {
        if (err) {
          alog.error('Error connecting to the database: ', err);
          process.exit(1);
        }
        (async () => {
          let rs = 0;
          let alterRs = 0;
          switch (ddl) {
            case FUNCTIONS:
              if (fromList === DEPRECATED) {
                rs = await this.deprecateFunctions(destConnection, dbConfig);
              } else if (fromList === OTE) {
                rs = await this.deprecateFunctions(destConnection, dbConfig, 'OTE.list');
              } else {
                rs = await this.migrateFunctions(destConnection, dbConfig, fromList);
              }
              break;
            case PROCEDURES:
              if (fromList === DEPRECATED) {
                rs = await this.deprecateProcedures(destConnection, dbConfig);
              } else if (fromList === OTE) {
                rs = await this.deprecateProcedures(destConnection, dbConfig, 'OTE.list');
              } else {
                rs = await this.migrateProcedures(destConnection, dbConfig, fromList);
              }
              break;
            case TABLES:
              if (fromList === NEW) {
                rs = await this.migrateTables(destConnection, dbConfig);
              } else if (fromList === UPDATED) {
                alterRs = await this.alterTableColumns(destConnection, dbConfig);
                alterRs += await this.alterTableColumns(destConnection, dbConfig, 'indexes');
              }
              alog.dev(`Alter ${alterRs} ${env}.${this.getDBName(env)}.${ddl} done in:: ${Date.now() - start}ms`);
              break;
            case TRIGGERS:
              if (fromList === DEPRECATED) {
                rs = await this.deprecateTriggers(destConnection, dbConfig);
              } else {
                rs = await this.migrateTriggers(destConnection, dbConfig, fromList);
              }
              break;
          }
          destConnection.end();
          alog.dev(`Migrate ${rs} ${env}.${this.getDBName(env)}.${ddl} done in:: ${Date.now() - start}ms`);
        })();
      });
    };
  }
}