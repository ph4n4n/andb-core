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
    if (!content) return;

    // Remove comments but keep pragmas (strip wrapper)
    const cleaned = content.replace(/(\/\*([\s\S]*?)\*\/)|(--.*)|(#.*)/g, (match) => {
      // Handle Executable Comments: /*!50003 CREATE ... */ -> CREATE ...
      if (match.startsWith('/*!')) {
        // Remove /*!12345 and */
        return match.replace(/^\/\*!\d*\s*/, '').replace(/\s*\*\/$/, ' ');
      }
      return '';
    });

    const lines = cleaned.split('\n');
    let buffer = [];
    let inBeginEndBlock = 0;
    let currentDelimiter = ';';

    for (let line of lines) {
      let trimmed = line.trim();
      if (!trimmed) continue;

      // DELIMITER change
      if (trimmed.toUpperCase().startsWith('DELIMITER')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1) {
          currentDelimiter = parts[1];
        }
        continue;
      }

      // Track BEGIN...END for procedures/triggers
      const upperLine = trimmed.toUpperCase();
      // Use regex to avoid matching BEGIN/END inside other words
      if (/\bBEGIN\b/.test(upperLine)) inBeginEndBlock++;
      if (/\bEND\b/.test(upperLine)) inBeginEndBlock--;

      buffer.push(line);

      // Check if statement is complete
      const isActuallyDelimited = trimmed.endsWith(currentDelimiter) && (currentDelimiter !== ';' || inBeginEndBlock <= 0);

      if (isActuallyDelimited) {
        let stmt = buffer.join('\n').trim();
        if (stmt.endsWith(currentDelimiter)) {
          stmt = stmt.substring(0, stmt.length - currentDelimiter.length).trim();
        }

        if (stmt) {
          this._processStatement(stmt);
        }

        buffer = [];
        inBeginEndBlock = 0;
      }
    }
  }

  _processStatement(stmt) {
    const normalized = stmt.replace(/\s+/g, ' ');
    // Handle CREATE ... [IF NOT EXISTS] [database.]name
    // Improved Regex:
    // 1. Handles Optional Modifiers (DEFINER, ALGORITHM etc) including quoted values
    // 2. Handles Spaces in Names (backticked)
    // 3. Handles IF NOT EXISTS
    const createMatch = normalized.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:DEFINER\s*=\s*(?:'[^']+'|`[^`]+`|\S+)|ALGORITHM\s*=\s*\S+|SQL\s+SECURITY\s+\S+)\s+)*(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`)|(?:[^\s\(\)]+))/i);

    if (!createMatch) {
      return;
    }

    const typeKey = createMatch[1].toUpperCase();
    const targetType = {
      'TABLE': TABLES,
      'VIEW': VIEWS,
      'PROCEDURE': PROCEDURES,
      'FUNCTION': FUNCTIONS,
      'TRIGGER': TRIGGERS,
      'EVENT': EVENTS
    }[typeKey];

    let rawName = createMatch[2];
    const name = this._extractName(rawName);

    if (name && targetType && this.data[targetType]) {
      // Always end DDL with ; for consistency
      this.data[targetType].set(name, stmt + ';');
    }
  }

  _extractName(rawName) {
    if (!rawName) return null;
    // Remove quotes/backticks
    let name = rawName.replace(/[`"']/g, '');
    // Remove database prefix if exists (db.table -> table)
    if (name.includes('.')) {
      name = name.split('.').pop();
    }
    return name;
  }
}

class DumpIntrospectionService extends IIntrospectionService {
  constructor(driver) {
    super(driver);
  }

  async _list(type, pattern) {
    if (!this.driver.data[type]) return [];
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
