/**
 * @anph/core Storage Schema Constants
 */

const TABLES = {
  DDL_EXPORTS: 'ddl_exports',
  COMPARISONS: 'comparisons',
  DDL_SNAPSHOTS: 'ddl_snapshots',
  MIGRATION_HISTORY: 'migration_history',
  STORAGE_ACTIONS: 'storage_actions',
  METADATA: 'metadata'
};

const COLUMNS = {
  [TABLES.DDL_EXPORTS]: {
    ID: 'id',
    ENVIRONMENT: 'environment',
    DATABASE_NAME: 'database_name',
    DDL_TYPE: 'ddl_type',
    DDL_NAME: 'ddl_name',
    DDL_CONTENT: 'ddl_content',
    CHECKSUM: 'checksum',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at',
    EXPORTED_TO_FILE: 'exported_to_file'
  },
  [TABLES.COMPARISONS]: {
    ID: 'id',
    SRC_ENVIRONMENT: 'src_environment',
    DEST_ENVIRONMENT: 'dest_environment',
    DATABASE_NAME: 'database_name',
    DDL_TYPE: 'ddl_type',
    DDL_NAME: 'ddl_name',
    STATUS: 'status',
    ALTER_STATEMENTS: 'alter_statements',
    DIFF_SUMMARY: 'diff_summary',
    CREATED_AT: 'created_at',
    UPDATED_AT: 'updated_at'
  },
  [TABLES.DDL_SNAPSHOTS]: {
    ID: 'id',
    ENVIRONMENT: 'environment',
    DATABASE_NAME: 'database_name',
    DDL_TYPE: 'ddl_type',
    DDL_NAME: 'ddl_name',
    DDL_CONTENT: 'ddl_content',
    CHECKSUM: 'checksum',
    VERSION_TAG: 'version_tag',
    CREATED_AT: 'created_at'
  },
  [TABLES.MIGRATION_HISTORY]: {
    ID: 'id',
    SRC_ENVIRONMENT: 'src_environment',
    DEST_ENVIRONMENT: 'dest_environment',
    DATABASE_NAME: 'database_name',
    DDL_TYPE: 'ddl_type',
    DDL_NAME: 'ddl_name',
    OPERATION: 'operation',
    STATUS: 'status',
    ERROR_MESSAGE: 'error_message',
    EXECUTED_AT: 'executed_at'
  }
};

module.exports = {
  TABLES,
  COLUMNS
};
