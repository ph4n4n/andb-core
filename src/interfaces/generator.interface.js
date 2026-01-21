/**
 * @anph/core DDL Generator Interface
 * 
 * @description Standard interface for generating platform-specific SQL statements.
 */
class IDDLGenerator {
  dropTable(name) { throw new Error('Not implemented'); }
  dropView(name) { throw new Error('Not implemented'); }
  dropTrigger(name) { throw new Error('Not implemented'); }
  dropFunction(name) { throw new Error('Not implemented'); }
  dropProcedure(name) { throw new Error('Not implemented'); }
  dropEvent(name) { throw new Error('Not implemented'); }

  /**
   * Generic drop method
   * @param {string} type - DDL type (TABLES, VIEWS, etc.)
   * @param {string} name - Object name
   */
  drop(type, name) {
    // Convert TABLES -> dropTable, FUNCTIONS -> dropFunction
    const cleanType = type.toLowerCase().replace(/s$/, ''); // Remove trailing 's'
    const methodName = `drop${cleanType.charAt(0).toUpperCase()}${cleanType.slice(1)}`;

    if (typeof this[methodName] === 'function') {
      return this[methodName](name);
    }
    throw new Error(`Unsupported drop operation for type: ${type}`);
  }

  /**
   * Generates a statement to rename a table
   */
  renameTable(oldName, newName) { throw new Error('Not implemented'); }

  /**
   * Wrap a set of statements in a transaction-like block if supported/needed
   * for the specific database type.
   */
  wrapInTransaction(statements) { return statements; }

  /**
   * Generates ALTER TABLE statements
   * @param {string} tableName 
   * @param {Array<string>} alters - List of alteration statements (ADD, MODIFY, DROP)
   */
  /**
   * Generates a CREATE statement for an object
   * @param {Object} obj - Object definition
   */
  generateCreate(obj) { throw new Error('Not implemented'); }

  /**
   * Generates ALTER statements from a diff
   * @param {Object} diff - Difference between src and dest
   */
  generateAlter(diff) { throw new Error('Not implemented'); }

  /**
   * Generates ALTER TABLE statements by comparing two table definitions
   * @param {Object} srcTable 
   * @param {Object} destTable 
   */
  generateTableAlter(srcTable, destTable) { throw new Error('Not implemented'); }
}

module.exports = IDDLGenerator;
