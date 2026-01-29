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

const {
  STATUSES: { NEW, UPDATED, DEPRECATED, OTE },
  DDL: { TABLES, PROCEDURES, FUNCTIONS, TRIGGERS, VIEWS, EVENTS }
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
  async fetchDDLLive(driver, type, name) {
    try {
      const introspection = driver.getIntrospectionService();
      const dbName = driver.config.database;

      switch (type.toLowerCase()) {
        case TABLES:
          return await introspection.getTableDDL(dbName, name);
        case PROCEDURES:
          return await introspection.getProcedureDDL(dbName, name);
        case FUNCTIONS:
          return await introspection.getFunctionDDL(dbName, name);
        case VIEWS:
          return await introspection.getViewDDL(dbName, name);
        case TRIGGERS:
          return await introspection.getTriggerDDL(dbName, name);
        case EVENTS:
          return await introspection.getEventDDL(dbName, name);
        default:
          return null;
      }
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
  /**
   * Generically migrate DDLs
   */
  async _genericMigrate(driver, dbConfig, type, fromList = NEW, objectName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destEnv = dbConfig.envName;
    const dbName = this.getDBName(destEnv);
    const backupFolder = `db/${destEnv}/${dbName}/${this.getBackupFolder()}/${type}`;
    this.fileManager.makeSureFolderExisted(backupFolder);

    const objectNames = objectName ? [objectName] : await this.readComparisonList(srcEnv, destEnv, type, `${fromList}.list`);
    if (!objectNames?.length) return 0;

    let successCount = 0;
    for (const name of objectNames) {
      if (this.isNotMigrateCondition(name)) {
        await this._skipMigration(srcEnv, destEnv, type, name);
        continue;
      }

      try {
        await this._migrateSingleObject(driver, srcEnv, destEnv, type, name, fromList);
        successCount++;
      } catch (err) {
        if (global.logger) global.logger.error(`Error migrating ${type} ${name}:`, err.message);
      }
    }

    if (!objectName && !this.storage) {
      this.fileManager.saveToFile(`map-migrate/${srcEnv}-to-${destEnv}/${this.getDBName(srcEnv)}/${type}`, `${fromList}.list`, '');
    }

    return successCount;
  }

  async _migrateSingleObject(driver, srcEnv, destEnv, type, name, fromList) {
    const generator = driver.getDDLGenerator();
    const dropQuery = this._getDropQuery(generator, type, name);
    const importQuery = await this.readDDL(srcEnv, type, name);

    await this.savePreMigrationSnapshot(destEnv, type, name, driver);
    await driver.query(dropQuery);
    await driver.query(this.replaceWithEnv(importQuery, destEnv));

    if (global.logger) global.logger.info(`Migrated ${type}: ${name}`);

    if (this.storage) {
      await this.storage.saveDDL({ environment: destEnv, database: this.getDBName(destEnv), type, name, content: importQuery });
      await this.storage.saveMigration({ srcEnv, destEnv, type, name, status: 'SUCCESS', operation: fromList === DEPRECATED ? 'DROP' : 'CREATE' });
    }
  }

  _getDropQuery(generator, type, name) {
    return generator.drop(type, name);
  }

  async _skipMigration(srcEnv, destEnv, type, name) {
    if (global.logger) global.logger.warn(`[SKIP] Migration policy excluded ${type}: ${name}`);
    if (this.storage) {
      await this.storage.saveMigration({ srcEnv, destEnv, type, name, status: 'SKIPPED', operation: 'SKIP', error: 'Policy excluded' });
    }
  }

  async migrateFunctions(driver, dbConfig, fromList, name) { return this._genericMigrate(driver, dbConfig, FUNCTIONS, fromList, name); }
  async migrateProcedures(driver, dbConfig, fromList, name) { return this._genericMigrate(driver, dbConfig, PROCEDURES, fromList, name); }
  async migrateTriggers(driver, dbConfig, fromList, name) { return this._genericMigrate(driver, dbConfig, TRIGGERS, fromList, name); }
  async migrateViews(driver, dbConfig, fromList, name) { return this._genericMigrate(driver, dbConfig, VIEWS, fromList, name); }
  async migrateEvents(driver, dbConfig, fromList, name) { return this._genericMigrate(driver, dbConfig, EVENTS, fromList, name); }

  /**
   * This function deprecate functions from destination db.
   * 
   * @param {object} destConnection - The destination database connection.
   * @param {object} dbConfig - The database configuration.
   * @param {string} [fnList='deprecated.list'] - The list file name for deprecated functions.
   * @param {string} [name=null] - Specific function name to deprecate. If provided, skips list file.
   * @returns {number} - The number of functions migrated.
   */
  async _genericDeprecate(driver, dbConfig, type, listFile = 'deprecated.list', objectName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const destEnv = dbConfig.envName;
    const dbName = this.getDBName(destEnv);
    const destFolder = `db/${destEnv}/${dbName}/${type}`;

    const objectNames = objectName ? [objectName] : await this.readComparisonList(srcEnv, destEnv, type, listFile);
    if (!objectNames?.length) return 0;

    for (const name of objectNames) {
      try {
        const generator = driver.getDDLGenerator();
        const dropQuery = this._getDropQuery(generator, type, name);

        await this.savePreMigrationSnapshot(destEnv, type, name, driver);
        await driver.query(dropQuery);

        if (global.logger) global.logger.warn(`Dropped ${type}: ${name}`);

        if (this.storage) {
          await this.storage.saveMigration({ srcEnv, destEnv, status: 'SUCCESS', type, name, operation: 'DROP' });
        }
        this.fileManager.removeFile(destFolder, `${name}.sql`);
      } catch (err) {
        if (global.logger) global.logger.error(`Error deprecating ${type} ${name}:`, err.message);
      }
    }

    if (!objectName && !this.storage) {
      this.fileManager.saveToFile(`map-migrate/${srcEnv}-to-${destEnv}/${this.getDBName(srcEnv)}/${type}`, listFile, '');
    }

    return objectNames.length;
  }

  async deprecateFunctions(driver, dbConfig, list, name) { return this._genericDeprecate(driver, dbConfig, FUNCTIONS, list, name); }
  async deprecateProcedures(driver, dbConfig, list, name) { return this._genericDeprecate(driver, dbConfig, PROCEDURES, list, name); }
  async deprecateTriggers(driver, dbConfig, list, name) { return this._genericDeprecate(driver, dbConfig, TRIGGERS, list, name); }
  async deprecateViews(driver, dbConfig, list, name) { return this._genericDeprecate(driver, dbConfig, VIEWS, list, name); }

  isNotMigrateCondition(name, notAllowOTE = true) {
    if (this.isNotMigrateConditionConfig) {
      if (typeof this.isNotMigrateConditionConfig === 'function') return this.isNotMigrateConditionConfig(name);
      try { return new RegExp(this.isNotMigrateConditionConfig, 'i').test(name); } catch (e) { }
    }
    // pt_ is percona toolkit, usually should be skipped
    return name.toLowerCase().includes('test') || (notAllowOTE && name.includes('OTE_')) || name.startsWith('pt_');
  }




  async isTableExists(driver, tableName) {
    try {
      const dbName = driver.config.database;
      const tables = await driver.getIntrospectionService().listTables(dbName, tableName);
      return tables.length > 0;
    } catch (err) {
      if (global.logger) global.logger.error(`Error checking if table ${tableName} exists:`, err);
      return false;
    }
  }

  async migrateTables(driver, dbConfig, tableName = null) {
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    try {
      const tblFolder = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/${TABLES}`
      const tblList = `${NEW}.list`;
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, tblList);
      if (!tableNames?.length) {
        if (!tableName && global.logger) global.logger.dev(`No TABLE to migrate to ${dbConfig.envName}`);
        return 0;
      }

      let tablesMigrated = 0;

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await driver.setForeignKeyChecks(false);
      }
      try {
        for (const tableName of tableNames) {
          if (this.isNotMigrateCondition(tableName)) {
            continue;
          }

          if (await this.isTableExists(driver, tableName)) {
            if (global.logger) global.logger.dev(`Table ${tableName} already exists in the destination database.`);
            continue;
          }

          const importQuery = await this.readDDL(srcEnv, TABLES, tableName);

          if (+process.env.EXPERIMENTAL === 1) {
            if (global.logger) global.logger.warn('Experimental Run::', { importQuery });
          } else {
            await driver.query(this.replaceWithEnv(importQuery, dbConfig.envName));
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
          await driver.setForeignKeyChecks(true);
        }
        return tablesMigrated;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await driver.setForeignKeyChecks(true);
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
  async alterTableColumns(driver, dbConfig, alterType = 'columns', tableName = null) {
    if (global.logger) global.logger.info(`[Migrator] alterTableColumns called for ${tableName}. Storage available: ${!!this.storage}`);
    const srcEnv = this.getSourceEnv(dbConfig.envName);
    const tableMap = `map-migrate/${srcEnv}-to-${dbConfig.envName}/${this.getDBName(srcEnv)}/tables`;
    try {
      const tableNames = tableName ? [tableName] : await this.readComparisonList(srcEnv, dbConfig.envName, TABLES, `alter-${alterType}.list`);

      if (!tableNames?.length) {
        if (!tableName && global.logger) global.logger.dev(`No TABLE to alter for ${dbConfig.envName}`);
        return 0;
      }

      let tablesAltered = 0;

      if (!(process.env.EXPERIMENTAL >= 1)) {
        await driver.setForeignKeyChecks(false);
      }
      try {
        for (const tableName of tableNames) {
          if (!(await this.isTableExists(driver, tableName))) {
            if (global.logger) global.logger.dev(`Table ${tableName} does not exist in the destination database.`);
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
            if (global.logger) global.logger.warn('::Experimental Run::', { tableName, alterStatements });
          } else {
            // Save snapshot before altering
            await this.savePreMigrationSnapshot(dbConfig.envName, TABLES, tableName, driver);

            for (const query of alterStatements) {
              await driver.query(this.replaceWithEnv(query, dbConfig.envName));
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
          await driver.setForeignKeyChecks(true);
        }
        return tablesAltered;
      } catch (err) {
        if (!(process.env.EXPERIMENTAL >= 1)) {
          await driver.setForeignKeyChecks(true);
        }
        if (global.logger) global.logger.error(`Error during table alteration:`, err);
        throw err;
      }
    } catch (err) {
      if (global.logger) global.logger.error('Error reading alterations: ', err);
      throw err;
    }
  }

  // Deprecated naive implementation removed as per user request


  /**
   * Migrate DDL
   * @param {string} ddl - DDL Type (TABLES, PROCEDURES, etc)
   * @param {string} fromList - List type (NEW, UPDATED)
   * @param {string} [specificName=null] - Specific DDL name
   * @returns {Function} Async function for migration
   */
  migrate(ddl, fromList, specificName = null) {
    if (global.logger) global.logger.info(`[Migrator] migrate() wrapper for: ddl=${ddl}, list=${fromList}, name=${specificName}`);
    return async (env) => {
      if (global.logger) global.logger.warn(`Start migrating ${fromList} ${ddl} ${specificName ? specificName : 'changes'} for...`, env);
      const start = Date.now();
      const dbConfig = this.getDBDestination(env);

      const driver = await this.driver(dbConfig);

      // DBA Rule: Cannot migrate into a static SQL Dump driver
      if (driver.config?.type === 'dump') {
        await driver.disconnect();
        throw new Error(`Migration forbidden: Target connection is a static SQL Dump file. Sync operations are only allowed on live database servers.`);
      }

      try {
        let rs = 0;
        let alterRs = 0;

        switch (ddl) {
          case FUNCTIONS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateFunctions(driver, dbConfig, 'deprecated.list', specificName);
            } else if (fromList === OTE) {
              rs = await this.deprecateFunctions(driver, dbConfig, 'OTE.list', specificName);
            } else {
              rs = await this.migrateFunctions(driver, dbConfig, fromList, specificName);
            }
            break;
          case PROCEDURES:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateProcedures(driver, dbConfig, 'deprecated.list', specificName);
            } else if (fromList === OTE) {
              rs = await this.deprecateProcedures(driver, dbConfig, 'OTE.list', specificName);
            } else {
              rs = await this.migrateProcedures(driver, dbConfig, fromList, specificName);
            }
            break;
          case TABLES:
            const listType = fromList.toLowerCase();

            if (listType === NEW) {
              rs = await this.migrateTables(driver, dbConfig, specificName);
            } else if (listType === UPDATED) {
              // Priority: Always process both column and index alters when using centralized storage
              const colRs = await this.alterTableColumns(driver, dbConfig, 'columns', specificName);
              const idxRs = await this.alterTableColumns(driver, dbConfig, 'indexes', specificName);
              rs = (colRs || 0) + (idxRs || 0);
            }
            break;
          case VIEWS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateViews(driver, dbConfig, 'deprecated.list', specificName);
            } else {
              rs = await this.migrateViews(driver, dbConfig, fromList, specificName);
            }
            break;
          case TRIGGERS:
            if (fromList === DEPRECATED) {
              rs = await this.deprecateTriggers(driver, dbConfig, 'deprecated.list', specificName);
            } else {
              rs = await this.migrateTriggers(driver, dbConfig, fromList, specificName);
            }
            break;
        }

        const total = rs + alterRs;
        if (global.logger) global.logger.info(`Migrate successful: ${rs} created, ${alterRs} altered. Total ${total} ${ddl} in ${Date.now() - start}ms`);
        return total;
      } catch (err) {
        if (global.logger) global.logger.error('Error during migration execution: ', err);
        throw err;
      } finally {
        await driver.disconnect();
      }
    };
  }
}
