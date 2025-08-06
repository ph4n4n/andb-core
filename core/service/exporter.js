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
  DDL: { TRIGGERS, TABLES, PROCEDURES, FUNCTIONS }
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
  makeDDLFolderReady(dbPath, DDL) {
    const ddLFolderPath = `${dbPath}/${DDL}`;
    // 1. get folder ready
    this.fileManager.makeSureFolderExisted(ddLFolderPath);
    this.fileManager.makeSureFolderExisted(`${dbPath}/current-ddl`);
    // 2. clean current ddl list
    this.fileManager.emptyDirectory(ddLFolderPath);
    this.fileManager.saveToFile(`${dbPath}/current-ddl`, `${DDL}.list`, "");
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
  async exportTriggers(connection, dbConfig) {
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, TRIGGERS);
      // Query the database for trigger information
      const triggerQuery = "SHOW TRIGGERS";
      connection.query(triggerQuery, async (err, triggerResults) => {
        if (err) {
          alog.error("Error retrieving triggers: ", err);
          connection.end();
          reject(err);
          return;
        }
        // Append the number of triggers to the report
        await this.appendReport(dbConfig.envName, {
          triggers_total: triggerResults.length,
        });

        // Export triggers to separate files
        for (const row of triggerResults) {
          const triggerName = row.Trigger;
          const query = `SHOW CREATE TRIGGER \`${triggerName}\``;
          try {
            const result = await util.promisify(connection.query).call(connection, query);
            const createStatement = result[0]["SQL Original Statement"];

            // Format trigger definition
            const formattedStatement = this.convertKeywordsToUppercase(createStatement)
              .replace(/\sDEFINER=`.+`@`(%|.+%)`\s/, " ")
              .replace(/\sCOLLATE\s+\w+\s/, " ")
              .replace(/\sCHARSET\s+\w+\s/, " ");

            this.appendDDL(dbConfig.envName, ddlFolderPath, TRIGGERS, triggerName, formattedStatement);
          } catch (error) {
            alog.error(`Error exporting trigger ${triggerName}:`, error);
          }
        }
        return resolve(triggerResults.length);
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
  async exportFunctions(connection, dbConfig) {
    const self = this;
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${self.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = self.makeDDLFolderReady(dbPath, FUNCTIONS);
      // Query the database for function information
      const functionQuery = "SHOW FUNCTION STATUS WHERE Db = ?";
      connection.query(
        functionQuery,
        [dbConfig.database],
        async function (err, functionResults) {
          if (err) {
            alog.error("Error retrieving functions: ", err);
            connection.end();
            reject(err);
            return;
          }
          //
          await self.appendReport(dbConfig.envName, {
            functions_total: functionResults.length,
          });
          // Export functions to separate files
          for (const row of functionResults) {
            const fnName = row.Name;
            const query = `SHOW CREATE FUNCTION ${fnName}`;
            const result = await util
              .promisify(connection.query)
              .call(connection, query);
            const createStatement = result[0]["Create Function"];
            self.appendDDL(
              dbConfig.envName,
              ddlFolderPath,
              FUNCTIONS,
              fnName,
              self.convertKeywordsToUppercase(createStatement),
            );
          }
          return resolve(functionResults.length);
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
  async exportProcedures(connection, dbConfig) {
    return new Promise((resolve, reject) => {
      // Retrieve the database path and prepare the DDL folder
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, PROCEDURES);

      // Query the database for procedure information
      const procedureQuery = "SHOW PROCEDURE STATUS WHERE Db = ?";
      connection.query(
        procedureQuery,
        [dbConfig.database],
        async (err, procedureResults) => {
          if (err) {
            alog.error("Error retrieving procedures: ", err);
            connection.end();
            reject(err);
            return;
          }

          // Append the number of procedures to the report
          await this.appendReport(dbConfig.envName, {
            procedures_total: procedureResults.length,
          });

          // Export procedures to separate files
          for (const row of procedureResults) {
            const spName = row.Name;
            const query = `SHOW CREATE PROCEDURE ${spName}`;
            const result = await util
              .promisify(connection.query)
              .call(connection, query);
            const createStatement = result[0]["Create Procedure"];
            this.appendDDL(
              dbConfig.envName,
              ddlFolderPath,
              PROCEDURES,
              spName,
              this.convertKeywordsToUppercase(createStatement),
            );
          }
          return resolve(procedureResults.length);
        },
      );
    });
  }

  /**
   * @param {*} connection
   * @returns
   */
  async exportTables(connection, dbConfig) {
    return new Promise((resolve, reject) => {
      const dbPath = `db/${dbConfig.envName}/${this.getDBName(dbConfig.envName)}`;
      const ddlFolderPath = this.makeDDLFolderReady(dbPath, TABLES);
      const tableQuery = "SHOW TABLES";
      connection.query(tableQuery, async (err, tableResults) => {
        if (err) {
          alog.error("Error retrieving tables: ", err);
          connection.end();
          reject(err);
          return;
        }
        //
        await this.appendReport(dbConfig.envName, {
          tables_total: tableResults.length,
        });
        // Export tables to separate files
        for (const row of tableResults) {
          const tableName = Object.values(row)[0];
          const query = `SHOW CREATE TABLE \`${tableName}\``;
          const result = await util
            .promisify(connection.query)
            .call(connection, query);
          const createStatement = result[0]["Create Table"];
          const rmvAIregex = /AUTO_INCREMENT=\d+\s/;
          this.appendDDL(
            dbConfig.envName,
            ddlFolderPath,
            TABLES,
            tableName,
            createStatement.replace(rmvAIregex, ""),
          );
        }
        return resolve(tableResults.length);
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
      .replace(/\sDEFINER=`.+`@`(%|.+%)`\s/, " ");
    return convertedQuery;
  }

  /**
   * Exporter function that exports the specified DDL (Data Definition Language) from a MySQL database.
   *
   * @param {string} ddl - The type of DDL to export (e.g., TABLES, FUNCTIONS, PROCEDURES).
   * @returns {Function} - An async function that takes an environment object and exports the DDL.
   */
  export(ddl) {
    return async (env) => {
      alog.warn(`Start exporting ${ddl} changes for...`, env);
      const labelTime = `..exported from ${env}.${this.getDBName(env)} success in:`;
      const dbConfig = this.getDBDestination(env);
      // Create a MySQL connection
      const connection = mysql.createConnection({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
      });
      // Connect to the MySQL server
      connection.connect(async (err) => {
        console.time(labelTime);
        if (err) {
          alog.error("Error connecting to the database: ", err);
          process.exit(1);
        }
        // Retrieve the list of DDL
        let rs;
        switch (ddl) {
          case TABLES:
            rs = await this.exportTables(connection, dbConfig);
            break;
          case FUNCTIONS:
            rs = await this.exportFunctions(connection, dbConfig);
            break;
          case PROCEDURES:
            rs = await this.exportProcedures(connection, dbConfig);
            break;
          case TRIGGERS:
            rs = await this.exportTriggers(connection, dbConfig);
            break;
        }
        // Close the MySQL connection
        connection.end();
        alog.info(`\nThere are ${rs} ${ddl} have been..`);
        console.timeEnd(labelTime);
      });
    };
  }
}
