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
}

module.exports = DDLParser;
