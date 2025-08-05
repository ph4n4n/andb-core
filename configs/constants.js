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
