const BaseRepository = require('./base.repository');
const ComparisonEntity = require('../entities/comparison.entity');
const { TABLES, COLUMNS } = require('../schema');

const T = TABLES.COMPARISONS;
const C = COLUMNS[T];

class ComparisonRepository extends BaseRepository {
  /**
   * Saves a comparison result.
   * Standardizes incoming data from various sources into the database schema.
   */
  async save(comparison) {
    // Standardize mapping from UI/Core format to Repository format
    const row = {
      src_environment: comparison.srcEnv || comparison.src_environment,
      dest_environment: comparison.destEnv || comparison.dest_environment,
      database_name: comparison.database || comparison.database_name,
      ddl_type: comparison.type || comparison.ddl_type,
      ddl_name: comparison.name || comparison.ddl_name,
      status: comparison.status,
      alter_statements: comparison.ddl || comparison.alterStatements || comparison.alter_statements,
      diff_summary: comparison.diffSummary || comparison.diff_summary
    };

    const sEnv = this.normalize(row.src_environment);
    const dEnv = this.normalize(row.dest_environment);
    const ddlType = this.normalize(row.ddl_type);

    const stmt = this.prepare(`
      INSERT INTO ${T} 
        (${C.SRC_ENVIRONMENT}, ${C.DEST_ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}, ${C.STATUS}, 
         ${C.ALTER_STATEMENTS}, ${C.DIFF_SUMMARY})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(${C.SRC_ENVIRONMENT}, ${C.DEST_ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME})
      DO UPDATE SET 
        ${C.STATUS} = excluded.${C.STATUS},
        ${C.ALTER_STATEMENTS} = excluded.${C.ALTER_STATEMENTS},
        ${C.DIFF_SUMMARY} = excluded.${C.DIFF_SUMMARY},
        updated_at = CURRENT_TIMESTAMP
    `);

    const alterJSON = row.alter_statements ?
      (typeof row.alter_statements === 'string' ? row.alter_statements : JSON.stringify(row.alter_statements)) :
      null;

    stmt.run(sEnv, dEnv, row.database_name, ddlType, row.ddl_name, row.status, alterJSON, row.diff_summary);
    return true;
  }

  /**
   * Finds comparisons between environments.
   * Returns standardized UI objects via ComparisonEntity.
   */
  async find(srcEnv, destEnv, database, type) {
    const sEnv = this.normalize(srcEnv);
    const dEnv = this.normalize(destEnv);
    const ddlType = this.normalize(type);

    const stmt = this.prepare(`
      SELECT * FROM ${T}
      WHERE ${C.SRC_ENVIRONMENT} = ? AND ${C.DEST_ENVIRONMENT} = ? 
        AND ${C.DATABASE_NAME} = ? AND ${C.DDL_TYPE} = ?
      ORDER BY ${C.STATUS}, ${C.DDL_NAME}
    `);

    const results = stmt.all(sEnv, dEnv, database, ddlType);
    return results.map(r => ComparisonEntity.fromRow(r).toUI());
  }

  async findByStatus(srcEnv, destEnv, database, type, status) {
    const sEnv = this.normalize(srcEnv);
    const dEnv = this.normalize(destEnv);
    const ddlType = this.normalize(type);

    const stmt = this.prepare(`
      SELECT * FROM ${T} 
      WHERE ${C.SRC_ENVIRONMENT} = ? 
        AND ${C.DEST_ENVIRONMENT} = ? 
        AND ${C.DATABASE_NAME} = ?
        AND ${C.DDL_TYPE} = ?
        AND ${C.STATUS} = ?
      ORDER BY ${C.DDL_NAME}
    `);

    const results = stmt.all(sEnv, dEnv, database, ddlType, status);
    return results.map(r => ComparisonEntity.fromRow(r));
  }

  async getLatest(limit = 50) {
    const stmt = this.prepare(`
      SELECT * FROM ${T} 
      ORDER BY ${C.UPDATED_AT} DESC 
      LIMIT ?
    `);
    const results = stmt.all(limit);
    return results.map(r => ComparisonEntity.fromRow(r));
  }

  async count() {
    const result = this.prepare(`SELECT COUNT(*) as count FROM ${T}`).get();
    return result ? result.count : 0;
  }

  async deleteAll() {
    return this.prepare(`DELETE FROM ${T}`).run();
  }
}

module.exports = ComparisonRepository;
