/**
 * DDL Parser Utility
 * Normalizes DDL strings for comparison
 */
class DDLParser {
  /**
   * Remove DEFINER clause from DDL
   * Handles CREATE [DEFINER=...] PROCEDURE/FUNCTION/VIEW/TRIGGER/EVENT
   * @param {string} ddl 
   * @returns {string}
   */
  static cleanDefiner(ddl) {
    if (!ddl) return '';

    // Regex components
    const userPart = `(?:'[^']+'|\`[^\`]+\`|"[^"]+"|[a-zA-Z0-9_]+)`;
    const hostPart = `(?:@(?:'[^']+'|\`[^\`]+\`|"[^"]+"|[a-zA-Z0-9_\\.\%]+))?`;
    const definerPattern = `DEFINER\\s*=\\s*${userPart}${hostPart}`;

    // Split routine to separate header and body
    const parts = this.splitRoutine(ddl);
    if (parts) {
      let header = parts.header;
      const body = parts.body;

      // Remove DEFINER from header
      const re = new RegExp(definerPattern, 'gi');
      header = header.replace(re, '');

      // Cleanup double spaces created by removal
      header = header.replace(/\s{2,}/g, ' ');

      return header + ' ' + body;
    }

    // Fallback: simple global replace if split failed
    const reFallback = new RegExp(definerPattern, 'gi');
    return ddl.replace(reFallback, '');
  }

  /**
   * Split Routine into Header and Body
   * @param {string} ddl 
   * @returns {{header: string, body: string}|null}
   */
  static splitRoutine(ddl) {
    if (!ddl) return null;

    // Try to find the first "BEGIN" keyword
    const beginMatch = ddl.match(/(\s)BEGIN(\s|$)/i);
    if (beginMatch && beginMatch.index !== undefined) {
      return {
        header: ddl.substring(0, beginMatch.index).trim(),
        body: ddl.substring(beginMatch.index).trim()
      };
    }

    return null;
  }

  /**
   * Normalize DDL for comparison
   * @param {string} ddl 
   * @param {object} options 
   * @returns {string}
   */
  static normalize(ddl, options = {}) {
    if (!ddl) return '';
    let processed = ddl;

    if (options.ignoreDefiner) {
      processed = this.cleanDefiner(processed);
    }

    if (options.ignoreWhitespace) {
      // Collapse whitespace: tabs, newlines -> space
      processed = processed.replace(/\s+/g, ' ').trim();
    }

    return processed;
  }

  /**
   * Convert SQL keywords to uppercase
   * @param {string} query 
   * @returns {string}
   */
  static uppercaseKeywords(query) {
    const keywords = [
      ...new Set([
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
      ]),
    ];
    // Split the query into individual words
    const words = query.split(/\b/);
    // Convert keywords to uppercase
    return words
      .map((word) =>
        keywords.includes(word.toUpperCase()) ? word.toUpperCase() : word,
      )
      .join("")
      .replace(/\`(GROUP|USER|GROUPS)\`/g, (match, p1) => `\`${p1.toLowerCase()}\``)
      .replace(/\t/g, "  ");
  }
}

module.exports = DDLParser;
