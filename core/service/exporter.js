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
   * Exports triggers from a database connection.
   * 
   * @param {*} connection - The database connection.
   * @param {*} dbConfig - The database configuration.
   * @returns {Promise} - A promise that resolves with the number of exported triggers.
   */
  async exportTriggers(driver, dbConfig, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, TRIGGERS, specificName);
    const triggerQuery = specificName ? `SHOW TRIGGERS LIKE '${specificName}'` : "SHOW TRIGGERS";

    try {
      const triggerResults = await driver.query(triggerQuery);

      if (!specificName) {
        await this.appendReport(dbConfig.envName, {
          triggers_total: triggerResults.length,
        });
      }

      const exportedData = [];

      for (const row of triggerResults) {
        const triggerName = row.Trigger;
        const query = `SHOW CREATE TRIGGER \`${triggerName}\``;
        try {
          const result = await driver.query(query);
          const createStatement = result[0]["SQL Original Statement"];

          const formattedStatement = driver.getDDLParser().normalize(createStatement);

          this.appendDDL(dbConfig.envName, ddlFolderPath, TRIGGERS, triggerName, formattedStatement);

          exportedData.push({
            name: triggerName,
            ddl: formattedStatement
          });
        } catch (error) {
          if (global.logger) global.logger.error(`Error exporting trigger ${triggerName}:`, error);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(
          dbConfig.envName,
          this.getDBName(dbConfig.envName),
          TRIGGERS,
          exportedData,
          !specificName
        );
      }

      return {
        count: triggerResults.length,
        data: exportedData
      };
    } catch (err) {
      if (global.logger) global.logger.error("Error retrieving triggers: ", err);
      throw err;
    }
  }

  /**
   * Exports functions from a database connection.
   *
   * @param {*} connection The database connection.
   * @param {*} dbConfig The database configuration.
   * @returns {Promise} A promise that resolves with the number of exported functions.
   */
  async exportFunctions(driver, dbConfig, specificName = null) {
    const self = this;
    const dbPath = `db/${dbConfig.envName}/${self.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = self.makeDDLFolderReady(dbPath, FUNCTIONS, specificName);

    const functionQuery = specificName
      ? `SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?`
      : "SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?)";
    const queryParams = specificName ? [dbConfig.database, specificName] : [dbConfig.database];

    try {
      const functionResults = await driver.query(functionQuery, queryParams);

      if (!specificName) {
        await self.appendReport(dbConfig.envName, {
          functions_total: functionResults.length,
        });
      }

      const exportedData = [];

      for (const row of functionResults) {
        const fnName = row.Name || row.name || Object.values(row)[1];
        const query = `SHOW CREATE FUNCTION \`${fnName}\``;

        try {
          const result = await driver.query(query);
          const createStatement = result[0]["Create Function"];

          if (!createStatement) {
            if (global.logger) global.logger.warn(`Skipping function ${fnName}: No CREATE FUNCTION statement found`);
            continue;
          }

          const cleanStatement = driver.getDDLParser().normalize(createStatement);

          self.appendDDL(dbConfig.envName, ddlFolderPath, FUNCTIONS, fnName, cleanStatement);

          exportedData.push({
            name: fnName,
            ddl: cleanStatement
          });
        } catch (fnError) {
          if (global.logger) global.logger.error(`Error exporting function ${fnName}:`, fnError.message);
        }
      }

      if (self.storage) {
        await self.storage.saveExport(
          dbConfig.envName,
          self.getDBName(dbConfig.envName),
          FUNCTIONS,
          exportedData,
          !specificName
        );
      }

      return {
        count: functionResults.length,
        data: exportedData
      };
    } catch (err) {
      if (global.logger) global.logger.error("Error retrieving functions: ", err);
      throw err;
    }
  }

  /**
   * This file contains a function to export procedures from a database connection.
   * @param {*} connection - The database connection.
   * @param {*} dbConfig - The database configuration.
   * @returns {Promise<number>} - A promise that resolves to the number of procedures exported.
   */
  async exportProcedures(driver, dbConfig, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, PROCEDURES, specificName);

    const procedureQuery = specificName
      ? `SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?`
      : "SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?)";
    const queryParams = specificName ? [dbConfig.database, specificName] : [dbConfig.database];

    try {
      const procedureResults = await driver.query(procedureQuery, queryParams);

      if (!specificName) {
        await this.appendReport(dbConfig.envName, {
          procedures_total: procedureResults.length,
        });
      }

      const exportedData = [];

      for (const row of procedureResults) {
        const spName = row.Name || row.name || Object.values(row)[1];
        const query = `SHOW CREATE PROCEDURE \`${spName}\``;

        try {
          const result = await driver.query(query);
          const createStatement = result[0]["Create Procedure"];

          if (!createStatement) {
            if (global.logger) global.logger.warn(`Skipping procedure ${spName}: No CREATE PROCEDURE statement found`);
            continue;
          }

          const cleanStatement = driver.getDDLParser().normalize(createStatement);

          this.appendDDL(dbConfig.envName, ddlFolderPath, PROCEDURES, spName, cleanStatement);

          exportedData.push({
            name: spName,
            ddl: cleanStatement
          });
        } catch (spError) {
          if (global.logger) global.logger.error(`Error exporting procedure ${spName}:`, spError.message);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(
          dbConfig.envName,
          this.getDBName(dbConfig.envName),
          PROCEDURES,
          exportedData,
          !specificName
        );
      }

      return {
        count: procedureResults.length,
        data: exportedData
      };
    } catch (err) {
      if (global.logger) global.logger.error("Error retrieving procedures: ", err);
      throw err;
    }
  }

  /**
   * @param {*} connection
   * @returns
   */
  async exportViews(driver, dbConfig, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, 'views', specificName);
    const viewQuery = specificName
      ? `SHOW FULL TABLES WHERE Table_type = 'VIEW' AND \`Tables_in_${dbConfig.database}\` = ?`
      : "SHOW FULL TABLES WHERE Table_type = 'VIEW'";
    const queryParams = specificName ? [specificName] : [];

    try {
      const viewResults = await driver.query(viewQuery, queryParams);

      if (!specificName) {
        await this.appendReport(dbConfig.envName, { views_total: viewResults.length });
      }
      const exportedData = [];

      for (const row of viewResults) {
        const viewName = Object.values(row)[0];
        const query = `SHOW CREATE VIEW \`${viewName}\``;

        try {
          const result = await driver.query(query);
          const createStatement = result[0]["Create View"];
          const cleanStatement = driver.getDDLParser().normalize(createStatement);

          this.appendDDL(dbConfig.envName, ddlFolderPath, 'views', viewName, cleanStatement);
          exportedData.push({ name: viewName, ddl: cleanStatement });
        } catch (viewError) {
          if (global.logger) global.logger.error(`Error exporting view ${viewName}:`, viewError);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(dbConfig.envName, this.getDBName(dbConfig.envName), 'views', exportedData, !specificName);
      }

      return { count: viewResults.length, data: exportedData };
    } catch (error) {
      if (global.logger) global.logger.error("Error in exportViews:", error);
      throw error;
    }
  }

  async exportTables(driver, dbConfig, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, TABLES, specificName);
    const tableQuery = specificName
      ? `SHOW TABLES LIKE ?`
      : "SHOW TABLES";
    const queryParams = specificName ? [specificName] : [];

    try {
      const tableResults = await driver.query(tableQuery, queryParams);

      if (!specificName) {
        await this.appendReport(dbConfig.envName, {
          tables_total: tableResults.length,
        });
      }

      const exportedData = [];

      for (const row of tableResults) {
        const tableName = Object.values(row)[0];
        const query = `SHOW CREATE TABLE \`${tableName}\``;

        try {
          const result = await driver.query(query);

          if (!result || !result[0]) {
            if (global.logger) global.logger.error(`Empty result for table: ${tableName}`);
            continue;
          }

          const createStatement = result[0]["Create Table"];

          if (!createStatement) {
            if (global.logger && result[0]['Create View']) {
              global.logger.warn(`Skipping VIEW: ${tableName} (use export views command for views)`);
            } else if (global.logger) {
              global.logger.error(`No "Create Table" in result for: ${tableName}`);
            }
            continue;
          }

          const cleanStatement = driver.getDDLParser().normalize(createStatement);
          this.appendDDL(dbConfig.envName, ddlFolderPath, TABLES, tableName, cleanStatement);

          exportedData.push({
            name: tableName,
            ddl: cleanStatement
          });
        } catch (tableError) {
          if (global.logger) global.logger.error(`Error exporting table ${tableName}:`, tableError);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(dbConfig.envName, this.getDBName(dbConfig.envName), TABLES, exportedData, !specificName);
      }

      return { count: tableResults.length, data: exportedData };
    } catch (error) {
      if (global.logger) global.logger.error("Error in exportTables:", error);
      throw error;
    }
  }

  async exportEvents(driver, dbConfig, specificName = null) {
    const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
    const ddlFolderPath = this.makeDDLFolderReady(dbPath, EVENTS, specificName);
    const eventQuery = specificName
      ? `SHOW EVENTS WHERE Db = ? AND Name = ?`
      : `SHOW EVENTS WHERE Db = ?`;
    const queryParams = specificName ? [dbConfig.database, specificName] : [dbConfig.database];

    try {
      const eventResults = await driver.query(eventQuery, queryParams);

      if (!specificName) {
        await this.appendReport(dbConfig.envName, { events_total: eventResults.length });
      }
      const exportedData = [];

      for (const row of eventResults) {
        const eventName = row.Name;
        const query = `SHOW CREATE EVENT \`${eventName}\``;

        try {
          const result = await driver.query(query);
          const createStatement = result[0]["Create Event"];
          let cleanStatement = driver.getDDLParser().normalize(createStatement);

          this.appendDDL(dbConfig.envName, ddlFolderPath, EVENTS, eventName, cleanStatement);
          exportedData.push({ name: eventName, ddl: cleanStatement });
        } catch (eventError) {
          if (global.logger) global.logger.error(`Error exporting event ${eventName}:`, eventError);
        }
      }

      if (this.storage) {
        await this.storage.saveExport(dbConfig.envName, this.getDBName(dbConfig.envName), EVENTS, exportedData, !specificName);
      }

      return { count: eventResults.length, data: exportedData };
    } catch (error) {
      if (global.logger) global.logger.error("Error in exportEvents:", error);
      throw error;
    }
  }

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

      // Log if logger available (optional)
      if (global.logger) {
        global.logger.warn(`Start exporting ${ddl} changes for...`, env);
      }

      // Create Driver instance (Factory method)
      // Map dbConfig to Driver Config
      const driverConfig = {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port
      };

      const driver = this.driver(driverConfig);

      // Connect to the database
      return new Promise((resolve, reject) => {
        driver.connect()
          .then(async () => {
            try {
              // Retrieve the list of DDL
              let result;
              // Pass 'driver' instead of 'connection'
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

              // Close the connection
              await driver.disconnect();

              const duration = Date.now() - startTime;

              // Extract count and data from result
              const count = typeof result === 'object' && result.count !== undefined ? result.count : result;
              const data = typeof result === 'object' && result.data !== undefined ? result.data : [];

              // Log if logger available
              if (global.logger) {
                global.logger.info(`\nThere are ${count} ${ddl} exported in ${duration}ms`);
              }

              // Return structured data
              resolve({
                success: true,
                ddl,
                env,
                database: this.getDBName(env),
                count,
                data,
                duration
              });
            } catch (error) {
              connection.end();
              if (global.logger) {
                global.logger.error(`Export failed: ${error.message}`);
              }
              reject(error);
            }
          });
      });
    };
  }
}
