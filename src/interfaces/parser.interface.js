/**
 * @anph/core DDL Parser Interface
 * 
 * @description Standard interface for parsing and adjusting DDL strings
 */
class IDDLParser {
  /**
   * Normalize DDL string for comparison (uppercase keywords, clean whitespaces)
   * @param {string} ddl 
   * @returns {string}
   */
  normalize(ddl) {
    throw new Error('Method normalize() not implemented');
  }

  /**
   * Parse table DDL into a structured object for comparison
   * @param {string} ddl 
   * @returns {Object} { tableName, columns, primaryKey, indexes }
   */
  parseTable(ddl) {
    throw new Error('Method parseTable() not implemented');
  }

  /**
   * Parse trigger DDL into a structured object for comparison
   * @param {string} ddl 
   * @returns {Object} { triggerName, timing, event, tableName, definition }
   */
  parseTrigger(ddl) {
    throw new Error('Method parseTrigger() not implemented');
  }
}

module.exports = IDDLParser;
