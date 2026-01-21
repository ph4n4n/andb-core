const IDDLGenerator = require('../../interfaces/generator.interface');

class MySQLDDLGenerator extends IDDLGenerator {
  dropTable(name) {
    return `DROP TABLE IF EXISTS \`${name}\`;`;
  }

  dropView(name) {
    return `DROP VIEW IF EXISTS \`${name}\`;`;
  }

  dropTrigger(name) {
    return `DROP TRIGGER IF EXISTS \`${name}\`;`;
  }

  dropFunction(name) {
    return `DROP FUNCTION IF EXISTS \`${name}\`;`;
  }

  dropProcedure(name) {
    return `DROP PROCEDURE IF EXISTS \`${name}\`;`;
  }

  dropEvent(name) {
    return `DROP EVENT IF EXISTS \`${name}\`;`;
  }

  renameTable(oldName, newName) {
    return `RENAME TABLE \`${oldName}\` TO \`${newName}\`;`;
  }

  setSessionVariable(name, value) {
    return `SET SESSION ${name} = ${value};`;
  }

  generateAlter(tableName, alters) {
    if (!alters || alters.length === 0) return null;
    return `ALTER TABLE \`${tableName}\`\n${alters.join(',\n')};`
      .replace(/,,/g, ',')
      .replace(/,;/g, ';');
  }

  /**
   * Generates ALTER TABLE statements by comparing two table definitions
   * @param {Object} srcTable - Current table definition
   * @param {Object} destTable - Target table definition
   */
  generateTableAlter(srcTable, destTable) {
    const tableName = srcTable.tableName;
    const { alterColumns, missingColumns, missingColumnsAlter } = this.compareColumns(srcTable, destTable);
    const alterIndexes = this.compareIndexes(srcTable, destTable);

    return {
      columns: this.generateAlter(tableName, alterColumns),
      indexes: this.generateAlter(tableName, alterIndexes),
      deprecated: this.generateAlter(tableName, missingColumnsAlter),
      missingColumns
    };
  }

  compareColumns(srcTable, destTable) {
    const alterColumns = [];
    const missingColumns = [];
    const missingColumnsAlter = [];
    let prevColumnName = null;

    // Check if any columns are missing in the destination table
    for (const columnName in srcTable.columns) {
      if (!destTable.columns[columnName]) {
        alterColumns.push(`ADD COLUMN ${srcTable.columns[columnName].replace(/[,;]$/, '')} AFTER \`${prevColumnName || 'FIRST'}\``);
      }
      prevColumnName = columnName;
    }

    // Check if any columns have different definitions
    for (const srcColName in srcTable.columns) {
      if (!destTable.columns[srcColName]) continue;

      const srcColumnDef = srcTable.columns[srcColName];
      const destColumnDef = destTable.columns[srcColName];

      if (srcColumnDef === destColumnDef) continue;

      // detect source collation not defined
      const srcCollation = srcColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
      if (srcCollation === undefined) {
        const destCollation = destColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
        if (destCollation === 'latin1_swedish_ci') continue;

        alterColumns.push(`MODIFY COLUMN ${srcColumnDef
          .replace(/\,$/, ` COLLATE latin1_swedish_ci,`)
          .replace(/ DEFAULT NULL/, '')
          }`);
        continue;
      }

      // Column definition has changed
      alterColumns.push(`MODIFY COLUMN ${srcColumnDef.replace(/ DEFAULT NULL/, '')}`);
    }

    // Check for deprecated columns
    for (const destColName in destTable.columns) {
      if (!srcTable.columns[destColName]) {
        missingColumns.push(destColName);
        missingColumnsAlter.push(`DROP COLUMN \`${destColName}\``);
      }
    }

    return { alterColumns, missingColumns, missingColumnsAlter };
  }

  compareIndexes(srcTable, destTable) {
    const alterIndexes = [];

    // 1. Check for new or changed indexes
    for (const indexName in srcTable.indexes) {
      const srcDef = srcTable.indexes[indexName].replace(/,$/, '').trim();

      if (!destTable.indexes[indexName]) {
        alterIndexes.push(`ADD ${srcDef}`);
      } else {
        const destDef = destTable.indexes[indexName].replace(/,$/, '').trim();
        if (srcDef !== destDef) {
          alterIndexes.push(`DROP INDEX \`${indexName}\``);
          alterIndexes.push(`ADD ${srcDef}`);
        }
      }
    }

    // 2. Check for deprecated indexes
    for (const indexName in destTable.indexes) {
      if (!srcTable.indexes[indexName]) {
        alterIndexes.push(`DROP INDEX \`${indexName}\``);
      }
    }

    return alterIndexes;
  }
}

module.exports = MySQLDDLGenerator;
