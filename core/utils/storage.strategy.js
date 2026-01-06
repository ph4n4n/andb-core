/**
 * @andb/core Storage Strategy
 * 
 * @author ph4n4n
 * @version 2.0.0
 * @license MIT
 * @description Pluggable storage layer - File or SQLite
 */

const path = require('path');

/**
 * Storage Strategy Interface
 * Implementations: FileStorage, SQLiteStorage, HybridStorage
 */
class StorageStrategy {
  /**
   * Save DDL export
   * @param {Object} data - {environment, database, type, name, content}
   */
  async saveDDL(data) {
    throw new Error('saveDDL must be implemented');
  }

  /**
   * Get DDL content
   * @param {string} environment 
   * @param {string} database 
   * @param {string} type 
   * @param {string} name 
   * @returns {string} DDL content
   */
  async getDDL(environment, database, type, name) {
    throw new Error('getDDL must be implemented');
  }

  /**
   * Get DDL list (for current-ddl/*.list files)
   * @param {string} environment 
   * @param {string} database 
   * @param {string} type 
   * @returns {Array<string>} List of DDL names
   */
  async getDDLList(environment, database, type) {
    throw new Error('getDDLList must be implemented');
  }

  async saveComparison(comparison) {
    throw new Error('saveComparison must be implemented');
  }

  async getComparisons(srcEnv, destEnv, database, type) {
    throw new Error('getComparisons must be implemented');
  }

  async getStats() {
    throw new Error('getStats must be implemented');
  }

  async getEnvironments() {
    throw new Error('getEnvironments must be implemented');
  }

  async getDatabases(environment) {
    throw new Error('getDatabases must be implemented');
  }

  /**
   * Save batch export data
   * @param {string} env 
   * @param {string} database 
   * @param {string} type 
   * @param {Array<Object>} data - Array of {name, ddl}
   */
  async saveExport(env, database, type, data) {
    throw new Error('saveExport must be implemented');
  }

  /**
   * Get batch export data
   * @param {string} env 
   * @param {string} database 
   * @param {string} type 
   * @returns {Array<Object>} Array of {name, ddl}
   */
  async getExport(env, database, type) {
    throw new Error('getExport must be implemented');
  }

  /**
   * Save comparison result
   * @param {Object} comparison - {srcEnv, destEnv, database, type, name, status, ...}
   */
  async saveComparison(comparison) {
    throw new Error('saveComparison must be implemented');
  }

  /**
   * Get comparison results
   * @param {string} srcEnv 
   * @param {string} destEnv 
   * @param {string} database 
   * @param {string} type 
   * @returns {Array<Object>} Comparison results
   */
  async getComparisons(srcEnv, destEnv, database, type) {
    throw new Error('getComparisons must be implemented');
  }

  /**
   * Export to files (for git/versioning)
   * @returns {Object} {success, filesExported}
   */
  async exportToFiles() {
    throw new Error('exportToFiles must be implemented');
  }

  /**
   * Save migration execution result
   */
  async saveMigration(migration) {
    throw new Error('saveMigration must be implemented');
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(limit) {
    throw new Error('getMigrationHistory must be implemented');
  }

  /**
   * Log storage action
   */
  async logAction(actionType, status, details) {
    throw new Error('logAction must be implemented');
  }

  /**
   * Save DDL snapshot
   */
  async saveSnapshot(data) {
    throw new Error('saveSnapshot must be implemented');
  }

  /**
   * Get snapshots for an object
   */
  async getSnapshots(environment, database, type, name) {
    throw new Error('getSnapshots must be implemented');
  }

  /**
   * Get all snapshots globally
   */
  async getAllSnapshots(limit) {
    throw new Error('getAllSnapshots must be implemented');
  }
}

/**
 * File Storage (Original implementation)
 */
class FileStorage extends StorageStrategy {
  constructor(fileManager, baseDir) {
    super();
    this.fileManager = fileManager;
    this.baseDir = baseDir;
  }

  async saveDDL(data) {
    const { environment, database, type, name, content } = data;

    // Save DDL file
    const ddlPath = `db/${environment}/${database}/${type.toLowerCase()}`;
    this.fileManager.makeSureFolderExisted(ddlPath);
    this.fileManager.saveToFile(ddlPath, `${name}.sql`, content);

    // Update list file
    const listPath = `db/${environment}/${database}/current-ddl`;
    this.fileManager.makeSureFolderExisted(listPath);

    const listFile = `${type}.list`;
    const existing = this.fileManager.readFromFile(listPath, listFile, true);
    const newList = [...new Set([...existing, name])].sort();
    this.fileManager.saveToFile(listPath, listFile, newList.join('\n'));

    return true;
  }

  async getDDL(environment, database, type, name) {
    const ddlPath = `db/${environment}/${database}/${type.toLowerCase()}`;
    return this.fileManager.readFromFile(ddlPath, `${name}.sql`);
  }

  async getDDLList(environment, database, type) {
    const listPath = `db/${environment}/${database}/current-ddl`;
    const content = this.fileManager.readFromFile(listPath, `${type}.list`);
    return content ? content.split('\n').map(l => l.trim()).filter(l => l) : [];
  }

  async saveExport(env, database, type, data) {
    // In FileStorage, saveDDL is called for each item during export loop
    // But we implement this for compatibility
    for (const item of data) {
      await this.saveDDL({ environment: env, database, type, name: item.name, content: item.ddl });
    }
    return true;
  }

  async getExport(env, database, type) {
    const names = await this.getDDLList(env, database, type);
    const results = [];
    for (const name of names) {
      const ddl = await this.getDDL(env, database, type, name);
      if (ddl) results.push({ name, ddl });
    }
    return results;
  }

  async saveComparison(comparison) {
    const { srcEnv, destEnv, database, type, name, status } = comparison;

    // Create folder structure
    const mapPath = `map-migrate/${srcEnv}-to-${destEnv}/${database}/${type.toLowerCase()}`;
    this.fileManager.makeSureFolderExisted(mapPath);

    // Append to appropriate list file
    const listFile = `${status}.list`;
    const existing = this.fileManager.readFromFile(mapPath, listFile, true);
    const newList = [...new Set([...existing, name])].sort();
    this.fileManager.saveToFile(mapPath, listFile, newList.join('\n'));

    return true;
  }

  async getComparisons(srcEnv, destEnv, database, type) {
    const mapPath = `map-migrate/${srcEnv}-to-${destEnv}/${database}/${type.toLowerCase()}`;
    const results = [];

    // Read each status list
    ['new', 'updated', 'deprecated'].forEach(status => {
      try {
        const content = this.fileManager.readFromFile(mapPath, `${status}.list`);
        if (content) {
          const names = content.split('\n').map(l => l.trim()).filter(l => l);
          names.forEach(name => {
            results.push({ name, status, type: type.toLowerCase() });
          });
        }
      } catch (e) {
        // File doesn't exist - OK
      }
    });

    return results;
  }

  async exportToFiles() {
    // Already in files - no-op
    return { success: true, filesExported: 0 };
  }

  async saveMigration(migration) {
    // Filesystem doesn't formally track migration history yet
    // Could save to a .log file if needed
    return true;
  }

  async getMigrationHistory(limit) {
    return [];
  }

  async logAction(actionType, status, details) {
    return true;
  }

  async saveSnapshot(data) {
    // For FileStorage, snapshots are already handled by copy to backup folder in Migrator
    return true;
  }

  async getSnapshots(environment, database, type, name) {
    // Not implemented for file storage yet beyond manual folder browsing
    return [];
  }

  async getAllSnapshots(limit) {
    return [];
  }
}

/**
 * SQLite Storage (New implementation)
 */
class SQLiteStorage extends StorageStrategy {
  constructor(dbPath, baseDir) {
    super();
    this.dbPath = dbPath;
    this.baseDir = baseDir;
    this.db = null;
    this.repositories = {};
    this.initDatabase();
  }

  initDatabase() {
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);

    // Initialize repositories
    const DDLRepository = require('../storage/repositories/ddl.repository');
    const ComparisonRepository = require('../storage/repositories/comparison.repository');
    const SnapshotRepository = require('../storage/repositories/snapshot.repository');
    const MigrationRepository = require('../storage/repositories/migration.repository');

    this.repositories.ddl = new DDLRepository(this.db);
    this.repositories.comparison = new ComparisonRepository(this.db);
    this.repositories.snapshot = new SnapshotRepository(this.db);
    this.repositories.migration = new MigrationRepository(this.db);

    // Load schema
    const fs = require('fs');
    const schemaPath = path.join(__dirname, '../storage/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    }
  }

  normalize(val) {
    return this.repositories.ddl.normalize(val);
  }

  async saveDDL(data) {
    return this.repositories.ddl.save(data);
  }

  async getDDL(environment, database, type, name) {
    const entity = await this.repositories.ddl.findOne(environment, database, type, name);
    return entity ? entity.ddl_content : null;
  }

  async getDDLList(environment, database, type) {
    return this.repositories.ddl.listNames(environment, database, type);
  }

  async saveExport(environment, database, type, data) {
    return this.repositories.ddl.saveBatch(environment, database, type, data);
  }

  async getExport(env, database, type) {
    // This one wasn't in the new repo yet, adding it to DDL repo or keeping here
    // Let's add it to DDL repository for consistency
    return this.repositories.ddl.listObjects(env, database, type);
  }

  async saveMigration(migration) {
    return this.repositories.migration.save(migration);
  }

  async getMigrationHistory(limit = 100) {
    return this.repositories.migration.list(limit);
  }

  async logAction(actionType, status, details) {
    const stmt = this.db.prepare(`
      INSERT INTO storage_actions (action_type, status, details)
      VALUES (?, ?, ?)
    `);
    stmt.run(actionType, status, typeof details === 'object' ? JSON.stringify(details) : details);
    return true;
  }

  async saveSnapshot(data) {
    return this.repositories.snapshot.save(data);
  }

  async getSnapshots(environment, database, type, name) {
    return this.repositories.snapshot.findByObject(environment, database, type, name);
  }

  async getAllSnapshots(limit = 100) {
    return this.repositories.snapshot.listLatest(limit);
  }

  async saveComparison(comparison) {
    return this.repositories.comparison.save(comparison);
  }

  async getComparisons(srcEnv, destEnv, database, type) {
    return this.repositories.comparison.find(srcEnv, destEnv, database, type);
  }

  async getDDLObjects(environment, database, type) {
    return this.repositories.ddl.listObjects(environment, database, type);
  }

  async getLatestComparisons(limit = 50) {
    return this.repositories.comparison.getLatest(limit);
  }

  async getEnvironments() {
    return this.repositories.ddl.getEnvironments();
  }

  async getDatabases(environment) {
    return this.repositories.ddl.getDatabases(environment);
  }

  async getLastUpdated(environment, database) {
    return this.repositories.ddl.getLastUpdated(environment, database);
  }

  async clearDataForConnection(environment, database) {
    return this.repositories.ddl.clearConnectionData(environment, database);
  }

  async clearAll() {
    this.repositories.ddl.deleteAll();
    this.repositories.comparison.deleteAll();
    this.repositories.snapshot.deleteAll();
    this.repositories.migration.deleteAll();
    this.db.prepare('DELETE FROM storage_actions').run();
  }

  async getStats() {
    const stats = {
      ddlExports: await this.repositories.ddl.count(),
      comparisons: await this.repositories.comparison.count(),
      snapshots: await this.repositories.snapshot.count(),
      dbPath: this.dbPath
    };
    try {
      const fs = require('fs');
      if (fs.existsSync(this.dbPath)) {
        // @ts-ignore
        stats.dbSize = fs.statSync(this.dbPath).size;
      }
    } catch (e) { }
    return stats;
  }

  async getComparisonsByStatus(srcEnv, destEnv, database, type, status) {
    return this.repositories.comparison.findByStatus(srcEnv, destEnv, database, type, status);
  }

  async exportToFiles() {
    // Get pending exports
    const pendingDDL = this.db.prepare(`
      SELECT id, environment, database_name, ddl_type, ddl_name, ddl_content, file_path
      FROM ddl_exports
      WHERE exported_to_file = 0
    `).all();

    const pendingComps = this.db.prepare(`
      SELECT id, src_environment, dest_environment, database_name, ddl_type, ddl_name, status, file_path
      FROM comparisons
      WHERE exported_to_file = 0
    `).all();

    let filesExported = 0;
    const fs = require('fs');

    // Export DDL files
    for (const item of pendingDDL) {
      const fullPath = path.join(this.baseDir, item.file_path);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, item.ddl_content, 'utf-8');

      this.db.prepare('UPDATE ddl_exports SET exported_to_file = 1 WHERE id = ?')
        .run(item.id);

      filesExported++;
    }

    // Export comparison lists
    const compsByFile = {};
    for (const item of pendingComps) {
      const key = item.file_path;
      if (!compsByFile[key]) {
        compsByFile[key] = [];
      }
      compsByFile[key].push(item);
    }

    for (const [filePath, items] of Object.entries(compsByFile)) {
      const fullPath = path.join(this.baseDir, filePath);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const names = items.map(i => i.ddl_name).sort();
      fs.writeFileSync(fullPath, names.join('\n'), 'utf-8');

      items.forEach(item => {
        this.db.prepare('UPDATE comparisons SET exported_to_file = 1 WHERE id = ?')
          .run(item.id);
      });

      filesExported++;
    }

    return { success: true, filesExported };
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Hybrid Storage - SQLite primary + File export
 */
class HybridStorage extends StorageStrategy {
  constructor(sqliteStorage, fileStorage, autoExport = false) {
    super();
    this.sqlite = sqliteStorage;
    this.files = fileStorage;
    this.autoExport = autoExport;
  }

  async saveDDL(data) {
    // Always save to SQLite (fast)
    await this.sqlite.saveDDL(data);

    // Optionally save to files immediately
    if (this.autoExport) {
      await this.files.saveDDL(data);
    }

    return true;
  }

  async getDDL(environment, database, type, name) {
    // Try SQLite first (fast)
    let content = await this.sqlite.getDDL(environment, database, type, name);

    // Fallback to files
    if (!content) {
      content = await this.files.getDDL(environment, database, type, name);
    }

    return content;
  }

  async getDDLList(environment, database, type) {
    // Try SQLite first
    let list = await this.sqlite.getDDLList(environment, database, type);

    // Fallback to files
    if (!list || list.length === 0) {
      list = await this.files.getDDLList(environment, database, type);
    }

    return list;
  }

  async saveComparison(comparison) {
    await this.sqlite.saveComparison(comparison);

    if (this.autoExport) {
      await this.files.saveComparison(comparison);
    }

    return true;
  }

  async getComparisons(srcEnv, destEnv, database, type) {
    let results = await this.sqlite.getComparisons(srcEnv, destEnv, database, type);

    if (!results || results.length === 0) {
      results = await this.files.getComparisons(srcEnv, destEnv, database, type);
    }

    return results;
  }

  async exportToFiles() {
    return await this.sqlite.exportToFiles();
  }

  async saveSnapshot(data) {
    return await this.sqlite.saveSnapshot(data);
  }

  async getSnapshots(environment, database, type, name) {
    return await this.sqlite.getSnapshots(environment, database, type, name);
  }

  async getAllSnapshots(limit) {
    return await this.sqlite.getAllSnapshots(limit);
  }
}

module.exports = {
  StorageStrategy,
  FileStorage,
  SQLiteStorage,
  HybridStorage
};

