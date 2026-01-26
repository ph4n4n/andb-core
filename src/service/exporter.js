/**
 * @anph/core Exporter Service - Database export
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Service for exporting database structures
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */
const {
  DDL: { TRIGGERS, TABLES, VIEWS, PROCEDURES, FUNCTIONS, EVENTS }
} = require("../configs/constants");
const { DDLParser } = require('../utils');
// Remove direct import of file helper
// const {
//   saveToFile,
//   makeSureFolderExisted,
//   emptyDirectory,
//   readFromFile,
// } = require("../utils/file.helper");

module.exports = class ExporterService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }
  }

  // Function to prepare the DDL folder
  makeDDLFolderReady(dbPath, DDL, specificName = null) {
    // NEW: Skip folder creation if using Storage Strategy
    if (this.storage) {
      return null; // Storage handles everything
    }

    // NEW: Skip folder creation if file output is disabled
    if (this.config && this.config.enableFileOutput === false) {
      return null;
    }

    const ddLFolderPath = `${dbPath}/${DDL}`;
    // 1. get folder ready
    this.fileManager.makeSureFolderExisted(ddLFolderPath);
    this.fileManager.makeSureFolderExisted(`${dbPath}/current-ddl`);

    // 2. ONLY clean directory and list if NOT an atomic export
    if (!specificName) {
      this.fileManager.emptyDirectory(ddLFolderPath);
      this.fileManager.saveToFile(`${dbPath}/current-ddl`, `${DDL}.list`, "");
    }

    // 3. make sure existed backup folder
    this.fileManager.makeSureFolderExisted(`${dbPath}/backup/${DDL}`);
    return ddLFolderPath;
  }

  /**
   * Generically export DDLs
   */
  async _exportDDL(driver, dbConfig, type, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, type, specificName);
    const introspection = driver.getIntrospectionService();

    try {
      const names = await this._listObjects(introspection, dbConfig.database, type, specificName);
      if (!specificName) {
        await this.appendReport(dbConfig.envName, { [`${type}_total`]: names.length });
      }

      const exportedData = [];
      for (const name of names) {
        try {
          const ddl = await this._getObjectDDL(introspection, dbConfig.database, type, name);
          if (!ddl) continue;

          await this.appendDDL(dbConfig.envName, ddlFolderPath, type, name, ddl);
          exportedData.push({ name, ddl });
        } catch (err) {
          if (global.logger) global.logger.error(`Error exporting ${type} ${name}:`, err.message);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(dbConfig.envName, this.getDBName(dbConfig.envName), type, exportedData, !specificName);
      }

      return { count: names.length, data: exportedData };
    } catch (err) {
      if (global.logger) global.logger.error(`Error retrieving ${type}:`, err);
      throw err;
    }
  }

  async _listObjects(introspection, dbName, type, pattern) {
    const listMethods = {
      [TABLES]: introspection.listTables,
      [VIEWS]: introspection.listViews,
      [PROCEDURES]: introspection.listProcedures,
      [FUNCTIONS]: introspection.listFunctions,
      [TRIGGERS]: introspection.listTriggers,
      [EVENTS]: introspection.listEvents,
    };
    return await listMethods[type.toLowerCase()].call(introspection, dbName, pattern);
  }

  async _getObjectDDL(introspection, dbName, type, name) {
    const ddlMethods = {
      [TABLES]: introspection.getTableDDL,
      [VIEWS]: introspection.getViewDDL,
      [PROCEDURES]: introspection.getProcedureDDL,
      [FUNCTIONS]: introspection.getFunctionDDL,
      [TRIGGERS]: introspection.getTriggerDDL,
      [EVENTS]: introspection.getEventDDL,
    };
    return await ddlMethods[type.toLowerCase()].call(introspection, dbName, name);
  }

  async exportTables(driver, config, name) { return this._exportDDL(driver, config, TABLES, name); }
  async exportViews(driver, config, name) { return this._exportDDL(driver, config, VIEWS, name); }
  async exportProcedures(driver, config, name) { return this._exportDDL(driver, config, PROCEDURES, name); }
  async exportFunctions(driver, config, name) { return this._exportDDL(driver, config, FUNCTIONS, name); }
  async exportTriggers(driver, config, name) { return this._exportDDL(driver, config, TRIGGERS, name); }
  async exportEvents(driver, config, name) { return this._exportDDL(driver, config, EVENTS, name); }

  async appendDDL(
    env,
    ddlFolderPath,
    ddlType,
    ddlName,
    createStatement,
  ) {
    // Unified Storage Strategy handles this
    if (this.storage) {
      await this.storage.saveDDL({
        environment: env,
        database: this.getDBName(env),
        type: ddlType,
        name: ddlName,
        content: createStatement
      });
      return;
    }

    // Fallback: FileManager (backward compatible)
    // Skip if file output disabled
    if (this.config && this.config.enableFileOutput === false) {
      return;
    }

    // Skip if ddlFolderPath is null
    if (!ddlFolderPath) {
      return;
    }

    const ddlFolder = `./db/${env}/${this.getDBName(env)}/current-ddl`;
    const ddlFile = `${ddlType}.list`;
    const allDll = this.fileManager.readFromFile(ddlFolder, ddlFile, 1);
    const ddlList = [...allDll, ddlName];
    this.fileManager.saveToFile(ddlFolder, ddlFile, `${ddlList.join("\n")}`);
    this.fileManager.saveToFile(ddlFolderPath, `${ddlName}.sql`, createStatement);
  }



  /**
   * Exporter function that exports the specified DDL (Data Definition Language) from a MySQL database.
   *
   * @param {string} ddl - The type of DDL to export (e.g., TABLES, FUNCTIONS, PROCEDURES).
   * @param {string} specificName - Optional specific object name to export.
   * @returns {Function} - An async function that takes an environment object and exports the DDL.
   */
  export(ddl, specificName = null) {
    return async (env) => {
      const startTime = Date.now();
      const dbConfig = this.getDBDestination(env);

      if (global.logger) {
        global.logger.warn(`Start exporting ${ddl} changes for...`, env);
      }

      // Create and Connect Driver (Unified Factory)
      const driver = await this.driver(dbConfig);

      try {
        let result;
        switch (ddl) {
          case TABLES:
            result = await this.exportTables(driver, dbConfig, specificName);
            break;
          case VIEWS:
            result = await this.exportViews(driver, dbConfig, specificName);
            break;
          case FUNCTIONS:
            result = await this.exportFunctions(driver, dbConfig, specificName);
            break;
          case PROCEDURES:
            result = await this.exportProcedures(driver, dbConfig, specificName);
            break;
          case TRIGGERS:
            result = await this.exportTriggers(driver, dbConfig, specificName);
            break;
          case EVENTS:
            result = await this.exportEvents(driver, dbConfig, specificName);
            break;
        }

        const duration = Date.now() - startTime;
        const count = typeof result === 'object' && result.count !== undefined ? result.count : result;
        const data = typeof result === 'object' && result.data !== undefined ? result.data : [];

        if (global.logger) {
          global.logger.info(`\nThere are ${count} ${ddl} exported in ${duration}ms`);
        }

        return {
          success: true,
          ddl,
          env,
          database: this.getDBName(env),
          count,
          data,
          duration
        };
      } catch (error) {
        if (global.logger) {
          global.logger.error(`Export failed: ${error.message}`);
        }
        throw error;
      } finally {
        await driver.disconnect();
      }
    };
  }
}
