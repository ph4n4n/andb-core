const fs = require('fs');
const { IDatabaseDriver, IIntrospectionService } = require('../../interfaces/driver.interface');
const { TABLES, VIEWS, PROCEDURES, FUNCTIONS, TRIGGERS, EVENTS } = require('../../configs/constants').DDL;

/**
 * DumpDriver
 * A virtual driver that "connects" to a SQL dump file.
 * It parses the DDL statements and makes them searchable via the Introspection service.
 */
class DumpDriver extends IDatabaseDriver {
  constructor(config) {
    super(config);
    this.dumpPath = config.dumpPath || config.host; // Use host as fallback for path if provided
    this.data = {
      [TABLES]: new Map(),
      [VIEWS]: new Map(),
      [PROCEDURES]: new Map(),
      [FUNCTIONS]: new Map(),
      [TRIGGERS]: new Map(),
      [EVENTS]: new Map(),
    };
    this.parser = null;
  }

  async connect() {
    if (!this.dumpPath) {
      throw new Error('Dump file path is required for DumpDriver');
    }

    // Handle relative paths for demo/assets
    let resolvedPath = this.dumpPath;
    if (this.dumpPath.startsWith('./')) {
      const path = require('path');

      // Try resolving relative to CWD
      const cwdPath = path.resolve(process.cwd(), this.dumpPath);
      // Also try resolving relative to the parent of CWD (if we are in a subfolder like userData)
      const parentCwdPath = path.resolve(process.cwd(), '..', this.dumpPath);

      if (fs.existsSync(cwdPath)) {
        resolvedPath = cwdPath;
      } else if (fs.existsSync(parentCwdPath)) {
        resolvedPath = parentCwdPath;
      } else {
        resolvedPath = cwdPath;
      }
    }

    if (global.logger) global.logger.info(`[DumpDriver] Resolving dump file: ${this.dumpPath} -> ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Dump file not found: ${resolvedPath}`);
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      this._parseDump(content);

      if (global.logger) {
        const counts = Object.entries(this.data)
          .map(([type, map]) => `${type}: ${map.size}`)
          .join(', ');
        global.logger.info(`[DumpDriver] Finished parsing ${resolvedPath}. Objects found: ${counts}`);
      }
    } catch (err) {
      if (global.logger) global.logger.error(`[DumpDriver] Failed to read or parse dump: ${err.message}`);
      throw err;
    }
  }

  async disconnect() {
    // Nothing to do for a file-based driver
  }

  async query(sql, params = []) {
    // DumpDriver is read-only for metadata, queries not supported unless mocked
    if (global.logger) global.logger.warn('DumpDriver does not support raw queries');
    return [];
  }

  getIntrospectionService() {
    return new DumpIntrospectionService(this);
  }

  getDDLParser() {
    if (!this.parser) {
      const MySQLParser = require('./MySQLParser');
      this.parser = new MySQLParser();
    }
    return this.parser;
  }

  getDDLGenerator() {
    const MySQLGenerator = require('./MySQLGenerator');
    return new MySQLGenerator();
  }

  async getSessionContext() {
    return {
      sql_mode: '',
      time_zone: 'UTC',
      lock_wait_timeout: 0,
      charset: 'utf8mb4'
    };
  }

  /**
   * Stateful dump parser to extract DDLs correctly (handles DELIMITER)
   */
  _parseDump(content) {
    // 1. Strip multi-line comments first to simplify line-by-line parsing
    // but keep /*! version specific */ comments as they might contain DDL
    const cleanContent = content.replace(/\/\*(?!![\d\s])[\s\S]*?\*\//g, '');
    const lines = cleanContent.split(/\r?\n/);

    let currentDelimiter = ';';
    let buffer = [];
    let inBeginEndBlock = 0;

    for (let line of lines) {
      // Strip trailing single-line comments for easier delimiter detection
      // Note: This is a simple strip, may fail if strings contain these chars
      let cleanLine = line.split('--')[0].split('#')[0];
      const trimmed = cleanLine.trim();

      // Skip empty lines or pure single-line comments
      if (!trimmed) continue;

      // Handle DELIMITER command (case-insensitive)
      const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
      if (delimiterMatch) {
        currentDelimiter = delimiterMatch[1].trim().replace(/;$/, '');
        continue;
      }

      // Track BEGIN...END for procedures/functions without DELIMITER
      const upperClean = trimmed.toUpperCase().replace(/;$/, '');
      if (upperClean === 'BEGIN' || upperClean.endsWith(' BEGIN')) inBeginEndBlock++;
      if (upperClean === 'END' || upperClean.endsWith(' END')) inBeginEndBlock = Math.max(0, inBeginEndBlock - 1);

      buffer.push(line);

      // Check if line ends with the current delimiter
      // If we are in a BEGIN...END block and the delimiter is still ';', we wait for the final END
      const isActuallyDelimited = trimmed.endsWith(currentDelimiter) && (currentDelimiter !== ';' || inBeginEndBlock === 0);

      if (isActuallyDelimited) {
        let stmt = buffer.join('\n').trim();

        // Remove the delimiter from the end of the statement
        if (stmt.endsWith(currentDelimiter)) {
          stmt = stmt.slice(0, -currentDelimiter.length).trim();
        }

        if (stmt) {
          if (global.logger) global.logger.info(`[DumpDriver] Processing statement: ${stmt.substring(0, 50)}...`);
          this._processStatement(stmt);
        }
        buffer = [];
        inBeginEndBlock = 0;
      }
    }
  }

  _processStatement(stmt) {
    // Normalize whitespace for type detection
    const normalized = stmt.replace(/\s+/g, ' ');

    // Improved regex to handle DEFINER, ALGORITHM, SQL SECURITY, etc.
    const createMatch = normalized.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?(?:ALGORITHM\s*=\s*\S+\s+)?(?:SQL\s+SECURITY\s+\S+\s+)?(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+/i);

    if (!createMatch) {
      if (global.logger) global.logger.warn(`[DumpDriver] Statement skipped (no CREATE match): ${normalized.substring(0, 50)}...`);
      return;
    }

    let type = createMatch[1].toUpperCase();
    if (global.logger) global.logger.info(`[DumpDriver] Matched type: ${type}`);

    const typeMap = {
      'TABLE': TABLES,
      'VIEW': VIEWS,
      'PROCEDURE': PROCEDURES,
      'FUNCTION': FUNCTIONS,
      'TRIGGER': TRIGGERS,
      'EVENT': EVENTS
    };

    const targetType = typeMap[type];
    const name = this._extractName(stmt);

    if (name && targetType && this.data[targetType]) {
      this.data[targetType].set(name, stmt + ';');
      if (global.logger) global.logger.info(`[DumpDriver] Added ${type}: ${name}`);
    } else {
      if (global.logger) global.logger.warn(`[DumpDriver] Failed to extract name or invalid type. Name: ${name}, Type: ${targetType}`);
    }
  }

  _extractName(stmt) {
    // Clean up statement for easier name extraction
    // 1. Remove everything up to the type keyword and IF NOT EXISTS
    const typesPattern = '(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)';
    const cleanPattern = new RegExp(`^.*?CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:.*?\\s+)?${typesPattern}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?`, 'i');
    const namePart = stmt.replace(cleanPattern, '').trim();

    // 2. Extract name (handles `db`.`table`, `table`, table, etc)
    const nameMatch = namePart.match(/^(?:`([^`]+)`|([a-zA-Z0-9_\$]+))\.(?:`([^`]+)`|([a-zA-Z0-9_\$]+))/i) ||
      namePart.match(/^(?:`([^`]+)`|([a-zA-Z0-9_\$]+))/i);

    if (nameMatch) {
      // If qualified (db.table), index 3 or 4 is the table name. If not, index 1 or 2 is the name.
      return nameMatch[3] || nameMatch[4] || nameMatch[1] || nameMatch[2];
    }
    return null;
  }
}

class DumpIntrospectionService extends IIntrospectionService {
  constructor(driver) {
    super(driver);
  }

  async _list(type, pattern) {
    const names = Array.from(this.driver.data[type].keys());
    if (!pattern) return names;
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    return names.filter(name => regex.test(name));
  }

  async listTables(dbName, pattern) { return this._list(TABLES, pattern); }
  async listViews(dbName, pattern) { return this._list(VIEWS, pattern); }
  async listProcedures(dbName, pattern) { return this._list(PROCEDURES, pattern); }
  async listFunctions(dbName, pattern) { return this._list(FUNCTIONS, pattern); }
  async listTriggers(dbName, pattern) { return this._list(TRIGGERS, pattern); }
  async listEvents(dbName, pattern) { return this._list(EVENTS, pattern); }

  async getTableDDL(dbName, name) { return this.driver.data[TABLES].get(name) || null; }
  async getViewDDL(dbName, name) { return this.driver.data[VIEWS].get(name) || null; }
  async getProcedureDDL(dbName, name) { return this.driver.data[PROCEDURES].get(name) || null; }
  async getFunctionDDL(dbName, name) { return this.driver.data[FUNCTIONS].get(name) || null; }
  async getTriggerDDL(dbName, name) { return this.driver.data[TRIGGERS].get(name) || null; }
  async getEventDDL(dbName, name) { return this.driver.data[EVENTS].get(name) || null; }

  async getChecksums(dbName) {
    return [];
  }
}

module.exports = DumpDriver;
