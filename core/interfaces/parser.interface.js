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
   * Remove DB-specific ownership/definer clauses
   * e.g. DEFINER=`root`@`localhost` (MySQL) or OWNER TO postgres (PG)
   * @param {string} ddl 
   * @returns {string}
   */
  cleanDefiner(ddl) {
    throw new Error('Method cleanDefiner() not implemented');
  }
}

module.exports = IDDLParser;
