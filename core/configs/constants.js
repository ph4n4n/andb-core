/**
 * @anph/core Constants Configuration
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Application constants and configuration
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */

/**
 * @module constants
 * @description This module contains all the constants used in the application.
 */
exports.REPORT = 'report';


/**
 * All types of DDLs supported by the application
 */
exports.DDL = {
  TABLES: 'tables',
  FUNCTIONS: 'functions',
  PROCEDURES: 'procedures',
  TRIGGERS: 'triggers',
  VIEWS: 'views',
};

/**
 * All state of the DDLs to help monitor the changes
 */
exports.STATUSES = {
  NEW: 'new',
  UPDATED: 'updated',
  DEPRECATED: 'deprecated',
  SEEDING: 'seeding',
  OTE: 'ote',
};

/**
 * Domain normalization configuration for DDL comparison
 * Used to normalize domain names across different environments
 */
exports.DOMAIN_NORMALIZATION = {
  // Default: Match nothing (no-op)
  // Override this in andb.yaml or andb.config.js
  pattern: /(?!)/,
  replacement: ''
};
