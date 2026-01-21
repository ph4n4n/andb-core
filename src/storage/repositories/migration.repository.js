const BaseRepository = require('./base.repository');
const MigrationEntity = require('../entities/migration.entity');
const { TABLES, COLUMNS } = require('../schema');

const T = TABLES.MIGRATION_HISTORY;
const C = COLUMNS[T];

class MigrationRepository extends BaseRepository {
  /**
   * Saves a migration history record.
   * Standardizes incoming data before insertion.
   */
  async save(migration) {
    const data = {
      src_environment: migration.srcEnv || migration.src_environment,
      dest_environment: migration.destEnv || migration.dest_environment,
      database_name: migration.database || migration.database_name,
      ddl_type: migration.type || migration.ddl_type,
      ddl_name: migration.name || migration.ddl_name,
      operation: migration.operation,
      status: migration.status,
      error_message: migration.error || migration.error_message
    };

    const sEnv = this.normalize(data.src_environment);
    const dEnv = this.normalize(data.dest_environment);
    const ddlType = this.normalize(data.ddl_type);

    const stmt = this.prepare(`
      INSERT INTO ${T} (
        ${C.SRC_ENVIRONMENT}, ${C.DEST_ENVIRONMENT}, ${C.DATABASE_NAME}, 
        ${C.DDL_TYPE}, ${C.DDL_NAME}, ${C.OPERATION}, ${C.STATUS}, ${C.ERROR_MESSAGE}
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(sEnv, dEnv, data.database_name, ddlType, data.ddl_name, data.operation, data.status, data.error_message || null);
    return true;
  }

  async list(limit = 100) {
    const stmt = this.prepare(`
      SELECT * FROM ${T} 
      ORDER BY ${C.EXECUTED_AT} DESC 
      LIMIT ?
    `);
    const results = stmt.all(limit);
    return results.map(r => MigrationEntity.fromRow(r));
  }

  async deleteAll() {
    return this.prepare(`DELETE FROM ${T}`).run();
  }
}

module.exports = MigrationRepository;
