/**
 * @anph/core Database Driver Interface
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Standard interface for all database drivers (MySQL, PG, etc.)
 */

class IDatabaseDriver {
  /**
   * Initialize driver with configuration
   * @param {Object} config - Database connection configuration
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * Connect to the database
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('Method connect() not implemented');
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('Method disconnect() not implemented');
  }

  /**
   * Execute a raw query
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query results
   */
  async query(sql, params = []) {
    throw new Error('Method query() not implemented');
  }

  /**
   * Get the Introspection Service for this driver
   * @returns {IIntrospectionService} Service to list tables, get DDLs, etc.
   */
  getIntrospectionService() {
    throw new Error('Method getIntrospectionService() not implemented');
  }

  /**
  * Get the DDL Parser for this driver
  * @returns {IDDLParser} Service to normalize/parse SQL
  */
  getDDLParser() {
    throw new Error('Method getDDLParser() not implemented');
  }

  /**
   * Get the DDL Generator for this driver
   * @returns {IDDLGenerator} Service to generate CREATE/ALTER statements
   */
  getDDLGenerator() {
    throw new Error('Method getDDLGenerator() not implemented');
  }

  /**
   * Get the Monitoring Service for this driver
   * @returns {IMonitoringService} Service to get DB status/metrics
   */
  getMonitoringService() {
    throw new Error('Method getMonitoringService() not implemented');
  }

  /**
   * Get the session context (sql_mode, time_zone, etc.)
   * @returns {Promise<Object>}
   */
  async getSessionContext() {
    throw new Error('Method getSessionContext() not implemented');
  }

  /**
   * Enable or disable foreign key checks for the current session
   * @param {boolean} enabled 
   * @returns {Promise<void>}
   */
  async setForeignKeyChecks(enabled) {
    throw new Error('Method setForeignKeyChecks() not implemented');
  }
}

class IIntrospectionService {
  /**
   * @param {IDatabaseDriver} driver 
   */
  constructor(driver) {
    this.driver = driver;
  }

  async listTables(dbName) { throw new Error('Not implemented'); }
  async listViews(dbName) { throw new Error('Not implemented'); }
  async listProcedures(dbName) { throw new Error('Not implemented'); }
  async listFunctions(dbName) { throw new Error('Not implemented'); }
  async listTriggers(dbName) { throw new Error('Not implemented'); }
  async listEvents(dbName) { throw new Error('Not implemented'); }

  async getTableDDL(dbName, tableName) { throw new Error('Not implemented'); }
  async getViewDDL(dbName, viewName) { throw new Error('Not implemented'); }
  async getProcedureDDL(dbName, procName) { throw new Error('Not implemented'); }
  async getFunctionDDL(dbName, funcName) { throw new Error('Not implemented'); }
  async getTriggerDDL(dbName, triggerName) { throw new Error('Not implemented'); }
  async getEventDDL(dbName, eventName) { throw new Error('Not implemented'); }

  /**
   * Get checksums for all objects in a database
   * @param {string} dbName 
   */
  async getChecksums(dbName) { throw new Error('Not implemented'); }
}

class IMonitoringService {
  /**
   * @param {IDatabaseDriver} driver 
   */
  constructor(driver) {
    this.driver = driver;
  }

  async getProcessList() { throw new Error('Not implemented'); }
  async getStatus() { throw new Error('Not implemented'); }
  async getVariables() { throw new Error('Not implemented'); }
  async getVersion() { throw new Error('Not implemented'); }
  async getConnections() { throw new Error('Not implemented'); }
  async getTransactions() { throw new Error('Not implemented'); }
}

module.exports = {
  IDatabaseDriver,
  IIntrospectionService,
  IMonitoringService
};
