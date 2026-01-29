import { IDiffOperation, ITableDiff, IObjectDiff } from '../../../common/interfaces/diff.interface';

export class MysqlMigrator {
  generateObjectSQL(diff: IObjectDiff): string[] {
    const { type, name, operation, definition } = diff;
    const statements: string[] = [];

    if (operation === 'DROP' || operation === 'REPLACE') {
      statements.push(`DROP ${type} IF EXISTS \`${name}\`;`);
    }

    if ((operation === 'CREATE' || operation === 'REPLACE') && definition) {
      statements.push(definition);
    }

    return statements;
  }
  generateTableAlterSQL(diff: ITableDiff): string[] {
    if (!diff.hasChanges || diff.operations.length === 0) {
      return [];
    }

    const { tableName, operations } = diff;
    const statements: string[] = [];

    // Group columns by add, modify, drop to generate efficient SQL
    const addColumns = operations.filter(
      (op: IDiffOperation) => op.type === 'ADD' && op.target === 'COLUMN',
    );
    const modifyColumns = operations.filter(
      (op: IDiffOperation) => op.type === 'MODIFY' && op.target === 'COLUMN',
    );
    const dropColumns = operations.filter(
      (op: IDiffOperation) => op.type === 'DROP' && op.target === 'COLUMN',
    );

    const addIndexes = operations.filter(
      (op: IDiffOperation) => op.type === 'ADD' && op.target === 'INDEX',
    );
    const dropIndexes = operations.filter(
      (op: IDiffOperation) => op.type === 'DROP' && op.target === 'INDEX',
    );

    // 1. Drop Indexes first (to avoid conflicts if modifying columns used in indexes)
    // Legacy logic: single statement with multiple alters?
    // "ALTER TABLE `t` DROP INDEX `i`, ADD INDEX `i` (...)"

    // We will build a single ALTER TABLE statement with multiple clauses if possible,
    // ensuring order: DROP INDEX -> DROP COLUMN -> MODIFY COLUMN -> ADD COLUMN -> ADD INDEX

    const clauses: string[] = [];

    // Drops
    dropIndexes.forEach((op: IDiffOperation) => clauses.push(`DROP INDEX \`${op.name}\``));
    dropColumns.forEach((op: IDiffOperation) => clauses.push(`DROP COLUMN \`${op.name}\``));

    // Modifies
    modifyColumns.forEach((op: IDiffOperation) => {
      // Legacy logic cleanup: remove DEFAULT NULL, trailing comma
      const def = op.definition!.replace(/ DEFAULT NULL/gi, '').replace(/,$/, '');
      clauses.push(`MODIFY COLUMN ${def}`);
    });

    // Adds
    addColumns.forEach((op: IDiffOperation) => {
      // definition already includes "AFTER ..." from Comparator if ported correctly
      // But if not, we must rely on definition being complete.
      // Legacy: "ADD COLUMN definition AFTER ..."
      // In our Comparator, we already formatted the `definition` to include "ADD COLUMN ... AFTER ..."
      // Wait, let's check Comparator Logic in previous step.
      // Comparator outputted: `def: "ADD COLUMN ... AFTER ..."` for ADD
      // So we just push the definition.

      // RE-READ Comparator Logic:
      // alterColumns.push({ type: 'ADD', name: columnName, def: def });
      // def = `${srcTable.columns[columnName]} AFTER ...`
      // It does NOT include "ADD COLUMN" prefix in the `def` variable in Comparator loop?
      // Let's check:
      // alterColumns.push(`ADD COLUMN ${srcTable.columns[columnName]...}`) in Legacy.
      // In my new Comparator:
      // const def = `${srcTable.columns[columnName].replace(/[,;]$/, '')} AFTER \`${prevColumnName || 'FIRST'}\``;
      // alterColumns.push({ type: 'ADD', ... def });
      // So `def` is just the column definition + position. It misses "ADD COLUMN".

      clauses.push(`ADD COLUMN ${op.definition}`);
    });

    addIndexes.forEach((op: IDiffOperation) => {
      // Comparator srcDef: "KEY `idx` (`col`)"
      clauses.push(`ADD ${op.definition}`);
    });

    if (clauses.length > 0) {
      const sql = `ALTER TABLE \`${tableName}\`\n${clauses.join(',\n')};`;
      statements.push(sql);
    }

    return statements;
  }
}
