/**
 * @anph/core Migrator Service - Database migration
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Service for migrating database structures
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */
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

    // Storage strategy (File/SQLite/Hybrid)
    this.storage = dependencies.storage || null;
  }

  /**
   * Read DDL content from storage or fallback to file
   * @param {string} env - Environment
   * @param {string} type - DDL type (TABLES, PROCEDURES, etc)
   * @param {string} name - DDL name
   * @returns {Promise<string>} DDL content
   */
  async readDDL(env, type, name) {
    // Use Storage Strategy (preferred)
    if (this.storage) {
      return await this.storage.getDDL(env, this.getDBName(env), type, name);
    }

    // Fallback: FileManager
    const folder = `db/${env}/${this.getDBName(env)}/${type}`;
    return this.fileManager.readFromFile(folder, `${name}.sql`);
  }

  /**
   * Read comparison list from storage or fallback to file
   * @param {string} srcEnv - Source environment
   * @param {string} destEnv - Destination environment
   * @param {string} type - DDL type
   * @param {string} listFile - List file name (e.g., 'new.list', 'updated.list')
   * @returns {Promise<Array<string>>} Array of DDL names
   */
  async readComparisonList(srcEnv, destEnv, type, listFile) {
    // Use Storage Strategy (preferred)
    if (this.storage) {
      const comparisons = await this.storage.getComparisons(srcEnv, destEnv, this.getDBName(srcEnv), type);
      const status = listFile.replace('.list', ''); // 'new.list' -> 'new'
      return comparisons
        .filter(c => c.status === status)
        .map(c => c.name);
    }

    // Fallback: FileManager
    const folder = `map-migrate/${srcEnv}-to-${destEnv}/${this.getDBName(srcEnv)}/${type}`;
    return this.fileManager.readFromFile(folder, listFile, 1);
  }

  /**
   * This function migrates functions from one database to another.
   * 
   * @param {object} destConnection - The destination database connection.
   * @param {object} dbConfig - The database configuration.
   * @param {string} fromList - The list of functions to migrate.
   * @returns {number} - The number of functions migrated.
   */
  async migrateFunctions(destConnection, dbConfig, fromList = NEW, functionName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${FUNCTIONS}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${FUNCTIONS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      // Use functionName if provided, otherwise read from storage or file
      const functionNames = functionName ? [functionName] : await this.readComparisonList(srcEnv, dbConfig.envName, FUNCTIONS, `${fromList}.list`);

      // Check if there are functions to migrate
      if (!functionNames.length) {
        if (!functionName) logger.dev(`No FUNCTION to migrate to ${dbConfig.envName}`);
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

          // Read function DDL from storage or file
          const importQuery = await this.readDDL(srcEnv, FUNCTIONS, functionName);

          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            logger.warn('Dropped...', functionName);

            if (this.isNotMigrateCondition(functionName)) {
              continue;
            }
            await util.promisify(destConnection.query).call(destConnection, importQuery);
            logger.info('Created...', functionName, '\n');

            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: FUNCTIONS,
                name: functionName,
                operation: fromList === DEPRECATED ? 'DROP' : 'CREATE',
                status: 'SUCCESS'
              });
            }
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        // clean after migrated done (only for file-based storage and not single migration)
        if (!this.storage && !functionName) {
          const fnFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
          const fnList = `${fromList}.list`;
          this.fileManager.saveToFile(fnFolder, fnList, '');
        }
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
        logger.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading functions-migrate.list: ', err);
      return 0;
    }
  }
  // DON'T migrate OTE_,test normally
  isNotMigrateCondition(functionName, notAllowOTE = true) {
    return functionName
      .toLowerCase()
      .indexOf('test') > -1
      || (notAllowOTE && functionName.indexOf('OTE_') > -1);
  }

  /**
   * Migrates procedures from one database to another.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {*} fromList The list of procedures to migrate. 
   * @param {string} [name=null] - Specific procedure name to migrate. If provided, skips list file.
   * @returns The number of procedures migrated. 
   */
  async migrateProcedures(destConnection, dbConfig, fromList = NEW, procedureName = null) {
    // Get the source environment and folders
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${PROCEDURES}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const spList = `${fromList}.list`;
      const procedureNames = procedureName ? [procedureName] : await this.readComparisonList(srcEnv, dbConfig.envName, PROCEDURES, spList);

      // Check if there are procedures to migrate
      if (!procedureNames?.length) {
        if (!procedureName) logger.dev(`No PROCEDURE to migrate to ${dbConfig.envName}`);
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
          const importQuery = await this.readDDL(srcEnv, PROCEDURES, procedureName);

          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Drop the procedure, import the new one, and create a backup
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            logger.warn('Dropped...', procedureName);
            if (this.isNotMigrateCondition(procedureName)) {
              continue;
            }

            await util.promisify(destConnection.query).call(destConnection, this.replaceWithEnv(importQuery, dbConfig.envName));
            logger.info('Created...', procedureName, '\n');

            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: PROCEDURES,
                name: procedureName,
                operation: fromList === DEPRECATED ? 'DROP' : 'CREATE',
                status: 'SUCCESS'
              });
            }
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        // Clean up the procedure list after migration (only if not single migration)
        if (!procedureName) {
          this.fileManager.saveToFile(spFolder, spList, '');
        }
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
        logger.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading procedures-migrate.list: ', err);
      return 0;
    }
  }
  /**
   * Migrates triggers from one database to another.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {*} fromList The list of triggers to migrate. 
   * @param {string} [name=null] - Specific trigger name to migrate. If provided, skips list file.
   * @returns The number of triggers migrated. 
   */
  async migrateTriggers(destConnection, dbConfig, fromList = NEW, triggerName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${TRIGGERS}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${_backupFolder}/${TRIGGERS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const triggerFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
      const triggerList = `${fromList}.list`;
      const triggerNames = triggerName ? [triggerName] : await this.readComparisonList(srcEnv, dbConfig.envName, TRIGGERS, triggerList);
      if (!triggerNames?.length) {
        if (!triggerName) logger.dev(`No TRIGGER to migrate to ${dbConfig.envName}`);
        return 0;
      }
      if (+process.env.EXPERIMENTAL < 1) {
        await util.promisify(destConnection.beginTransaction).call(destConnection);
      }
      try {
        for (const triggerName of triggerNames) {
          const fileName = `${triggerName}.sql`;
          const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
          const importQuery = await this.readDDL(srcEnv, TRIGGERS, triggerName);
          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            logger.warn('Dropped...', triggerName);
            await util.promisify(destConnection.query).call(destConnection, this.replaceWithEnv(importQuery, dbConfig.envName));
            logger.info('Created...', triggerName, '\n');
            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: TRIGGERS,
                name: triggerName,
                operation: fromList === DEPRECATED ? 'DROP' : 'CREATE',
                status: 'SUCCESS'
              });
            }
            // copy to backup
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            // copy to soft migrate
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        // Clean up the trigger list after migration (only if not single migration)
        if (!triggerName) {
          this.fileManager.saveToFile(triggerFolder, triggerList, '');
        }
        if (+process.env.EXPERIMENTAL < 1) {
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return triggerNames?.length;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        logger.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading triggers-migrate.list: ', err);
      return 0;
    }
  }

  /**
   * This function deprecate functions from destination db.
   * 
   * @param {object} destConnection - The destination database connection.
   * @param {object} dbConfig - The database configuration.
   * @param {string} [fnList='deprecated.list'] - The list file name for deprecated functions.
   * @param {string} [name=null] - Specific function name to deprecate. If provided, skips list file.
   * @returns {number} - The number of functions migrated.
   */
  async deprecateFunctions(destConnection, dbConfig, fnList = 'deprecated.list', functionName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${FUNCTIONS}`;
    try {
      const fnFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
      const functionNames = functionName ? [functionName] : await this.readComparisonList(srcEnv, dbConfig.envName, FUNCTIONS, fnList);
      if (!functionNames.length) {
        if (!functionName) logger.dev(`No FUNCTION to deprecated to ${dbConfig.envName}`);
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
            logger.warn('Experimental Run::', { dropQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            logger.warn('Dropped...', functionName);
            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: FUNCTIONS,
                name: functionName,
                operation: 'DROP',
                status: 'SUCCESS'
              });
            }
            // soft delete
            this.fileManager.removeFile(destFolder, `${functionName}.sql`);
          }
        }
        if (+process.env.EXPERIMENTAL < 1) {
          // clean after migrated done (not for single migration)
          if (!functionName) {
            this.fileManager.saveToFile(fnFolder, fnList, '');
          }
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return functionNames?.length;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        logger.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading functions-migrate.list: ', err);
      return 0;
    }
  }

  /**
   * removed deprecated procedures from destination db.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {string} [spList='deprecated.list'] - The list file name for deprecated procedures.
   * @param {string} [name=null] - Specific procedure name to deprecate. If provided, skips list file.
   * @returns The number of procedures migrated. 
   */
  async deprecateProcedures(destConnection, dbConfig, spList = 'deprecated.list', procedureName = null) {
    // Get the source environment and folders
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
      const procedureNames = procedureName ? [procedureName] : await this.readComparisonList(srcEnv, dbConfig.envName, PROCEDURES, spList);
      // Check if there are procedures to migrate
      if (!procedureNames?.length) {
        if (!procedureName) logger.dev(`No PROCEDURE to deprecated to ${dbConfig.envName}`);
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
            logger.warn('Experimental Run::', { dropQuery });
          } else {
            // Drop the procedure, import the new one, and create a backup
            logger.warn('Dropped...', procedureName);
            await util.promisify(destConnection.query).call(destConnection, dropQuery);
            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: PROCEDURES,
                name: procedureName,
                operation: 'DROP',
                status: 'SUCCESS'
              });
            }
            // soft delete
            this.fileManager.removeFile(destFolder, `${procedureName}.sql`);
          }
        }
        // Commit the transaction if all queries are successful
        if (+process.env.EXPERIMENTAL < 1) {
          // Clean up the procedure list after migration (not for single migration)
          if (!procedureName) {
            this.fileManager.saveToFile(spFolder, spList, '');
          }
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return procedureNames?.length;
      } catch (err) {
        // Rollback the transaction in case of an error
        if (+process.env.EXPERIMENTAL < 1) {
          await util.promisify(destConnection.rollback).call(destConnection);
        }
        logger.error(`Error during migration: `, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading procedures-migrate.list: ', err);
      return 0;
    }
  }
  /**
   * Remove deprecated triggers from destination db.
   * @param {*} destConnection 
   * @param {*} dbConfig 
   * @param {string} [triggerList='deprecated.list'] - The list file name for deprecated triggers.
   * @param {string} [name=null] - Specific trigger name to deprecate. If provided, skips list file.
   * @returns 
   */
  async deprecateTriggers(destConnection, dbConfig, triggerList = 'deprecated.list', triggerName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${TRIGGERS}`;
    const triggerFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
    const triggerNames = triggerName ? [triggerName] : await this.readComparisonList(srcEnv, dbConfig.envName, TRIGGERS, triggerList);
    if (!triggerNames?.length) {
      if (!triggerName) logger.dev(`No TRIGGER to deprecated to ${dbConfig.envName}`);
      return 0;
    }
    if (+process.env.EXPERIMENTAL < 1) {
      await util.promisify(destConnection.beginTransaction).call(destConnection);
    }
    try {
      for (const triggerName of triggerNames) {
        const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
        if (+process.env.EXPERIMENTAL === 1) {
          logger.warn('Experimental Run::', { dropQuery });
        } else {
          await util.promisify(destConnection.query).call(destConnection, dropQuery);
          logger.warn('Dropped...', triggerName);
          // Log to storage
          if (this.storage) {
            await this.storage.saveMigration({
              srcEnv,
              destEnv: dbConfig.envName,
              database: this.getDBName(srcEnv),
              type: TRIGGERS,
              name: triggerName,
              operation: 'DROP',
              status: 'SUCCESS'
            });
          }
          // soft delete
          this.fileManager.removeFile(destFolder, `${triggerName}.sql`);
        }
      }
      // Clean up the trigger list after migration (only if not single migration)
      if (!triggerName) {
        this.fileManager.saveToFile(triggerFolder, triggerList, '');
      }
      if (+process.env.EXPERIMENTAL < 1) {
        // Commit the transaction if all queries are successful
        await util.promisify(destConnection.commit).call(destConnection);
      }
      return triggerNames?.length;
    } catch (err) {
      if (+process.env.EXPERIMENTAL < 1) {
        // Rollback the transaction in case of an error
        await util.promisify(destConnection.rollback).call(destConnection);
      }
      logger.error('Error reading triggers-migrate.list: ', err);
      return 0;
    }
  }


  async isTableExists(connection, tableName) {
    try {
      const rows = await util.promisify(connection.query)
        .call(connection, `SHOW TABLES LIKE ?`, [tableName]);
      return rows?.length > 0;
    } catch (err) {
      logger.error(`Error checking if table ${tableName} exists:`, err);
      return false;
    }
  }

  /**
   * Migrates tables from one database to another.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {string} [name=null] - Specific table name to migrate. If provided, skips list file.
   * @returns The number of tables migrated. 
   */
  async migrateTables(destConnection, dbConfig, tableName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TABLES}`;
    try {
      const tblFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TABLES}`
      const tblList = `${NEW}.list`;
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, tblList);
      if (!tableNames?.length) {
        if (!tableName) logger.dev(`No TABLE to migrate to ${dbConfig.envName}`);
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
            logger.dev(`Table ${tableName} already exists in the destination database.`);
            continue;
          }

          const importQuery = await this.readDDL(srcEnv, TABLES, tableName);

          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { importQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, importQuery);
            if (global.logger) global.logger.dev('Executing query:', importQuery);
            if (global.logger) global.logger.info('Created...', tableName, '\n');

            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: TABLES,
                name: tableName,
                operation: 'CREATE',
                status: 'SUCCESS'
              });
            }
          }
          tablesMigrated++;
        }
        // clean after migrated done (not for single migration)
        if (!tableName) {
          this.fileManager.saveToFile(tblFolder, tblList, '');
        }
        if (+process.env.EXPERIMENTAL < 1) {
          // Commit the transaction if all queries are successful
          await util.promisify(destConnection.commit).call(destConnection);
        }
        return tablesMigrated;
      } catch (err) {
        if (+process.env.EXPERIMENTAL < 1) {
          // Rollback the transaction in case of an error
          await util.promisify(destConnection.rollback).call(destConnection);
          logger.error(`Error during table migration:`, err);
        }
        return 0;
      }
    } catch (err) {
      logger.error('Error reading tables-migrate.list:', err);
      return 0;
    }
  }

  /**
   * Alters table columns or indexes.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {string} [alterType='columns'] - Type of alteration ('columns' or 'indexes').
   * @param {string} [name=null] - Specific table name to alter. If provided, skips list file.
   * @returns The number of tables altered. 
   */
  async alterTableColumns(destConnection, dbConfig, alterType = 'columns', tableName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const tableMap = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/tables`;
    try {
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, `alter-${alterType}.list`);

      if (!tableNames?.length) {
        if (!tableName) logger.dev(`No TABLE to alter for ${dbConfig.envName}`);
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
            logger.dev(`Table ${tableName} does not exist in the destination database.`);
            continue;
          }
          const alterQuery = this.fileManager.readFromFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('::Experimental Run::', { alterQuery });
          } else {
            await util.promisify(destConnection.query).call(destConnection, alterQuery);
            if (global.logger) global.logger.info('Updated...', alterQuery);

            // Log to storage
            if (this.storage) {
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: TABLES,
                name: tableName,
                operation: 'ALTER',
                status: 'SUCCESS'
              });
            }
            this.fileManager.removeFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
          }
          tablesAltered++;
        }
        if (!tableName) {
          this.fileManager.saveToFile(tableMap, `alter-${alterType}.list`, '');
        }

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
        logger.error(`Error during table alteration:`, err);
        return 0;
      }
    } catch (err) {
      logger.error('Error reading tables/alters.list:', err);
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
        logger.dev(`No TABLE to seed to ${dbConfig.envName}`);
        return 0;
      }
      let tablesSeeded = 0;
      for (const tableName of tableNames) {
        // check if table exists in destination db
        if (!(await this.isTableExists(destConnection, tableName))) {
          logger.info(`Table ${tableName} does not exist in the destination database.`);
          continue;
        }
        // check if table exists in source db
        if (!(await this.isTableExists(sourceConnection, tableName))) {
          logger.info(`Table ${tableName} does not exist in the source database.`);
          continue;
        }

        // Get all data from table via select from dest db
        const selectQuery = `SELECT * FROM ${tableName}`;
        const destData = await util.promisify(destConnection.query)
          .call(destConnection, selectQuery);

        // check is dest data empty
        if (destData.length) {
          logger.info(`Table ${tableName} already seeded in the destination database.`);
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
              logger.warn('Experimental Run::', { insertQuery });
            } else {
              logger.info('Seeding...', insertQuery);
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
          logger.error(`Error during seeding data:`, err);
        }
        tablesSeeded++;
      }

      return tablesSeeded;
    } catch (err) {
      logger.error('Error reading tables-migrate.list:', err);
      return 0;
    }
  }


  migrate(ddl, fromList, specificName = null) {
    return async (env) => {
      logger.warn(`Start migrating ${fromList} ${ddl} ${specificName ? specificName : 'changes'} for...`, env);
      const start = Date.now();
      const dbConfig = this.getDBDestination(env);
      const destConnection = mysql.createConnection({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port
      });

      const connect = util.promisify(destConnection.connect).bind(destConnection);
      const end = util.promisify(destConnection.end).bind(destConnection);

      try {
        await connect();

        let rs = 0;
        let alterRs = 0;

        switch (ddl) {
          case FUNCTIONS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateFunctions(destConnection, dbConfig, 'deprecated.list', specificName);
            } else if (fromList === OTE) {
              rs = await this.deprecateFunctions(destConnection, dbConfig, 'OTE.list', specificName);
            } else {
              rs = await this.migrateFunctions(destConnection, dbConfig, fromList, specificName);
            }
            break;
          case PROCEDURES:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateProcedures(destConnection, dbConfig, 'deprecated.list', specificName);
            } else if (fromList === OTE) {
              rs = await this.deprecateProcedures(destConnection, dbConfig, 'OTE.list', specificName);
            } else {
              rs = await this.migrateProcedures(destConnection, dbConfig, fromList, specificName);
            }
            break;
          case TABLES:
            if (fromList === NEW) {
              rs = await this.migrateTables(destConnection, dbConfig, specificName);
            } else if (fromList === UPDATED) {
              alterRs = await this.alterTableColumns(destConnection, dbConfig, 'columns', specificName);
              alterRs += await this.alterTableColumns(destConnection, dbConfig, 'indexes', specificName);
            }
            logger.dev(`Alter ${alterRs} ${env}.${this.getDBName(env)}.${ddl} done in:: ${Date.now() - start}ms`);
            break;
          case TRIGGERS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateTriggers(destConnection, dbConfig, 'deprecated.list', specificName);
            } else {
              rs = await this.migrateTriggers(destConnection, dbConfig, fromList, specificName);
            }
            break;
        }

        await end();
        logger.dev(`Migrate ${rs} ${env}.${this.getDBName(env)}.${ddl} done in:: ${Date.now() - start}ms`);
        return rs + alterRs;
      } catch (err) {
        if (global.logger) global.logger.error('Error during migration: ', err);
        try { destConnection.end(); } catch (e) { }
        throw err;
      }
    };
  }

  // Removed migrateSingleItem to rely on existing code with enhanced params
}