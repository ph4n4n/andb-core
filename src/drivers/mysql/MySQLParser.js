const IDDLParser = require('../../interfaces/parser.interface');

class MySQLParser extends IDDLParser {

  /**
   * Normalize for comparison (flattens)
   */
  normalize(ddl) {
    if (!ddl) return '';
    let processed = this.clean(ddl);
    // Collapse whitespace for comparison purposes
    return processed.replace(/\s+/g, ' ').trim();
  }

  /**
   * Clean DDL artifacts but PRESERVE formatting/newlines
   */
  clean(ddl) {
    if (!ddl) return '';
    let processed = ddl;

    // 1. Uppercase Keywords
    processed = this.uppercaseMySQLKeywords(processed);

    // 2. Clean Definer
    processed = this.cleanDefiner(processed);

    // 3. Clean Auto Increment
    processed = processed.replace(/AUTO_INCREMENT=\d+\s*/gi, "");

    return processed.trim();
  }

  cleanDefiner(ddl) {
    if (!ddl) return '';

    // Regex components for MySQL Definer
    const userPart = `(?:'[^']+'|\`[^\`]+\`|"[^"]+"|[a-zA-Z0-9_]+)`;
    const hostPart = `(?:@(?:'[^']+'|\`[^\`]+\`|"[^"]+"|[a-zA-Z0-9_\\.\%]+))?`;
    const definerPattern = `DEFINER\\s*=\\s*${userPart}${hostPart}`;

    // Simple global replace
    const re = new RegExp(definerPattern, 'gi');
    return ddl.replace(re, '');
  }

  uppercaseMySQLKeywords(query) {
    // MySQL 8.0 Reserved Keywords List (Subset of common ones)
    const keywords = [
      "ACCESSIBLE", "ADD", "ALL", "ALTER", "ANALYZE", "AND", "AS", "ASC", "ASENSITIVE", "BEFORE", "BETWEEN", "BIGINT", "BINARY", "BLOB", "BOTH", "BY", "CALL",
      "CASCADE", "CASE", "CHANGE", "CHAR", "CHARACTER", "CHECK", "COLLATE", "COLUMN", "CONDITION", "CONSTRAINT", "CONTINUE", "CONVERT", "CREATE", "CROSS",
      "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "CURRENT_USER", "CURSOR", "DATABASE", "DATABASES", "DAY_HOUR", "DAY_MICROSECOND", "DAY_MINUTE",
      "DAY_SECOND", "DEC", "DECIMAL", "DECLARE", "DEFAULT", "DELAYED", "DELETE", "DESC", "DESCRIBE", "DETERMINISTIC", "DISTINCT", "DISTINCTROW", "DIV", "DOUBLE",
      "DROP", "DUAL", "EACH", "ELSE", "ELSEIF", "ENCLOSED", "ESCAPED", "EXISTS", "EXIT", "EXPLAIN", "FALSE", "FETCH", "FLOAT", "FLOAT4", "FLOAT8", "FORCE",
      "FOREIGN", "FROM", "FULLTEXT", "GENERATED", "GET", "GRANT", "GROUP", "HAVING", "HIGH_PRIORITY", "HOUR_MICROSECOND", "HOUR_MINUTE", "HOUR_SECOND", "IF",
      "IGNORE", "IGNORE_SERVER_IDS", "IN", "INDEX", "INFILE", "INNER", "INOUT", "INSENSITIVE", "INSERT", "INT", "INT1", "INT2", "INT3", "INT4", "INT8", "INTEGER", "INTERVAL",
      "INTO", "IO_AFTER_GTIDS", "IO_BEFORE_GTIDS", "IS", "ITERATE", "JOIN", "KEY", "KEYS", "KILL", "LEADING", "LEAVE", "LEFT", "LIKE", "LIMIT", "LINEAR", "LINES", "LOAD",
      "LOCALTIME", "LOCALTIMESTAMP", "LOCK", "LONG", "LONGBLOB", "LONGTEXT", "LOOP", "LOW_PRIORITY", "MASTER_BIND", "MASTER_SSL_VERIFY_SERVER_CERT", "MATCH", "MAXVALUE",
      "MEDIUMBLOB", "MEDIUMINT", "MEDIUMTEXT", "MIDDLEINT", "MINUTE_MICROSECOND", "MINUTE_SECOND", "MOD", "MODIFIES", "NATURAL", "NOT", "NO_WRITE_TO_BINLOG", "NULL", "NUMERIC",
      "ON", "OPTIMIZE", "OPTION", "OPTIONALLY", "OR", "ORDER", "OUT", "OUTER", "OUTFILE", "PARTITION", "PRECISION", "PRIMARY", "PROCEDURE", "PURGE", "RANGE", "READ", "READS",
      "READ_WRITE", "REAL", "REFERENCES", "REGEXP", "RELEASE", "RENAME", "REPEAT", "REPLACE", "REQUIRE", "RESIGNAL", "RESTRICT", "RETURN", "REVOKE", "RIGHT", "RLIKE", "SCHEMA",
      "SCHEMAS", "SECOND_MICROSECOND", "SELECT", "SENSITIVE", "SEPARATOR", "SET", "SHOW", "SIGNAL", "SMALLINT", "SPATIAL", "SPECIFIC", "SQL", "SQLEXCEPTION", "SQLSTATE",
      "SQLWARNING", "SQL_BIG_RESULT", "SQL_CALC_FOUND_ROWS", "SQL_SMALL_RESULT", "SSL", "STARTING", "STORED", "STRAIGHT_JOIN", "TABLE", "TERMINATED", "TEXT", "THEN",
      "TINYBLOB", "TINYINT", "TINYTEXT", "TO", "TRAILING", "TRIGGER", "TRUE", "UNDO", "UNION", "UNIQUE", "UNLOCK", "UNSIGNED", "UPDATE", "USAGE", "USE", "USING",
      "UTC_DATE", "UTC_TIME", "UTC_TIMESTAMP", "VALUES", "VARBINARY", "VARCHAR", "VARCHARACTER", "VARYING", "VIRTUAL", "WHEN", "WHERE", "WHILE", "WITH", "WRITE",
      "XOR", "YEAR_MONTH", "ZEROFILL", "END", "OPEN", "CLOSE", "DUPLICATE", "COALESCE",
    ];

    // Split the query into individual words (Naive approach, TODO: use real lexer)
    const words = query.split(/\b/);

    return words
      .map((word) => keywords.includes(word.toUpperCase()) ? word.toUpperCase() : word)
      .join("")
      // Restore special keywords that match column behaviors or specific indentation needs
      .replace(/\`(GROUP|USER|GROUPS)\`/g, (match, p1) => `\`${p1.toLowerCase()}\``)
      .replace(/\t/g, "  ");
  }

  parseTable(tableSQL) {
    try {
      const lines = tableSQL.split('\n');
      const tableNameLine = lines.find(line => line.includes('CREATE TABLE'));
      const tableNameMatch = tableNameLine.match(/`([^`]+)`/);

      if (!tableNameMatch || tableNameMatch.length < 2) {
        return null;
      }
      const tableName = tableNameMatch[1];
      const columnDefs = [];
      const primaryKey = [];
      const indexes = {};
      let insideColumnDefinitions = false;
      let insideIndexDefinitions = false;

      for (const line of lines) {
        if (line.includes('CREATE TABLE')) {
          insideColumnDefinitions = true;
          continue;
        } else if (insideColumnDefinitions && (line.trim().includes('ENGINE=') || line.trim().startsWith(')'))) {
          // Reached the end of column definitions
          insideColumnDefinitions = false;
        } else if (line.includes('PRIMARY KEY') || line.includes('UNIQUE KEY') || (line.trim().startsWith('KEY') && line.includes('`'))) {
          insideIndexDefinitions = true;
          const indexNameMatch = line.match(/`([^`]+)`/);
          if (indexNameMatch && indexNameMatch.length >= 2) {
            const indexName = indexNameMatch[1];
            if (line.includes('PRIMARY KEY')) {
              primaryKey.push(indexName);
            } else {
              indexes[indexName] = line.trim();
            }
          }
        } else if (insideColumnDefinitions && line.trim() !== '') {
          // Parse only non-empty lines inside column definitions
          const columnNameMatch = line.match(/`([^`]+)`/);
          if (!columnNameMatch || columnNameMatch.length < 2) {
            continue;
          }
          const columnName = columnNameMatch[1];
          columnDefs.push({
            name: columnName,
            definition: line.trim(),
          });
        } else if (insideIndexDefinitions && line.trim() === ')') {
          insideIndexDefinitions = false;
        }
      }

      const columns = {};
      for (const columnDef of columnDefs) {
        columns[columnDef.name] = columnDef.definition;
      }

      return {
        tableName,
        columns,
        primaryKey,
        indexes,
      };
    } catch (error) {
      if (global.logger) global.logger.error('Error parsing MySQL table definition:', error);
      return null;
    }
  }

  parseTrigger(triggerSQL) {
    try {
      const lines = triggerSQL.split('\n');
      const triggerNameLine = lines.find(line => line.includes('TRIGGER') && line.includes('`'));
      const triggerNameMatch = triggerNameLine?.match(/TRIGGER\s+`([^`]+)`/);

      if (!triggerNameMatch || triggerNameMatch.length < 2) {
        return null;
      }

      const triggerName = triggerNameMatch[1];
      const timing = triggerNameLine.match(/(BEFORE|AFTER)/)?.[1];
      const event = triggerNameLine.match(/(INSERT|UPDATE|DELETE)/)?.[1];
      const tableName = triggerNameLine.match(/ON\s+`([^`]+)`/)?.[1];

      return {
        triggerName,
        timing,
        event,
        tableName,
        definition: triggerSQL
      };
    } catch (error) {
      if (global.logger) global.logger.error('Error parsing MySQL trigger definition:', error);
      return null;
    }
  }
}

module.exports = MySQLParser;
