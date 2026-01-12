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
// Removed static _backupFolder constant to use dynamic method instead


const path = require('path');
const util = require('util');
const mysql = require('mysql2');

const {
  STATUSES: { NEW, UPDATED, DEPRECATED, OTE },
  DDL: { TABLES, PROCEDURES, FUNCTIONS, TRIGGERS, VIEWS }
} = require('../configs/constants');

// Remove direct import of file helper
// const {
//   readFromFile, saveToFile, copyFile, makeSureFolderExisted, removeFile
// } = require('../utils/file.helper');


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

    // DEBUG LOGS
    if (global.logger) {
      global.logger.info('[MigratorService] Initialized');
      global.logger.info(`[MigratorService] Storage available: ${!!this.storage}`);
      if (this.storage) {
        global.logger.info(`[MigratorService] Storage class: ${this.storage.constructor.name}`);
      }
    }

    // Custom skip condition logic
    this.isNotMigrateConditionConfig = dependencies.isNotMigrateCondition || null;
  }

  getBackupFolder() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `backup/${year}_${month}_${day}`;
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

    const folder = `db/${env}/${this.getDBName(env)}/${type}`;
    return this.fileManager.readFromFile(folder, `${name}.sql`);
  }

  /**
   * Fetch DDL live from database connection
   */
  async fetchDDLLive(connection, type, name) {
    try {
      let query = '';
      let field = '';

      switch (type.toLowerCase()) {
        case TABLES:
          query = `SHOW CREATE TABLE \`${name}\``;
          field = 'Create Table';
          break;
        case PROCEDURES:
          query = `SHOW CREATE PROCEDURE \`${name}\``;
          field = 'Create Procedure';
          break;
        case FUNCTIONS:
          query = `SHOW CREATE FUNCTION \`${name}\``;
          field = 'Create Function';
          break;
        case VIEWS:
          query = `SHOW CREATE VIEW \`${name}\``;
          field = 'Create View';
          break;
        case TRIGGERS:
          query = `SHOW CREATE TRIGGER \`${name}\``;
          field = 'SQL Original Statement';
          break;
        default:
          return null;
      }

      const promiseConn = connection.promise ? connection.promise() : connection;
      const [rows] = await promiseConn.query(query);
      if (rows && rows[0]) {
        let content = rows[0][field];
        // Special handling for triggers in some MySQL versions
        if (!content && type.toUpperCase() === TRIGGERS) {
          content = rows[0]['Create Trigger'];
        }
        return content;
      }
      return null;
    } catch (err) {
      if (global.logger) global.logger.dev(`[Migrator] Live fetch failed for ${type} ${name}: ${err.message}`);
      return null;
    }
  }

  /**
   * Save pre-migration snapshot to both File and Storage
   * @param {string} env - Destination environment
   * @param {string} type - DDL type
   * @param {string} name - DDL name
   * @param {object} [connection=null] - Optional connection to fetch live
   */
  async savePreMigrationSnapshot(env, type, name, connection = null) {
    const dbName = this.getDBName(env);

    // 1. Try Live Fetch (most accurate for pre-migration)
    let currentDDL = null;
    if (connection) {
      currentDDL = await this.fetchDDLLive(connection, type, name);
    }

    // 2. Fallback to Cache
    if (!currentDDL) {
      currentDDL = await this.readDDL(env, type, name);
    }

    if (!currentDDL) return;

    // 1. Save to File Backup
    const backupFolder = `db/${env}/${dbName}/${this.getBackupFolder()}/${type}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    this.fileManager.saveToFile(backupFolder, `${name}.sql`, currentDDL);

    // 2. Save to Storage Snapshot (SQLite)
    if (this.storage && this.storage.saveSnapshot) {
      await this.storage.saveSnapshot({
        environment: env,
        database: dbName,
        type,
        name,
        content: currentDDL,
        versionTag: `pre-migration-${this.getBackupFolder().split('/').pop()}`
      });
    }
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
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${this.getBackupFolder()}/${FUNCTIONS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);

    try {
      const functionNames = functionName ? [functionName] : await this.readComparisonList(srcEnv, dbConfig.envName, FUNCTIONS, `${fromList}.list`);

      if (!functionNames.length) {
        if (!functionName) logger.dev(`No FUNCTION to migrate to ${dbConfig.envName}`);
        return 0;
      }

      const promiseConn = destConnection.promise();

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
      }

      try {
        for (const functionName of functionNames) {
          const fileName = `${functionName}.sql`;
          const dropQuery = `DROP FUNCTION IF EXISTS \`${functionName}\`;`;
          const importQuery = await this.readDDL(srcEnv, FUNCTIONS, functionName);

          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, FUNCTIONS, functionName, promiseConn);

            await promiseConn.query(dropQuery);
            if (global.logger) global.logger.warn('Dropped...', functionName);

            if (this.isNotMigrateCondition(functionName)) {
              if (global.logger) global.logger.warn(`[SKIP] Migration policy excluded function: ${functionName}`);
              if (this.storage) {
                await this.storage.saveMigration({
                  srcEnv,
                  destEnv: dbConfig.envName,
                  database: this.getDBName(srcEnv),
                  type: FUNCTIONS,
                  name: functionName,
                  operation: 'SKIP',
                  status: 'SKIPPED',
                  error: 'Excluded by migration policy (OTE/Test)'
                });
              }
              continue;
            }
            await promiseConn.query(this.replaceWithEnv(importQuery, dbConfig.envName));
            if (global.logger) global.logger.info('Created...', functionName, '\n');

            if (this.storage) {
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: FUNCTIONS,
                name: functionName,
                content: this.replaceWithEnv(importQuery, dbConfig.envName)
              });
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
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }

        if (!this.storage && !functionName) {
          const fnFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${FUNCTIONS}`;
          const fnList = `${fromList}.list`;
          this.fileManager.saveToFile(fnFolder, fnList, '');
        }

        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.commit();
        }
        return functionNames.length;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during migration: `, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading functions: ', err);
      throw err;
    }
  }
  // DON'T migrate OTE_,test normally
  isNotMigrateCondition(functionName, notAllowOTE = true) {
    if (this.isNotMigrateConditionConfig) {
      // Logic defined in config/UI
      // Expecting a regex or a simple string check.
      // For now let's assume it could be a regex string or a function.
      // But passing functions via JSON/IPC is hard. Let's assume regex string.
      try {
        if (typeof this.isNotMigrateConditionConfig === 'function') {
          return this.isNotMigrateConditionConfig(functionName);
        }
        // If it's a regex string provided
        const regex = new RegExp(this.isNotMigrateConditionConfig, 'i');
        return regex.test(functionName);
      } catch (e) {
        // Fallback if invalid
      }
    }

    // Default fallback
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
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${this.getBackupFolder()}/${PROCEDURES}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const spList = `${fromList}.list`;
      const procedureNames = procedureName ? [procedureName] : await this.readComparisonList(srcEnv, dbConfig.envName, PROCEDURES, spList);

      if (!procedureNames?.length) {
        if (!procedureName) logger.dev(`No PROCEDURE to migrate to ${dbConfig.envName}`);
        return 0;
      }

      const promiseConn = destConnection.promise();

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
      }
      try {
        for (const procedureName of procedureNames) {
          const fileName = `${procedureName}.sql`;
          const dropQuery = `DROP PROCEDURE IF EXISTS \`${procedureName}\`;`;
          const importQuery = await this.readDDL(srcEnv, PROCEDURES, procedureName);

          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, PROCEDURES, procedureName, promiseConn);

            await promiseConn.query(dropQuery);
            if (global.logger) global.logger.warn('Dropped...', procedureName);
            if (this.isNotMigrateCondition(procedureName)) {
              if (global.logger) global.logger.warn(`[SKIP] Migration policy excluded procedure: ${procedureName}`);
              if (this.storage) {
                await this.storage.saveMigration({
                  srcEnv,
                  destEnv: dbConfig.envName,
                  database: this.getDBName(srcEnv),
                  type: PROCEDURES,
                  name: procedureName,
                  operation: 'SKIP',
                  status: 'SKIPPED',
                  error: 'Excluded by migration policy (OTE/Test)'
                });
              }
              continue;
            }

            await promiseConn.query(this.replaceWithEnv(importQuery, dbConfig.envName));
            if (global.logger) global.logger.info('Created...', procedureName, '\n');

            if (this.storage) {
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: PROCEDURES,
                name: procedureName,
                content: this.replaceWithEnv(importQuery, dbConfig.envName)
              });
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
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
        }
        if (!procedureName) {
          this.fileManager.saveToFile(spFolder, spList, '');
        }
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.commit();
        }
        return procedureNames?.length;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during migration: `, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading procedures: ', err);
      throw err;
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
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${this.getBackupFolder()}/${TRIGGERS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const triggerFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TRIGGERS}`;
      const triggerList = `${fromList}.list`;
      const triggerNames = triggerName ? [triggerName] : await this.readComparisonList(srcEnv, dbConfig.envName, TRIGGERS, triggerList);
      if (!triggerNames?.length) {
        if (!triggerName) logger.dev(`No TRIGGER to migrate to ${dbConfig.envName}`);
        return 0;
      }
      const promiseConn = destConnection.promise();
      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
      }
      try {
        for (const triggerName of triggerNames) {
          const fileName = `${triggerName}.sql`;
          const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
          const importQuery = await this.readDDL(srcEnv, TRIGGERS, triggerName);
          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, TRIGGERS, triggerName, promiseConn);

            await promiseConn.query(dropQuery);
            if (global.logger) global.logger.warn('Dropped...', triggerName);

            if (this.isNotMigrateCondition(triggerName)) {
              if (global.logger) global.logger.warn(`[SKIP] Migration policy excluded trigger: ${triggerName}`);
              if (this.storage) {
                await this.storage.saveMigration({
                  srcEnv,
                  destEnv: dbConfig.envName,
                  database: this.getDBName(srcEnv),
                  type: TRIGGERS,
                  name: triggerName,
                  operation: 'SKIP',
                  status: 'SKIPPED',
                  error: 'Excluded by migration policy (OTE/Test)'
                });
              }
              continue;
            }

            await promiseConn.query(this.replaceWithEnv(importQuery, dbConfig.envName));
            if (global.logger) global.logger.info('Created...', triggerName, '\n');
            if (this.storage) {
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: TRIGGERS,
                name: triggerName,
                content: this.replaceWithEnv(importQuery, dbConfig.envName)
              });
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
        if (!(process.env.EXPERIMENTAL >= 1)) {
          // Commit the transaction if all queries are successful
          await promiseConn.commit();
        }
        return triggerNames?.length;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          // Rollback the transaction in case of an error
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during migration: `, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading triggers-migrate.list: ', err);
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

      const promiseConn = destConnection.promise();

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
      }
      try {
        for (const functionName of functionNames) {
          const dropQuery = `DROP FUNCTION IF EXISTS \`${functionName}\`;`;
          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery });
          } else {
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, FUNCTIONS, functionName, promiseConn);

            await promiseConn.query(dropQuery);
            logger.warn('Dropped...', functionName);
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
            this.fileManager.removeFile(destFolder, `${functionName}.sql`);
          }
        }
        if (!(process.env.EXPERIMENTAL >= 1)) {
          if (!functionName) {
            this.fileManager.saveToFile(fnFolder, fnList, '');
          }
          await promiseConn.commit();
        }
        return functionNames?.length;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during migration: `, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading functions: ', err);
      throw err;
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
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${PROCEDURES}`;
    try {
      const spFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${PROCEDURES}`;
      const procedureNames = procedureName ? [procedureName] : await this.readComparisonList(srcEnv, dbConfig.envName, PROCEDURES, spList);

      if (!procedureNames?.length) {
        if (!procedureName) logger.dev(`No PROCEDURE to deprecated to ${dbConfig.envName}`);
        return 0;
      }

      const promiseConn = destConnection.promise();

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
      }
      try {
        for (const procedureName of procedureNames) {
          const dropQuery = `DROP PROCEDURE IF EXISTS \`${procedureName}\`;`;

          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('Experimental Run::', { dropQuery });
          } else {
            logger.warn('Dropped...', procedureName);
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, PROCEDURES, procedureName, promiseConn);

            await promiseConn.query(dropQuery);
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
            this.fileManager.removeFile(destFolder, `${procedureName}.sql`);
          }
        }
        if (!(process.env.EXPERIMENTAL >= 1)) {
          if (!procedureName) {
            this.fileManager.saveToFile(spFolder, spList, '');
          }
          await promiseConn.commit();
        }
        return procedureNames?.length;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during migration: `, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading procedures: ', err);
      throw err;
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
    if (!(process.env.EXPERIMENTAL >= 1)) {
      await util.promisify(destConnection.beginTransaction).call(destConnection);
    }
    try {
      const promiseConn = destConnection.promise ? destConnection.promise() : destConnection;
      for (const triggerName of triggerNames) {
        const dropQuery = `DROP TRIGGER IF EXISTS \`${triggerName}\`;`;
        if (+process.env.EXPERIMENTAL === 1) {
          if (global.logger) global.logger.warn('Experimental Run::', { dropQuery });
        } else {
          // Save snapshot before dropping
          await this.savePreMigrationSnapshot(dbConfig.envName, TRIGGERS, triggerName, promiseConn);

          await promiseConn.query(dropQuery);
          if (global.logger) global.logger.warn('Dropped...', triggerName);
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
      if (!(process.env.EXPERIMENTAL >= 1)) {
        // Commit the transaction if all queries are successful
        await util.promisify(destConnection.commit).call(destConnection);
      }
      return triggerNames?.length;
    } catch (err) {
      if (!(process.env.EXPERIMENTAL >= 1)) {
        // Rollback the transaction in case of an error
        await util.promisify(destConnection.rollback).call(destConnection);
      }
      if (global.logger) global.logger.error('Error during trigger deprecation: ', err);
      return 0;
    }
  }


  /**
   * Migrates views from one database to another.
   * 
   * @param {*} destConnection The destination database connection. 
   * @param {*} dbConfig The configuration for the databases.
   * @param {*} fromList The list of views to migrate. 
   * @param {string} [name=null] - Specific view name to migrate. If provided, skips list file.
   * @returns The number of views migrated. 
   */

  async migrateViews(destConnection, dbConfig, fromList = NEW, viewName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${VIEWS}`;
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${VIEWS}`;
    const backupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${this.getBackupFolder()}/${VIEWS}`;
    this.fileManager.makeSureFolderExisted(backupFolder);
    try {
      const viewFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${VIEWS}`;
      const viewList = `${fromList}.list`;
      const viewNames = viewName ? [viewName] : await this.readComparisonList(srcEnv, dbConfig.envName, VIEWS, viewList);
      if (!viewNames?.length) {
        if (!viewName) logger.dev(`No VIEW to migrate to ${dbConfig.envName}`);
        return 0;
      }

      // Views migration is best-effort due to dependencies.
      // DDLs cause implicit commits, so global transaction is not useful here.
      // We process each view individually and track failures.

      const promiseConn = destConnection.promise();
      const failedViews = [];
      let successCount = 0;

      for (const viewName of viewNames) {
        try {
          const fileName = `${viewName}.sql`;
          const dropQuery = `DROP VIEW IF EXISTS \`${viewName}\`;`;
          const importQuery = await this.readDDL(srcEnv, VIEWS, viewName);

          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { dropQuery, importQuery });
          } else {
            // Save snapshot before dropping
            await this.savePreMigrationSnapshot(dbConfig.envName, VIEWS, viewName, promiseConn);

            // Drop
            await promiseConn.query(dropQuery);
            if (global.logger) global.logger.warn('Dropped...', viewName);

            // Create
            await promiseConn.query(this.replaceWithEnv(importQuery, dbConfig.envName));
            if (global.logger) global.logger.info('Created...', viewName);

            if (this.storage) {
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: VIEWS,
                name: viewName,
                content: this.replaceWithEnv(importQuery, dbConfig.envName)
              });
            }
            // copy to backup & soft migrate
            this.fileManager.copyFile(path.join(destFolder, fileName), path.join(backupFolder, fileName));
            this.fileManager.copyFile(path.join(srcFolder, fileName), path.join(destFolder, fileName));
          }
          successCount++;
        } catch (err) {
          if (global.logger) global.logger.error(`Error migrating view ${viewName}:`, err.message);
          failedViews.push(viewName);
        }
      }

      // Update the list file with remaining (failed) views
      if (!viewName) {
        if (failedViews.length > 0) {
          if (global.logger) global.logger.warn(`Updated ${viewList} with ${failedViews.length} failed views.`);
          this.fileManager.saveToFile(viewFolder, viewList, failedViews.join('\n'));
        } else {
          this.fileManager.saveToFile(viewFolder, viewList, '');
        }
      }

      return successCount;
    } catch (err) {
      if (global.logger) global.logger.error('Error in migrateViews:', err);
      // Don't throw, return what we achieved
      return 0;
    }
  }

  /**
   * Remove deprecated views from destination db.
   * @param {*} destConnection 
   * @param {*} dbConfig 
   * @param {string} [viewList='deprecated.list'] - The list file name for deprecated views.
   * @param {string} [name=null] - Specific view name to deprecate. If provided, skips list file.
   * @returns 
   */
  async deprecateViews(destConnection, dbConfig, viewList = 'deprecated.list', viewName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${VIEWS}`;
    const viewFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${VIEWS}`;
    const viewNames = viewName ? [viewName] : await this.readComparisonList(srcEnv, dbConfig.envName, VIEWS, viewList);
    if (!viewNames?.length) {
      if (!viewName) logger.dev(`No VIEW to deprecated to ${dbConfig.envName}`);
      return 0;
    }
    if (!(process.env.EXPERIMENTAL >= 1)) {
      await util.promisify(destConnection.beginTransaction).call(destConnection);
    }
    try {
      for (const viewName of viewNames) {
        const dropQuery = `DROP VIEW IF EXISTS \`${viewName}\`;`;
        if (+process.env.EXPERIMENTAL === 1) {
          logger.warn('Experimental Run::', { dropQuery });
        } else {
          // Save snapshot before dropping
          await this.savePreMigrationSnapshot(dbConfig.envName, VIEWS, viewName, destConnection);

          await util.promisify(destConnection.query).call(destConnection, dropQuery);
          logger.warn('Dropped...', viewName);
          // Log to storage
          if (this.storage) {
            await this.storage.saveMigration({
              srcEnv,
              destEnv: dbConfig.envName,
              database: this.getDBName(srcEnv),
              type: VIEWS,
              name: viewName,
              operation: 'DROP',
              status: 'SUCCESS'
            });
          }
        }
        // soft delete
        this.fileManager.removeFile(destFolder, `${viewName}.sql`);
      }
      // Clean up the view list after migration (only if not single migration)
      if (!viewName) {
        this.fileManager.saveToFile(viewFolder, viewList, '');
      }
      if (!(process.env.EXPERIMENTAL >= 1)) {
        // Commit the transaction if all queries are successful
        await util.promisify(destConnection.commit).call(destConnection);
      }
      return viewNames?.length;
    } catch (err) {
      if (!(process.env.EXPERIMENTAL >= 1)) {
        // Rollback the transaction in case of an error
        await util.promisify(destConnection.rollback).call(destConnection);
      }
      if (global.logger) global.logger.error('Error during view deprecation: ', err);
      return 0;
    }
  }


  async isTableExists(connection, tableName) {
    try {
      const promiseConn = connection.promise();
      const [rows] = await promiseConn.query(`SHOW TABLES LIKE ?`, [tableName]);
      return (rows)?.length > 0;
    } catch (err) {
      if (global.logger) global.logger.error(`Error checking if table ${tableName} exists:`, err);
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
    try {
      const tblFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TABLES}`
      const tblList = `${NEW}.list`;
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, tblList);
      if (!tableNames?.length) {
        if (!tableName) logger.dev(`No TABLE to migrate to ${dbConfig.envName}`);
        return 0;
      }

      const promiseConn = destConnection.promise();
      let tablesMigrated = 0;

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
        await promiseConn.query('SET FOREIGN_KEY_CHECKS = 0;');
      }
      try {
        for (const tableName of tableNames) {
          if (tableName.indexOf('pt_') === 0) {
            continue;
          }

          if (await this.isTableExists(destConnection, tableName)) {
            logger.dev(`Table ${tableName} already exists in the destination database.`);
            continue;
          }

          const importQuery = await this.readDDL(srcEnv, TABLES, tableName);

          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { importQuery });
          } else {
            await promiseConn.query(this.replaceWithEnv(importQuery, dbConfig.envName));
            if (global.logger) global.logger.info('Created...', tableName, '\n');

            if (this.storage) {
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: TABLES,
                name: tableName,
                content: this.replaceWithEnv(importQuery, dbConfig.envName)
              });
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: TABLES,
                name: tableName,
                operation: 'CREATE',
                status: 'SUCCESS'
              });
            } else {
              const srcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TABLES}`;
              const destFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${TABLES}`;
              this.fileManager.copyFile(path.join(srcFolder, `${tableName}.sql`), path.join(destFolder, `${tableName}.sql`));
            }
          }
          tablesMigrated++;
        }
        if (!tableName) {
          this.fileManager.saveToFile(tblFolder, tblList, '');
        }
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.query('SET FOREIGN_KEY_CHECKS = 1;');
          await promiseConn.commit();
        }
        return tablesMigrated;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.query('SET FOREIGN_KEY_CHECKS = 1;');
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during table migration:`, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading tables: ', err);
      throw err;
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
    if (global.logger) global.logger.info(`[Migrator] alterTableColumns called for ${tableName}. Storage available: ${!!this.storage}`);
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const tableMap = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/tables`;
    try {
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, `alter-${alterType}.list`);

      if (!tableNames?.length) {
        if (!tableName) logger.dev(`No TABLE to alter for ${dbConfig.envName}`);
        return 0;
      }

      const promiseConn = destConnection.promise();
      let tablesAltered = 0;

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await promiseConn.beginTransaction();
        await promiseConn.query('SET FOREIGN_KEY_CHECKS = 0;');
      }
      try {
        for (const tableName of tableNames) {
          if (!(await this.isTableExists(destConnection, tableName))) {
            logger.dev(`Table ${tableName} does not exist in the destination database.`);
            continue;
          }

          let alterStatements = [];

          // 1. Try to get from SQLite storage first
          if (this.storage) {
            if (global.logger) global.logger.info(`[Migrator] Querying storage for ${srcEnv}->${dbConfig.envName} (${this.getDBName(srcEnv)})`);
            const comparisons = await this.storage.getComparisons(srcEnv, dbConfig.envName, this.getDBName(srcEnv), TABLES);

            const comp = comparisons.find(c => c.name.toLowerCase() === tableName.toLowerCase() && c.status === 'updated');
            if (comp) {
              if (global.logger) global.logger.info(`[Migrator] Found match for ${tableName}. HasAlter: ${!!comp.alterStatements}`);
              if (comp.alterStatements) {
                // Ensure array
                alterStatements = Array.isArray(comp.alterStatements) ? comp.alterStatements : [comp.alterStatements];
                // If it is a string (legacy/bug), try to parse or wrap
                if (typeof alterStatements === 'string') {
                  try { alterStatements = JSON.parse(alterStatements); } catch (e) { alterStatements = [alterStatements]; }
                }
              }
            } else {
              if (global.logger) {
                global.logger.info(`[Migrator] No 'updated' record found for ${tableName}`);
                global.logger.dev(`[Migrator] Available tables: ${comparisons.map(c => `${c.name}(${c.status})`).join(', ')}`);
              }
            }
          }

          // 2. Fallback to physical file if SQLite is empty
          if (alterStatements.length === 0) {
            const alterQuery = await this.fileManager.readFromFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
            if (alterQuery) {
              alterStatements = [alterQuery];
            }
          }

          if (alterStatements.length === 0) {
            if (global.logger) global.logger.warn(`No alter statements found for ${tableName} (Type: ${alterType})`);
            continue;
          }

          if (+process.env.EXPERIMENTAL === 1) {
            logger.warn('::Experimental Run::', { tableName, alterStatements });
          } else {
            // Save snapshot before altering
            await this.savePreMigrationSnapshot(dbConfig.envName, TABLES, tableName, promiseConn);

            for (const query of alterStatements) {
              await promiseConn.query(this.replaceWithEnv(query, dbConfig.envName));
            }
            if (this.storage) {
              const newDDL = await this.readDDL(srcEnv, TABLES, tableName);
              await this.storage.saveDDL({
                environment: dbConfig.envName,
                database: this.getDBName(dbConfig.envName),
                type: TABLES,
                name: tableName,
                content: this.replaceWithEnv(newDDL, dbConfig.envName)
              });
              await this.storage.saveMigration({
                srcEnv,
                destEnv: dbConfig.envName,
                database: this.getDBName(srcEnv),
                type: TABLES,
                name: tableName,
                operation: 'ALTER',
                status: 'SUCCESS'
              });
            } else {
              const dsSrcFolder = `db/${srcEnv}/${this.getDBName(srcEnv)}/${TABLES}`;
              const dsDestFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${TABLES}`;
              const dsBackupFolder = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}/${this.getBackupFolder()}/${TABLES}`;
              const fileName = `${tableName}.sql`;
              this.fileManager.makeSureFolderExisted(dsBackupFolder);
              this.fileManager.copyFile(path.join(dsDestFolder, fileName), path.join(dsBackupFolder, fileName));
              this.fileManager.copyFile(path.join(dsSrcFolder, fileName), path.join(dsDestFolder, fileName));
            }

            // Clean up files if they exist
            this.fileManager.removeFile(`${tableMap}/alters/${alterType}`, `${tableName}.sql`);
          }
          tablesAltered++;
        }
        if (!tableName) {
          this.fileManager.saveToFile(tableMap, `alter-${alterType}.list`, '');
        }

        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.query('SET FOREIGN_KEY_CHECKS = 1;');
          await promiseConn.commit();
        }
        return tablesAltered;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await promiseConn.query('SET FOREIGN_KEY_CHECKS = 1;');
          await promiseConn.rollback();
        }
        if (global.logger) global.logger.error(`Error during table alteration:`, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading alterations: ', err);
      throw err;
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
          if (!(process.env.EXPERIMENTAL >= 1)) {
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
          if (!(process.env.EXPERIMENTAL >= 1)) {
            // Commit the transaction if all queries are successful
            await util.promisify(destConnection.commit).call(destConnection);
          }
        } catch (err) {
          if (!(process.env.EXPERIMENTAL >= 1)) {
            // Rollback the transaction in case of an error
            await util.promisify(destConnection.rollback).call(destConnection);
          }
          if (global.logger) global.logger.error(`Error during seeding data:`, err);
        }
        tablesSeeded++;
      }

      return tablesSeeded;
    } catch (err) {
      if (global.logger) global.logger.error('Error reading tables-migrate.list:', err);
      return 0;
    }
  }


  /**
   * Migrate DDL
   * @param {string} ddl - DDL Type (TABLES, PROCEDURES, etc)
   * @param {string} fromList - List type (NEW, UPDATED)
   * @param {string} [specificName=null] - Specific DDL name
   * @returns {Function} Async function for migration
   */
  migrate(ddl, fromList, specificName = null) {
    if (global.logger) global.logger.info(`[Migrator] migrate() called with: ddl=${ddl}, list=${fromList}, name=${specificName}`);
    return async (env) => {
      if (global.logger) global.logger.info(`[Migrator] Executing migration logic for ${env}`);
      if (global.logger) global.logger.warn(`Start migrating ${fromList} ${ddl} ${specificName ? specificName : 'changes'} for...`, env);
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
            const listType = fromList.toLowerCase();

            if (listType === NEW) {
              rs = await this.migrateTables(destConnection, dbConfig, specificName);
            } else if (listType === UPDATED) {
              // Priority: Always process both column and index alters when using centralized storage
              const colRs = await this.alterTableColumns(destConnection, dbConfig, 'columns', specificName);
              const idxRs = await this.alterTableColumns(destConnection, dbConfig, 'indexes', specificName);
              rs = (colRs || 0) + (idxRs || 0);
            }
            if (global.logger) global.logger.info(`Migration of ${ddl} ${env} done in:: ${Date.now() - start}ms`);
            break;
          case VIEWS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateViews(destConnection, dbConfig, 'deprecated.list', specificName);
            } else {
              rs = await this.migrateViews(destConnection, dbConfig, fromList, specificName);
            }
            break;
          case TRIGGERS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateTriggers(destConnection, dbConfig, 'deprecated.list', specificName);
            } else {
              rs = await this.migrateTriggers(destConnection, dbConfig, fromList, specificName);
            }
            break;
        }

        destConnection.end(); // Closing connection properly
        const total = rs + alterRs;
        if (global.logger) global.logger.info(`Migrate successful: ${rs} created, ${alterRs} altered. Total ${total} ${ddl} in ${Date.now() - start}ms`);
        return total;
      } catch (err) {
        if (global.logger) global.logger.error('Error during migration: ', err);
        try { destConnection.end(); } catch (e) { }
        throw err;
      }
    };
  }
}
