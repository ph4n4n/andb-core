/**
 * @anph/core Storage Interfaces
 * 
 * @description Interfaces for storage strategies and repositories
 */

/**
 * Storage Strategy Interface
 * Handles high-level operations for DDL and Comparison persistence
 * @interface
 */
class IStorageStrategy {
  async saveDDL(data) { throw new Error('Not implemented'); }
  async getDDL(environment, database, type, name) { throw new Error('Not implemented'); }
  async saveComparison(comparison) { throw new Error('Not implemented'); }
  async getComparisons(srcEnv, destEnv, database, type) { throw new Error('Not implemented'); }
  async getStats() { throw new Error('Not implemented'); }
}

/**
 * Repository Interface
 * CRUD operations for a specific entity
 * @interface
 */
class IRepository {
  async save(entity) { throw new Error('Not implemented'); }
  async findById(id) { throw new Error('Not implemented'); }
  async deleteAll() { throw new Error('Not implemented'); }
  async count() { throw new Error('Not implemented'); }
}

module.exports = {
  IStorageStrategy,
  IRepository
};
