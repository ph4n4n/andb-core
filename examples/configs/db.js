/**
 * Database configuration and utility functions
 * Implementation of database interface
 */

const andbCore = require('andb-core');
const { IDatabaseService, IDatabaseConfig } = andbCore.interfaces;

/**
 * Default environment constants
 * Each app can configure independently
 */
exports.ENVIRONMENTS = {
  DEV: 'DEV',
  PROD: 'PROD',
};

/**
 * Database service implementation
 * @implements {IDatabaseService}
 */
class DatabaseService extends IDatabaseService {
  /**
   * Get database destination configuration
   * @param {string} env - Environment name
   * @param {boolean} mail - Whether to get mail database
   * @returns {object|undefined} Database configuration object
   */
  getDBDestination(env, mail = false) {
    const allEnv = [
      {
        envName: exports.ENVIRONMENTS.DEV,
        host: process.env.DEV_DB_HOST || '',
        database: process.env.DEV_DB_NAME || '',
        user: process.env.DEV_DB_USERNAME || '',
        password: process.env.DEV_DB_PASSWORD || ''
      },
      {
        envName: exports.ENVIRONMENTS.PROD,
        host: process.env.PROD_DB_HOST || '',
        database: process.env.PROD_DB_NAME || '',
        user: process.env.PROD_DB_USERNAME || '',
        password: process.env.PROD_DB_PASSWORD || ''
      }
    ];

    return allEnv.find(({ envName }) => envName === env.toUpperCase());
  }

  /**
   * Get source environment for migration
   * @param {string} envName - Current environment name
   * @returns {string} Source environment name
   */
  getSourceEnv(envName) {
    if (envName === exports.ENVIRONMENTS.PROD) return exports.ENVIRONMENTS.DEV;
    return exports.ENVIRONMENTS.DEV;
  }

  /**
   * Get destination environment for migration
   * @param {string} env - Current environment
   * @returns {string} Destination environment name
   */
  getDestEnv(env) {
    if (env === exports.ENVIRONMENTS.DEV) return exports.ENVIRONMENTS.PROD;
    if (env === exports.ENVIRONMENTS.PROD) return exports.ENVIRONMENTS.PROD;
    return exports.ENVIRONMENTS.DEV;
  }

  /**
   * Get database name for environment
   * @param {string} env - Environment name
   * @param {boolean} isDbMail - Whether to get mail database name
   * @returns {string} Database name
   */
  getDBName(env, isDbMail = false) {
    if (isDbMail) {
      if (env === exports.ENVIRONMENTS.DEV) return process.env.DEV_DB_MAIL || '';
      if (env === exports.ENVIRONMENTS.PROD) return process.env.PROD_DB_MAIL || '';
    }
    if (env === exports.ENVIRONMENTS.DEV) return process.env.DEV_DB_NAME || '';
    if (env === exports.ENVIRONMENTS.PROD) return process.env.PROD_DB_NAME || '';
    return process.env.DEV_DB_NAME || '';
  }

  /**
   * Replace domain in DDL based on destination environment
   * @param {string} ddl - DDL string
   * @param {string} destEnv - Destination environment
   * @returns {string} Modified DDL string
   */
  replaceWithEnv(ddl, destEnv) {
    if (destEnv === exports.ENVIRONMENTS.PROD) {
      return ddl.replace(/@flodev.net/, '@flomail.net');
    }
    return ddl;
  }
}

/**
 * Database configuration implementation
 * @implements {IDatabaseConfig}
 */
class DatabaseConfig extends IDatabaseConfig {
  static get databaseFunctions() {
    const service = new DatabaseService();
    return {
      getDBDestination: service.getDBDestination.bind(service),
      getSourceEnv: service.getSourceEnv.bind(service),
      getDestEnv: service.getDestEnv.bind(service),
      getDBName: service.getDBName.bind(service),
      replaceWithEnv: service.replaceWithEnv.bind(service)
    };
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

/**
 * Export all database functions as a single object
 */
exports.databaseFunctions = DatabaseConfig.databaseFunctions;

// Export individual functions for backward compatibility
exports.getDBDestination = databaseService.getDBDestination.bind(databaseService);
exports.getSourceEnv = databaseService.getSourceEnv.bind(databaseService);
exports.getDestEnv = databaseService.getDestEnv.bind(databaseService);
exports.getDBName = databaseService.getDBName.bind(databaseService);
exports.replaceWithEnv = databaseService.replaceWithEnv.bind(databaseService);

// Export classes for dependency injection
exports.DatabaseService = DatabaseService;
exports.DatabaseConfig = DatabaseConfig; 