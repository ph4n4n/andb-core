const mysql = require('mysql2');
const util = require('util');
const { IDatabaseDriver, IIntrospectionService, IMonitoringService } = require('../../interfaces/driver.interface');


class MySQLDriver extends IDatabaseDriver {
  constructor(config) {
    super(config);
    this.connection = null;
  }

  async connect() {
    this.connection = mysql.createConnection({
      host: this.config.host === 'localhost' ? '127.0.0.1' : this.config.host,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      port: this.config.port,
      multipleStatements: true
    });

    return new Promise((resolve, reject) => {
      this.connection.connect(async (err) => {
        if (err) return reject(new Error(`MySQL Connection failed: ${err.message}`));

        // Session hygiene
        try {
          // Ensure consistent environment
          await this.query("SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
          await this.query("SET NAMES 'utf8mb4'");
        } catch (e) {
          // warn but continue
          if (global.logger) global.logger.warn('Failed to set session variables', e);
        }

        resolve();
      });
    });
  }

  async disconnect() {
    if (this.connection) {
      return new Promise((resolve) => {
        try {
          this.connection.end(err => {
            if (err) {
              // If end() complains (e.g. already closed), ensuring it's destroyed is enough
              this.connection.destroy();
            }
            resolve();
          });
        } catch (e) {
          // Sync error (e.g. connection already closed)
          this.connection.destroy();
          resolve();
        }
      });
    }
  }

  async query(sql, params = []) {
    if (!this.connection) await this.connect();
    return util.promisify(this.connection.query).call(this.connection, sql, params);
  }

  getIntrospectionService() {
    return new MySQLIntrospectionService(this);
  }

  getMonitoringService() {
    return new MySQLMonitoringService(this);
  }

  getDDLParser() {
    if (!this.parser) {
      const MySQLParser = require('./MySQLParser');
      this.parser = new MySQLParser();
    }
    return this.parser;
  }

  getDDLGenerator() {
    if (!this.generator) {
      const MySQLGenerator = require('./MySQLGenerator');
      this.generator = new MySQLGenerator();
    }
    return this.generator;
  }

  async getSessionContext() {
    const results = await this.query(`
      SELECT 
        @@session.sql_mode as sql_mode,
        @@session.time_zone as time_zone,
        @@session.wait_timeout as lock_wait_timeout,
        @@session.character_set_results as charset
    `);
    return results[0];
  }

  /**
   * Enable or disable foreign key checks for the current session
   * @param {boolean} enabled 
   */
  async setForeignKeyChecks(enabled) {
    const value = enabled ? 1 : 0;
    await this.query(`SET FOREIGN_KEY_CHECKS = ${value};`);
  }
}

class MySQLIntrospectionService extends IIntrospectionService {
  constructor(driver) {
    super(driver);
    this.parser = driver.getDDLParser();
  }
  async listTables(dbName, pattern = null) {
    const sql = pattern ? "SHOW TABLES LIKE ?" : "SHOW TABLES";
    const params = pattern ? [pattern] : [];
    const results = await this.driver.query(sql, params);
    return results.map(row => Object.values(row)[0]);
  }

  async listViews(dbName, pattern = null) {
    const sql = pattern
      ? `SHOW FULL TABLES WHERE Table_type = 'VIEW' AND \`Tables_in_${dbName}\` = ?`
      : "SHOW FULL TABLES WHERE Table_type = 'VIEW'";
    const params = pattern ? [pattern] : [];
    const results = await this.driver.query(sql, params);
    return results.map(row => Object.values(row)[0]);
  }

  async listProcedures(dbName, pattern = null) {
    const sql = pattern
      ? "SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?"
      : "SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?)";
    const params = pattern ? [dbName, pattern] : [dbName];
    const results = await this.driver.query(sql, params);
    return results.map(row => row.Name);
  }

  async listFunctions(dbName, pattern = null) {
    const sql = pattern
      ? "SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?) AND Name = ?"
      : "SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?)";
    const params = pattern ? [dbName, pattern] : [dbName];
    const results = await this.driver.query(sql, params);
    return results.map(row => row.Name);
  }

  async listTriggers(dbName, pattern = null) {
    const sql = pattern ? `SHOW TRIGGERS LIKE '${pattern}'` : "SHOW TRIGGERS";
    const results = await this.driver.query(sql); // MySQL's SHOW TRIGGERS doesn't support binding nicely for LIKE in all versions, but keeping simple
    return results.map(row => row.Trigger);
  }

  async listEvents(dbName, pattern = null) {
    const sql = pattern
      ? "SHOW EVENTS WHERE Db = ? AND Name = ?"
      : "SHOW EVENTS WHERE Db = ?";
    const params = pattern ? [dbName, pattern] : [dbName];
    const results = await this.driver.query(sql, params);
    return results.map(row => row.Name);
  }

  // --- DDL Retrieval ---

  async getTableDDL(dbName, tableName) {
    const result = await this.driver.query(`SHOW CREATE TABLE \`${tableName}\``);
    if (!result || !result[0]) return null;

    // Check if it's actually a view
    if (result[0]['Create View']) return null;

    let ddl = result[0]['Create Table'];
    // Cleanup Auto Increment
    ddl = ddl.replace(/AUTO_INCREMENT=\d+\s/, "");
    return this._normalizeDDL(ddl);
  }

  async getViewDDL(dbName, viewName) {
    const result = await this.driver.query(`SHOW CREATE VIEW \`${viewName}\``);
    if (!result || !result[0]) return null;
    return this._normalizeDDL(result[0]['Create View']);
  }

  async getProcedureDDL(dbName, procName) {
    const result = await this.driver.query(`SHOW CREATE PROCEDURE \`${procName}\``);
    if (!result || !result[0]) return null;
    return this._normalizeDDL(result[0]['Create Procedure']);
  }

  async getFunctionDDL(dbName, funcName) {
    const result = await this.driver.query(`SHOW CREATE FUNCTION \`${funcName}\``);
    if (!result || !result[0]) return null;
    return this._normalizeDDL(result[0]['Create Function']);
  }

  async getTriggerDDL(dbName, triggerName) {
    const result = await this.driver.query(`SHOW CREATE TRIGGER \`${triggerName}\``);
    if (!result || !result[0]) return null;
    let ddl = result[0]['SQL Original Statement'];

    // Trigger cleanup
    ddl = ddl.replace(/\sDEFINER=`[^`]+`@`[^`]+`\s/g, " ")
      .replace(/\sCOLLATE\s+\w+\s/, " ")
      .replace(/\sCHARSET\s+\w+\s/, " ");

    return this._normalizeDDL(ddl);
  }

  async getEventDDL(dbName, eventName) {
    const result = await this.driver.query(`SHOW CREATE EVENT \`${eventName}\``);
    if (!result || !result[0]) return null;
    return this._normalizeDDL(result[0]['Create Event']);
  }

  // Helper to normalize DDL using Driver's parser
  _normalizeDDL(ddl) {
    if (!ddl) return null;
    return this.parser.clean(ddl);
  }

  async getChecksums(dbName) {
    // Basic implementation for MySQL using table status
    const results = await this.driver.query(`
      SELECT TABLE_NAME, CHECKSUM, UPDATE_TIME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [dbName]);
    return results;
  }
}

class MySQLMonitoringService extends IMonitoringService {
  async getProcessList() {
    return this.driver.query('SHOW FULL PROCESSLIST');
  }

  async getStatus() {
    return this.driver.query('SHOW STATUS');
  }

  async getVariables() {
    return this.driver.query('SHOW VARIABLES');
  }

  async getVersion() {
    const result = await this.driver.query('SELECT VERSION() AS version');
    return result[0].version;
  }

  async getConnections() {
    return this.driver.query(`
      SELECT COUNT(*) connections, pl.* 
        FROM information_schema.PROCESSLIST pl
       GROUP BY pl.user
       ORDER BY 1 DESC;
    `);
  }

  async getTransactions() {
    return this.driver.query(`
      SELECT * 
        FROM information_schema.innodb_trx 
       WHERE trx_state IS NOT NULL;
    `);
  }
}

module.exports = MySQLDriver;
