const BaseRepository = require('./base.repository');
const SnapshotEntity = require('../entities/snapshot.entity');
const { TABLES, COLUMNS } = require('../schema');
const crypto = require('crypto');

const T = TABLES.DDL_SNAPSHOTS;
const C = COLUMNS[T];

class SnapshotRepository extends BaseRepository {
  async save(data) {
    const { environment, database, type, name, content, versionTag } = data;
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);
    const checksum = crypto.createHash('md5').update(content || '').digest('hex');

    const stmt = this.prepare(`
      INSERT INTO ${T} (${C.ENVIRONMENT}, ${C.DATABASE_NAME}, ${C.DDL_TYPE}, ${C.DDL_NAME}, ${C.DDL_CONTENT}, ${C.CHECKSUM}, ${C.VERSION_TAG})
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(env, database, ddlType, name, content, checksum, versionTag || null);
    return true;
  }

  async findByObject(environment, database, type, name) {
    const env = this.normalize(environment);
    const ddlType = this.normalize(type);
    const stmt = this.prepare(`
      SELECT * FROM ${T}
      WHERE ${C.ENVIRONMENT} = ? AND ${C.DATABASE_NAME} = ? AND ${C.DDL_TYPE} = ? AND ${C.DDL_NAME} = ?
      ORDER BY ${C.CREATED_AT} DESC
    `);
    const results = stmt.all(env, database, ddlType, name);
    return results.map(r => SnapshotEntity.fromRow(r));
  }

  async listLatest(limit = 100) {
    const stmt = this.prepare(`
      SELECT * FROM ${T}
      ORDER BY ${C.CREATED_AT} DESC
      LIMIT ?
    `);
    const results = stmt.all(limit);
    return results.map(r => SnapshotEntity.fromRow(r));
  }

  async count() {
    const result = this.prepare(`SELECT COUNT(*) as count FROM ${T}`).get();
    return result ? result.count : 0;
  }

  async deleteAll() {
    return this.prepare(`DELETE FROM ${T}`).run();
  }
}

module.exports = SnapshotRepository;
