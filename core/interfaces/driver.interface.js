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
   * Get the DDL Generator for this driver
   * @returns {IDDLGenerator} Service to generate CREATE/ALTER statements
   */
  getDDLGenerator() {
    throw new Error('Method getDDLGenerator() not implemented');
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
}

module.exports = {
  IDatabaseDriver,
  IIntrospectionService
};
