import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private db: Database.Database | null = null;
  private dbPath: string = '';

  onModuleInit() {
    // We will initialize when setDbPath is called or use a default
    const defaultPath = path.join(process.cwd(), 'andb-storage.db');
    this.initialize(defaultPath);
  }

  onModuleDestroy() {
    this.close();
  }

  initialize(dbPath: string) {
    if (this.db) {
      if (this.dbPath === dbPath) return;
      this.close();
    }

    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.logger.log(`Initializing SQLite storage at: ${dbPath}`);
    this.db = new Database(dbPath);
    this._initSchema();
  }

  private _initSchema() {
    if (!this.db) return;

    // Basic tables needed for the UI
    const schema = `
      CREATE TABLE IF NOT EXISTS ddl_exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment TEXT NOT NULL,
        database_name TEXT NOT NULL,
        ddl_type TEXT NOT NULL,
        ddl_name TEXT NOT NULL,
        ddl_content TEXT NOT NULL,
        checksum TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        exported_to_file INTEGER DEFAULT 0,
        file_path TEXT,
        UNIQUE(environment, database_name, ddl_type, ddl_name)
      );

      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        src_environment TEXT NOT NULL,
        dest_environment TEXT NOT NULL,
        database_name TEXT NOT NULL,
        ddl_type TEXT NOT NULL,
        ddl_name TEXT NOT NULL,
        status TEXT NOT NULL,
        src_ddl_id INTEGER,
        dest_ddl_id INTEGER,
        diff_summary TEXT,
        alter_statements TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        exported_to_file INTEGER DEFAULT 0,
        file_path TEXT,
        UNIQUE(src_environment, dest_environment, database_name, ddl_type, ddl_name)
      );

      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        src_environment TEXT NOT NULL,
        dest_environment TEXT NOT NULL,
        database_name TEXT NOT NULL,
        ddl_type TEXT NOT NULL,
        ddl_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_by TEXT
      );

      CREATE TABLE IF NOT EXISTS ddl_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        environment TEXT NOT NULL,
        database_name TEXT NOT NULL,
        ddl_type TEXT NOT NULL,
        ddl_name TEXT NOT NULL,
        ddl_content TEXT NOT NULL,
        checksum TEXT,
        version_tag TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS storage_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ddl_lookup ON ddl_exports(environment, database_name);
      CREATE INDEX IF NOT EXISTS idx_comp_lookup ON comparisons(src_environment, dest_environment);
      CREATE INDEX IF NOT EXISTS idx_snapshot_lookup ON ddl_snapshots(environment, database_name, ddl_type, ddl_name);
    `;

    this.db.exec(schema);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // --- DDL Operations ---

  async saveDDL(environment: string, database: string, type: string, name: string, content: string) {
    if (!this.db) return;
    const checksum = crypto.createHash('md5').update(content).digest('hex');
    const stmt = this.db.prepare(`
      INSERT INTO ddl_exports (environment, database_name, ddl_type, ddl_name, ddl_content, checksum, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(environment, database_name, ddl_type, ddl_name) DO UPDATE SET
        ddl_content = excluded.ddl_content,
        checksum = excluded.checksum,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(environment.toUpperCase(), database, type.toUpperCase(), name, content, checksum);
  }

  async getDDL(environment: string, database: string, type: string, name: string) {
    if (!this.db) return null;
    const stmt = this.db.prepare(`
      SELECT ddl_content FROM ddl_exports 
      WHERE environment = ? AND database_name = ? AND ddl_type = ? AND ddl_name = ?
    `);
    const row = stmt.get(environment.toUpperCase(), database, type.toUpperCase(), name) as any;
    return row ? row.ddl_content : null;
  }

  async getDDLObjects(environment: string, database: string, type: string) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT ddl_name as name, ddl_content as content, updated_at 
      FROM ddl_exports 
      WHERE environment = ? AND database_name = ? AND ddl_type = ?
      ORDER BY ddl_name ASC
    `);
    return stmt.all(environment.toUpperCase(), database, type.toUpperCase());
  }

  async getEnvironments() {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT DISTINCT environment FROM ddl_exports ORDER BY environment ASC');
    return stmt.all().map((r: any) => r.environment);
  }

  async getDatabases(environment: string) {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT DISTINCT database_name FROM ddl_exports WHERE environment = ? ORDER BY database_name ASC');
    return stmt.all(environment.toUpperCase()).map((r: any) => r.database_name);
  }

  async getLastUpdated(environment: string, database: string) {
    if (!this.db) return null;
    const stmt = this.db.prepare('SELECT MAX(updated_at) as last_updated FROM ddl_exports WHERE environment = ? AND database_name = ?');
    const row = stmt.get(environment.toUpperCase(), database) as any;
    return row ? row.last_updated : null;
  }

  // --- Comparison Operations ---

  async saveComparison(comp: {
    srcEnv: string, destEnv: string, database: string, type: string, name: string, status: string, ddl?: string, alterStatements?: any
  }) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO comparisons (src_environment, dest_environment, database_name, ddl_type, ddl_name, status, alter_statements, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(src_environment, dest_environment, database_name, ddl_type, ddl_name) DO UPDATE SET
        status = excluded.status,
        alter_statements = excluded.alter_statements,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(
      comp.srcEnv.toUpperCase(),
      comp.destEnv.toUpperCase(),
      comp.database,
      comp.type.toUpperCase(),
      comp.name,
      comp.status,
      JSON.stringify(comp.alterStatements || [])
    );
  }

  async getComparisons(srcEnv: string, destEnv: string, database: string, type: string) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT ddl_name as name, status, ddl_type as type, alter_statements
      FROM comparisons
      WHERE src_environment = ? AND dest_environment = ? AND database_name = ? AND ddl_type = ?
    `);
    return stmt.all(srcEnv.toUpperCase(), destEnv.toUpperCase(), database, type.toUpperCase());
  }

  async getLatestComparisons(limit: number = 50) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT DISTINCT src_environment, dest_environment, database_name, ddl_type, updated_at
      FROM comparisons
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  // --- Snapshot Operations ---

  async saveSnapshot(environment: string, database: string, type: string, name: string, ddl: string, tag?: string) {
    if (!this.db) return;
    const checksum = crypto.createHash('md5').update(ddl).digest('hex');
    const stmt = this.db.prepare(`
      INSERT INTO ddl_snapshots (environment, database_name, ddl_type, ddl_name, ddl_content, checksum, version_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(environment.toUpperCase(), database, type.toUpperCase(), name, ddl, checksum, tag || null);
  }

  async getSnapshots(environment: string, database: string, type: string, name: string) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
      SELECT id, ddl_content, version_tag, created_at, checksum
      FROM ddl_snapshots
      WHERE environment = ? AND database_name = ? AND ddl_type = ? AND ddl_name = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(environment.toUpperCase(), database, type.toUpperCase(), name);
  }

  async getAllSnapshots(limit: number = 200) {
    if (!this.db) return [];
    const stmt = this.db.prepare(`
       SELECT * FROM ddl_snapshots ORDER BY created_at DESC LIMIT ?
     `);
    return stmt.all(limit);
  }

  // --- Migration Operations ---

  async saveMigration(history: { srcEnv: string, destEnv: string, database: string, type: string, name: string, operation: string, status: string, error?: string }) {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO migration_history (src_environment, dest_environment, database_name, ddl_type, ddl_name, operation, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      history.srcEnv.toUpperCase(),
      history.destEnv.toUpperCase(),
      history.database,
      history.type.toUpperCase(),
      history.name,
      history.operation,
      history.status,
      history.error || null
    );
  }

  async getMigrationHistory(limit: number = 100) {
    if (!this.db) return [];
    const stmt = this.db.prepare('SELECT * FROM migration_history ORDER BY executed_at DESC LIMIT ?');
    return stmt.all(limit);
  }

  // --- Maintenance ---

  async clearConnectionData(environment: string, database: string) {
    if (!this.db) return { ddlCount: 0, comparisonCount: 0 };
    const env = environment.toUpperCase();
    const ddl = this.db.prepare('DELETE FROM ddl_exports WHERE environment = ? AND database_name = ?').run(env, database);
    const comp = this.db.prepare('DELETE FROM comparisons WHERE (src_environment = ? OR dest_environment = ?) AND database_name = ?').run(env, env, database);
    return { ddlCount: ddl.changes, comparisonCount: comp.changes };
  }

  async clearAll() {
    if (!this.db) return { ddl: 0, comparison: 0, snapshot: 0, migration: 0 };
    const ddl = this.db.prepare('DELETE FROM ddl_exports').run();
    const comp = this.db.prepare('DELETE FROM comparisons').run();
    const snap = this.db.prepare('DELETE FROM ddl_snapshots').run();
    const mig = this.db.prepare('DELETE FROM migration_history').run();
    return { ddl: ddl.changes, comparison: comp.changes, snapshot: snap.changes, migration: mig.changes };
  }

  async getStats() {
    if (!this.db) return {};
    return {
      ddlExports: (this.db.prepare('SELECT COUNT(*) as count FROM ddl_exports').get() as any).count,
      comparisons: (this.db.prepare('SELECT COUNT(*) as count FROM comparisons').get() as any).count,
      snapshots: (this.db.prepare('SELECT COUNT(*) as count FROM ddl_snapshots').get() as any).count,
      dbPath: this.dbPath
    };
  }
}
