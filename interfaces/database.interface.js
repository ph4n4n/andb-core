/**
 * @anph/core Database Interfaces
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Database service and configuration interfaces
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */
/**
 * Database service interface
 * @interface
 */
class IDatabaseService {
  /**
   * Get database destination configuration
   * @param {string} env - Environment name
   * @param {boolean} mail - Whether to get mail database
   * @returns {DatabaseConfig|undefined} Database configuration object
   */
  getDBDestination(env, mail = false) {
    throw new Error('Method not implemented');
  }

  /**
   * Get source environment for migration
   * @param {string} envName - Current environment name
   * @returns {string} Source environment name
   */
  getSourceEnv(envName) {
    throw new Error('Method not implemented');
  }

  /**
   * Get destination environment for migration
   * @param {string} env - Current environment
   * @returns {string} Destination environment name
   */
  getDestEnv(env) {
    throw new Error('Method not implemented');
  }

  /**
   * Get database name for environment
   * @param {string} env - Environment name
   * @param {boolean} isDbMail - Whether to get mail database name
   * @returns {string} Database name
   */
  getDBName(env, isDbMail = false) {
    throw new Error('Method not implemented');
  }

  /**
   * Replace domain in DDL based on destination environment
   * @param {string} ddl - DDL string
   * @param {string} destEnv - Destination environment
   * @returns {string} Modified DDL string
   */
  replaceWithEnv(ddl, destEnv) {
    throw new Error('Method not implemented');
  }
}

/**
 * Database configuration interface
 * @interface
 */
class IDatabaseConfig {
  /**
   * Get all database functions
   * @returns {DatabaseFunctions} Database functions object
   */
  static get databaseFunctions() {
    throw new Error('Method not implemented');
  }
}

module.exports = {
  IDatabaseService,
  IDatabaseConfig
};