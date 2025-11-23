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
    this.initDatabase();
  }

  initDatabase() {
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);

    // Load schema
    const fs = require('fs');
    const schemaPath = path.join(__dirname, '../storage/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  async saveDDL(data) {
    const { environment, database, type, name, content } = data;

    const stmt = this.db.prepare(`
      INSERT INTO ddl_exports (environment, database_name, ddl_type, ddl_name, ddl_content, checksum)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(environment, database_name, ddl_type, ddl_name) 
      DO UPDATE SET 
        ddl_content = excluded.ddl_content,
        checksum = excluded.checksum,
        updated_at = CURRENT_TIMESTAMP,
        exported_to_file = 0
    `);

    const crypto = require('crypto');
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    stmt.run(environment, database, type, name, content, checksum);
    return true;
  }

  async getDDL(environment, database, type, name) {
    const stmt = this.db.prepare(`
      SELECT ddl_content FROM ddl_exports
      WHERE environment = ? AND database_name = ? AND ddl_type = ? AND ddl_name = ?
    `);

    const result = stmt.get(environment, database, type, name);
    return result ? result.ddl_content : null;
  }

  async getDDLList(environment, database, type) {
    const stmt = this.db.prepare(`
      SELECT ddl_name FROM ddl_exports
      WHERE environment = ? AND database_name = ? AND ddl_type = ?
      ORDER BY ddl_name
    `);

    const results = stmt.all(environment, database, type);
    return results.map(r => r.ddl_name);
  }

  async saveComparison(comparison) {
    const { srcEnv, destEnv, database, type, name, status, alterStatements, diffSummary } = comparison;

    const stmt = this.db.prepare(`
      INSERT INTO comparisons 
        (src_environment, dest_environment, database_name, ddl_type, ddl_name, status, 
         alter_statements, diff_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(src_environment, dest_environment, database_name, ddl_type, ddl_name)
      DO UPDATE SET 
        status = excluded.status,
        alter_statements = excluded.alter_statements,
        diff_summary = excluded.diff_summary,
        updated_at = CURRENT_TIMESTAMP,
        exported_to_file = 0
    `);

    const alterJSON = alterStatements ? JSON.stringify(alterStatements) : null;
    stmt.run(srcEnv, destEnv, database, type, name, status, alterJSON, diffSummary);
    return true;
  }

  async getComparisons(srcEnv, destEnv, database, type) {
    const stmt = this.db.prepare(`
      SELECT ddl_name as name, status, ddl_type as type, alter_statements, diff_summary
      FROM comparisons
      WHERE src_environment = ? AND dest_environment = ? 
        AND database_name = ? AND ddl_type = ?
      ORDER BY status, ddl_name
    `);

    const results = stmt.all(srcEnv, destEnv, database, type);
    return results.map(r => ({
      name: r.name,
      status: r.status,
      type: r.type.toLowerCase(),
      alterStatements: r.alter_statements ? JSON.parse(r.alter_statements) : null,
      diffSummary: r.diff_summary
    }));
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
}

module.exports = {
  StorageStrategy,
  FileStorage,
  SQLiteStorage,
  HybridStorage
};

