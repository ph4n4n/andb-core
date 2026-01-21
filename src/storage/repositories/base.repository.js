const { IRepository } = require('../../interfaces/storage.interface');

/**
 * Base Repository for SQLite Storage
 */
class BaseRepository extends IRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  normalize(val) {
    return val ? val.toString().toUpperCase() : val;
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  // Implementation of IRepository
  async findById(id) {
    throw new Error('findById not implemented');
  }

  async count() {
    throw new Error('count not implemented');
  }

  async deleteAll() {
    throw new Error('deleteAll not implemented');
  }
}

module.exports = BaseRepository;
