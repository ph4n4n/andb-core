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
const mysql = require("mysql2");
const {
  DDL: { TRIGGERS, TABLES, VIEWS, PROCEDURES, FUNCTIONS }
} = require("../configs/constants");
// Remove direct import of file helper
// const {
//   saveToFile,
//   makeSureFolderExisted,
//   emptyDirectory,
//   readFromFile,
// } = require("../utils/file.helper");
const util = require("util");

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
  async exportTriggers(connection, dbConfig, specificName = null) {
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, TRIGGERS, specificName);
      // Query the database for trigger information
      const triggerQuery = specificName ? `SHOW TRIGGERS LIKE '${specificName}'` : "SHOW TRIGGERS";
      connection.query(triggerQuery, async (err, triggerResults) => {
        if (err) {
          if (global.logger) global.logger.error("Error retrieving triggers: ", err);
          connection.end();
          reject(err);
          return;
        }

        if (!specificName) {
          await this.appendReport(dbConfig.envName, {
            triggers_total: triggerResults.length,
          });
        }

        // NEW: Collect exported data
        const exportedData = [];

        // Export triggers to separate files
        for (const row of triggerResults) {
          const triggerName = row.Trigger;
          const query = `SHOW CREATE TRIGGER \`${triggerName}\``;
          try {
            const result = await util.promisify(connection.query).call(connection, query);
            const createStatement = result[0]["SQL Original Statement"];

            // Format trigger definition
            const formattedStatement = this.convertKeywordsToUppercase(createStatement)
              .replace(/\sDEFINER=`[^`]+`@`[^`]+`\s/g, " ")
              .replace(/\sCOLLATE\s+\w+\s/, " ")
              .replace(/\sCHARSET\s+\w+\s/, " ");

            this.appendDDL(dbConfig.envName, ddlFolderPath, TRIGGERS, triggerName, formattedStatement);

            exportedData.push({
              name: triggerName,
              ddl: formattedStatement
            });
          } catch (error) {
            if (global.logger) global.logger.error(`Error exporting trigger ${triggerName}:`, error);
          }
        }

        // NEW: Save to Storage
        if (this.storage) {
          await this.storage.saveExport(
            dbConfig.envName,
            this.getDBName(dbConfig.envName),
            TRIGGERS,
            exportedData,
            !specificName
          );
        }

        return resolve({
          count: triggerResults.length,
          data: exportedData
        });
      });
    });
  }

  /**
   * Exports functions from a database connection.
   *
   * @param {*} connection The database connection.
   * @param {*} dbConfig The database configuration.
   * @returns {Promise} A promise that resolves with the number of exported functions.
   */
  async exportFunctions(connection, dbConfig, specificName = null) {
    const self = this;
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${self.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = self.makeDDLFolderReady(dbPath, FUNCTIONS, specificName);
      // Query the database for function information
      const functionQuery = specificName
        ? `SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?`
        : "SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?)";
      const queryParams = specificName ? [dbConfig.database, specificName] : [dbConfig.database];

      connection.query(
        functionQuery,
        queryParams,
        async function (err, functionResults) {
          if (err) {
            if (global.logger) global.logger.error("Error retrieving functions: ", err);
            connection.end();
            reject(err);
            return;
          }

          if (!specificName) {
            await self.appendReport(dbConfig.envName, {
              functions_total: functionResults.length,
            });
          }

          // NEW: Collect exported data
          const exportedData = [];

          for (const row of functionResults) {
            const fnName = row.Name || row.name || Object.values(row)[1]; // Usually 2nd col is Name
            const query = `SHOW CREATE FUNCTION \`${fnName}\``;

            try {
              const result = await util
                .promisify(connection.query)
                .call(connection, query);

              const createStatement = result[0]["Create Function"];

              if (!createStatement) {
                if (global.logger) {
                  global.logger.warn(`Skipping function ${fnName}: No CREATE FUNCTION statement found`);
                }
                continue;
              }

              const cleanStatement = self.convertKeywordsToUppercase(createStatement);

              // Write to file (keep for CLI/git)
              self.appendDDL(
                dbConfig.envName,
                ddlFolderPath,
                FUNCTIONS,
                fnName,
                cleanStatement,
              );

              // NEW: Collect data
              exportedData.push({
                name: fnName,
                ddl: cleanStatement
              });
            } catch (fnError) {
              if (global.logger) {
                global.logger.error(`Error exporting function ${fnName}:`, fnError.message);
              }
            }
          }

          // NEW: Save to Storage (if available)
          if (self.storage) {
            await self.storage.saveExport(
              dbConfig.envName,
              self.getDBName(dbConfig.envName),
              FUNCTIONS,
              exportedData,
              !specificName
            );
          }

          // NEW: Return both count and data
          return resolve({
            count: functionResults.length,
            data: exportedData
          });
        }
      );
    });
  }

  /**
   * This file contains a function to export procedures from a database connection.
   * @param {*} connection - The database connection.
   * @param {*} dbConfig - The database configuration.
   * @returns {Promise<number>} - A promise that resolves to the number of procedures exported.
   */
  async exportProcedures(connection, dbConfig, specificName = null) {
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, PROCEDURES, specificName);

      // Query the database for procedure information
      const procedureQuery = specificName
        ? `SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?`
        : "SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?)";
      const queryParams = specificName ? [dbConfig.database, specificName] : [dbConfig.database];

      connection.query(
        procedureQuery,
        queryParams,
        async (err, procedureResults) => {
          if (err) {
            if (global.logger) global.logger.error("Error retrieving procedures: ", err);
            connection.end();
            reject(err);
            return;
          }

          if (!specificName) {
            await this.appendReport(dbConfig.envName, {
              procedures_total: procedureResults.length,
            });
          }

          // NEW: Collect exported data
          const exportedData = [];

          for (const row of procedureResults) {
            const spName = row.Name || row.name || Object.values(row)[1];
            const query = `SHOW CREATE PROCEDURE \`${spName}\``;

            try {
              const result = await util
                .promisify(connection.query)
                .call(connection, query);

              const createStatement = result[0]["Create Procedure"];

              if (!createStatement) {
                if (global.logger) {
                  global.logger.warn(`Skipping procedure ${spName}: No CREATE PROCEDURE statement found`);
                }
                continue;
              }

              const cleanStatement = this.convertKeywordsToUppercase(createStatement);

              // Write to file (keep for CLI/git)
              this.appendDDL(
                dbConfig.envName,
                ddlFolderPath,
                PROCEDURES,
                spName,
                cleanStatement,
              );

              // NEW: Collect data
              exportedData.push({
                name: spName,
                ddl: cleanStatement
              });
            } catch (spError) {
              if (global.logger) {
                global.logger.error(`Error exporting procedure ${spName}:`, spError.message);
              }
            }
          }

          // NEW: Save to Storage (if available)
          if (this.storage) {
            await this.storage.saveExport(
              dbConfig.envName,
              this.getDBName(dbConfig.envName),
              PROCEDURES,
              exportedData,
              !specificName
            );
          }

          // NEW: Return both count and data
          return resolve({
            count: procedureResults.length,
            data: exportedData
          });
        },
      );
    });
  }

  /**
   * @param {*} connection
   * @returns
   */
  async exportViews(connection, dbConfig, specificName = null) {
    return new Promise((resolve, reject) => {
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, 'views', specificName);
      const viewQuery = specificName
        ? `SHOW FULL TABLES WHERE Table_type = 'VIEW' AND \`Tables_in_${dbConfig.database}\` = ?`
        : "SHOW FULL TABLES WHERE Table_type = 'VIEW'";
      const queryParams = specificName ? [specificName] : [];

      connection.query(viewQuery, queryParams, async (err, viewResults) => {
        if (err) {
          if (global.logger) global.logger.error("Error retrieving views: ", err);
          connection.end();
          reject(err);
          return;
        }

        try {
          if (!specificName) {
            await this.appendReport(dbConfig.envName, { views_total: viewResults.length });
          }
          const exportedData = [];

          for (const row of viewResults) {
            const viewName = Object.values(row)[0];
            const query = `SHOW CREATE VIEW \`${viewName}\``;

            try {
              const result = await util.promisify(connection.query).call(connection, query);
              const createStatement = result[0]["Create View"];
              const cleanStatement = this.convertKeywordsToUppercase(createStatement);

              this.appendDDL(dbConfig.envName, ddlFolderPath, 'views', viewName, cleanStatement);
              exportedData.push({ name: viewName, ddl: cleanStatement });
            } catch (viewError) {
              if (global.logger) global.logger.error(`Error exporting view ${viewName}:`, viewError);
            }
          }

          if (this.storage) {
            await this.storage.saveExport(dbConfig.envName, this.getDBName(dbConfig.envName), 'views', exportedData, !specificName);
          }

          return resolve({ count: viewResults.length, data: exportedData });
        } catch (error) {
          if (global.logger) global.logger.error("Error in exportViews:", error);
          return reject(error);
        }
      });
    });
  }

  async exportTables(connection, dbConfig, specificName = null) {
    return new Promise((resolve, reject) => {
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, TABLES, specificName);
      const tableQuery = specificName
        ? `SHOW TABLES LIKE ?`
        : "SHOW TABLES";
      const queryParams = specificName ? [specificName] : [];

      connection.query(tableQuery, queryParams, async (err, tableResults) => {
        if (err) {
          if (global.logger) global.logger.error("Error retrieving tables: ", err);
          connection.end();
          reject(err);
          return;
        }

        try {
          if (!specificName) {
            await this.appendReport(dbConfig.envName, {
              tables_total: tableResults.length,
            });
          }

          // NEW: Collect exported data
          const exportedData = [];

          // Export tables to separate files
          for (const row of tableResults) {
            const tableName = Object.values(row)[0];
            const query = `SHOW CREATE TABLE \`${tableName}\``;

            try {
              const result = await util
                .promisify(connection.query)
                .call(connection, query);

              // Validate result
              if (!result || !result[0]) {
                if (global.logger) {
                  global.logger.error(`Empty result for table: ${tableName}`);
                }
                continue;
              }

              const createStatement = result[0]["Create Table"];

              // Validate createStatement
              if (!createStatement) {
                // This is likely a VIEW, not a TABLE - skip it
                if (global.logger && result[0]['Create View']) {
                  global.logger.warn(`Skipping VIEW: ${tableName} (use export views command for views)`);
                } else if (global.logger) {
                  global.logger.error(`No "Create Table" in result for: ${tableName}`);
                  global.logger.error('Result keys:', Object.keys(result[0]));
                }
                continue;
              }

              const rmvAIregex = /AUTO_INCREMENT=\d+\s/;
              const cleanStatement = createStatement.replace(rmvAIregex, "");

              // Write to file (keep for CLI/git)
              this.appendDDL(
                dbConfig.envName,
                ddlFolderPath,
                TABLES,
                tableName,
                cleanStatement,
              );

              // NEW: Collect data
              exportedData.push({
                name: tableName,
                ddl: cleanStatement
              });
            } catch (tableError) {
              if (global.logger) {
                global.logger.error(`Error exporting table ${tableName}:`, tableError);
              }
              // Continue with next table
            }
          }

          // NEW: Save to Storage (if available)
          if (this.storage) {
            await this.storage.saveExport(
              dbConfig.envName,
              this.getDBName(dbConfig.envName),
              TABLES,
              exportedData,
              !specificName
            );
          }

          // NEW: Return both count and data
          return resolve({
            count: tableResults.length,
            data: exportedData
          });
        } catch (error) {
          if (global.logger) {
            global.logger.error("Error in exportTables:", error);
          }
          return reject(error);
        }
      });
    });
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
   * This function converts keywords in a query to uppercase.
   * It takes a query as input and returns the converted query with uppercase keywords.
   * Certain keywords are excluded from conversion, such as GROUP and USER, which are converted to lowercase.
   * The function also removes unnecessary characters and replaces tabs with spaces.
   */
  convertKeywordsToUppercase(query) {
    const keywords = [
      ...new Set([
        "ACCESSIBLE", "ADD", "ALL", "ALTER", "ANALYZE", "AND", "AS", "ASC", "ASENSITIVE", "BEFORE", "BETWEEN", "BIGINT", "BINARY", "BLOB", "BOTH", "BY", "CALL",
        "CASCADE", "CASE", "CHANGE", "CHAR", "CHARACTER", "CHECK", "COLLATE", "COLUMN", "CONDITION", "CONSTRAINT", "CONTINUE", "CONVERT", "CREATE", "CROSS",
        "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "CURRENT_USER", "CURSOR", "DATABASE", "DATABASES", "DAY_HOUR", "DAY_MICROSECOND", "DAY_MINUTE",
        "DAY_SECOND", "DEC", "DECIMAL", "DECLARE", "DEFAULT", "DELAYED", "DELETE", "DESC", "DESCRIBE", "DETERMINISTIC", "DISTINCT", "DISTINCTROW", "DIV", "DOUBLE",
        "DROP", "DUAL", "EACH", "ELSE", "ELSEIF", "ENCLOSED", "ESCAPED", "EXISTS", "EXIT", "EXPLAIN", "FALSE", "FETCH", "FLOAT", "FLOAT4", "FLOAT8", "FORCE",
        "FOREIGN", "FROM", "FULLTEXT", "GENERATED", "GET", "GRANT", "GROUP", "HAVING", "HIGH_PRIORITY", "HOUR_MICROSECOND", "HOUR_MINUTE", "HOUR_SECOND", "IF",
        "IGNORE", "IGNORE_SERVER_IDS", "IN", "INDEX", "INFILE", "INNER", "INOUT", "INSENSITIVE", "INSERT", "INT", "INT1", "INT2", "INT3", "INT4", "INT8", "INTEGER", "INTERVAL",
        "INTO", "IO_AFTER_GTIDS", "IO_BEFORE_GTIDS", "IS", "ITERATE", "JOIN", "KEY", "KEYS", "KILL", "LEADING", "LEAVE", "LEFT", "LIKE", "LIMIT", "LINEAR", "LINES", "LOAD",
        "LOCALTIME", "LOCALTIMESTAMP", "LOCK", "LONG", "LONGBLOB", "LONGTEXT", "LOOP", "LOW_PRIORITY", "MASTER_BIND", "MASTER_SSL_VERIFY_SERVER_CERT", "MATCH", "MAXVALUE",
        "MEDIUMBLOB", "MEDIUMINT", "MEDIUMTEXT", "MIDDLEINT", "MINUTE_MICROSECOND", "MINUTE_SECOND", "MOD", "MODIFIES", "NATURAL", "NOT", "NO_WRITE_TO_BINLOG", "NULL", "NUMERIC",
        "ON", "OPTIMIZE", "OPTION", "OPTIONALLY", "OR", "ORDER", "OUT", "OUTER", "OUTFILE", "PARTITION", "PRECISION", "PRIMARY", "PROCEDURE", "PURGE", "RANGE", "READ", "READS",
        "READ_WRITE", "REAL", "REFERENCES", "REGEXP", "RELEASE", "RENAME", "REPEAT", "REPLACE", "REQUIRE", "RESIGNAL", "RESTRICT", "RETURN", "REVOKE", "RIGHT", "RLIKE", "SCHEMA",
        "SCHEMAS", "SECOND_MICROSECOND", "SELECT", "SENSITIVE", "SEPARATOR", "SET", "SHOW", "SIGNAL", "SMALLINT", "SPATIAL", "SPECIFIC", "SQL", "SQLEXCEPTION", "SQLSTATE",
        "SQLWARNING", "SQL_BIG_RESULT", "SQL_CALC_FOUND_ROWS", "SQL_SMALL_RESULT", "SSL", "STARTING", "STORED", "STRAIGHT_JOIN", "TABLE", "TERMINATED", "TEXT", "THEN",
        "TINYBLOB", "TINYINT", "TINYTEXT", "TO", "TRAILING", "TRIGGER", "TRUE", "UNDO", "UNION", "UNIQUE", "UNLOCK", "UNSIGNED", "UPDATE", "USAGE", "USE", "USING",
        "UTC_DATE", "UTC_TIME", "UTC_TIMESTAMP", "VALUES", "VARBINARY", "VARCHAR", "VARCHARACTER", "VARYING", "VIRTUAL", "WHEN", "WHERE", "WHILE", "WITH", "WRITE",
        "XOR", "YEAR_MONTH", "ZEROFILL", "END", "OPEN", "CLOSE", "DUPLICATE", "COALESCE",
      ]),
    ];
    // Split the query into individual words
    const words = query.split(/\b/);
    // Convert keywords to uppercase
    const convertedQuery = words
      .map((word) =>
        keywords.includes(word.toUpperCase()) ? word.toUpperCase() : word,
      )
      .join("")
      .replace(/\`(GROUP|USER|GROUPS)\`/g, (match, p1) => `\`${p1.toLowerCase()}\``)
      .replace(/\t/g, "  ")
      .replace(/\sDEFINER=`[^`]+`@`[^`]+`\s/g, " ");
    return convertedQuery;
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

      // Create a MySQL connection
      const connection = mysql.createConnection({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
      });


      // Connect to the MySQL server - use Promise wrapper
      return new Promise((resolve, reject) => {
        connection.connect(async (err) => {
          if (err) {
            if (global.logger) {
              global.logger.error("Error connecting to the database: ", err);
            }
            reject(new Error(`Database connection failed: ${err.message}`));
            return;
          }

          try {
            // Retrieve the list of DDL
            let result;
            switch (ddl) {
              case TABLES:
                result = await this.exportTables(connection, dbConfig, specificName);
                break;
              case VIEWS:
                result = await this.exportViews(connection, dbConfig, specificName);
                break;
              case FUNCTIONS:
                result = await this.exportFunctions(connection, dbConfig, specificName);
                break;
              case PROCEDURES:
                result = await this.exportProcedures(connection, dbConfig, specificName);
                break;
              case TRIGGERS:
                result = await this.exportTriggers(connection, dbConfig, specificName);
                break;
            }

            // Close the MySQL connection
            connection.end();

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
