const BaseRepository = require('./base.repository');
const DDLEntity = require('../entities/ddl.entity');
const { TABLES, COLUMNS } = require('../schema');
const crypto = require('crypto');

const T = TABLES.DDL_EXPORTS;
const C = COLUMNS[T];

class DDLRepository extends BaseRepository {
  async save(data) {
    // Map incoming object to DB column format
    const row = {
      environment: data.environment,
      database_name: data.database || data.database_name,
      ddl_type: data.type || data.ddl_type,
      ddl_name: data.name || data.ddl_name,
      ddl_content: data.content || data.ddl_content || data.ddl || ''
    };

    const env = this.normalize(row.environment);
    const ddlType = this.normalize(row.ddl_type);
    const checksum = crypto.createHash('md5').update(row.ddl_content).digest('hex');

    const stmt = this.prepare(`
      INSERT INTO ${T} (${C.ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}, ${C.DDL_CONTENT}, ${C.CHECKSUM})
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(${C.ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}) 
      DO UPDATE SET 
        ${C.DDL_CONTENT} = excluded.${C.DDL_CONTENT},
        ${C.CHECKSUM} = excluded.${C.CHECKSUM},
        updated_at = CURRENT_TIMESTAMP,
        exported_to_file = 0
    `);

    stmt.run(env, row.database_name, ddlType, row.ddl_name, row.ddl_content, checksum);
    return true;
  }

  async findOne(environment, database, type, name) {
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);
    const stmt = this.prepare(`
      SELECT * FROM ${T}
      WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ? AND ${C.DDL_TYPE} = ? AND ${C.DDL_NAME} = ?
    `);

    const result = stmt.get(env, database, ddlType, name);
    return DDLEntity.fromRow(result);
  }

  async listNames(environment, database, type) {
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);
    const stmt = this.prepare(`
      SELECT ${C.DDL_NAME} FROM ${T}
      WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ? AND ${C.DDL_TYPE} = ?
      ORDER BY ${C.DDL_NAME}
    `);

    const results = stmt.all(env, database, ddlType);
    if (results.length === 0) {
      // Fallback: Try case-insensitive lookup for database if normal lookup fails
      const stmtCaseInsensitive = this.prepare(`
        SELECT ${C.DDL_NAME} FROM ${T}
        WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} COLLATE NOCASE = ? AND ${C.DDL_TYPE} = ?
        ORDER BY ${C.DDL_NAME}
      `);
      const fallbackResults = stmtCaseInsensitive.all(env, database, ddlType);
      return fallbackResults.map(r => r.ddl_name);
    }
    return results.map(r => r.ddl_name);
  }

  async listObjects(environment, database, type) {
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);
    const stmt = this.prepare(`
      SELECT * FROM ${T} 
      WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ? AND ${C.DDL_TYPE} = ?
      ORDER BY ${C.DDL_NAME}
    `);
    let results = stmt.all(env, database, ddlType);

    if (results.length === 0) {
      // Fallback: Try case-insensitive lookup for database if normal lookup fails
      const stmtCaseInsensitive = this.prepare(`
        SELECT * FROM ${T} 
        WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} COLLATE NOCASE = ? AND ${C.DDL_TYPE} = ?
        ORDER BY ${C.DDL_NAME}
       `);
      results = stmtCaseInsensitive.all(env, database, ddlType);
    }
    return results.map(r => DDLEntity.fromRow(r));
  }

  async saveBatch(environment, database, type, data) {
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);

    const stmt = this.prepare(`
      INSERT INTO ${T} (${C.ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}, ${C.DDL_CONTENT}, ${C.CHECKSUM})
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(${C.ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}) 
      DO UPDATE SET 
        ${C.DDL_CONTENT} = excluded.${C.DDL_CONTENT},
        ${C.CHECKSUM} = excluded.${C.CHECKSUM},
        updated_at = CURRENT_TIMESTAMP,
        exported_to_file = 0
    `);

    const runTransaction = this.transaction((items) => {
      for (const item of items) {
        const row = {
          name: item.name || item.ddl_name,
          ddl: item.ddl || item.ddl_content || ''
        };
        const checksum = crypto.createHash('md5').update(row.ddl).digest('hex');
        stmt.run(env, database, ddlType, row.name, row.ddl, checksum);
      }
    });

    runTransaction(data);
    return true;
  }

  async getEnvironments() {
    const stmt = this.prepare(`
      SELECT DISTINCT ${C.ENVIRONMENT} FROM ${T}
      ORDER BY ${C.ENVIRONMENT}
    `);
    return stmt.all().map(r => r.environment);
  }

  async getDatabases(environment) {
    const env = this.normalize(environment);
    const stmt = this.prepare(`
      SELECT DISTINCT ${C.DATABASE_NAME} FROM ${T}
      WHERE ${C.ENVIRONMENT} = ?
      ORDER BY ${C.DATABASE_NAME}
    `);
    // If no results standard, try case insensitive for environment grouping
    let results = stmt.all(env).map(r => r.database_name);
    if (!results.length) {
      const stmtCI = this.prepare(`
        SELECT DISTINCT ${C.DATABASE_NAME} FROM ${T}
        WHERE ${C.ENVIRONMENT} COLLATE NOCASE = ?
        ORDER BY ${C.DATABASE_NAME}
       `);
      results = stmtCI.all(env).map(r => r.database_name);
    }
    return results;
  }

  async getLastUpdated(environment, database) {
    const env = this.normalize(environment);
    const stmt = this.prepare(`
      SELECT MAX(${C.UPDATED_AT}) as last_updated
      FROM ${T}
      WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ?
    `);
    const result = stmt.get(env, database);
    return result ? result.last_updated : null;
  }

  async clearConnectionData(environment, database) {
    const env = this.normalize(environment);
    let ddlCount = 0;
    let comparisonCount = 0;

    const runTransaction = this.transaction(() => {
      const ddlRes = this.prepare(`DELETE FROM ${T} WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ?`)
        .run(env, database);
      ddlCount = ddlRes.changes;

      const compRes = this.prepare(`DELETE FROM ${TABLES.COMPARISONS} WHERE (src_environment = ? OR dest_environment = ?) AND database_name = ?`)
        .run(env, env, database);
      comparisonCount = compRes.changes;
    });
    runTransaction();

    return { ddlCount, comparisonCount };
  }

  async count() {
    const result = this.prepare(`SELECT COUNT(*) as count FROM ${T}`).get();
    return result ? result.count : 0;
  }

  async deleteAll() {
    return this.prepare(`DELETE FROM ${T}`).run();
  }
}

module.exports = DDLRepository;
