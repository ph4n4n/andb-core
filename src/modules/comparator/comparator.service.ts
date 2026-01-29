import { Injectable, Logger } from '@nestjs/common';
import { ParserService } from '../parser/parser.service';
import { IDiffOperation, ITableDiff, IObjectDiff } from '../../common/interfaces/diff.interface';

@Injectable()
export class ComparatorService {
  private readonly logger = new Logger(ComparatorService.name);

  constructor(private readonly parser: ParserService) {}

  /**
   * Compare two CREATE TABLE statements and return differences
   */
  compareTables(srcDDL: string, destDDL: string): ITableDiff {
    const srcTable = this.parser.parseTable(srcDDL);
    const destTable = this.parser.parseTable(destDDL);

    // Fallback if parsing fails (should not happen if DDL is valid)
    if (!srcTable || !destTable) {
      return { tableName: 'unknown', operations: [], hasChanges: false };
    }

    const tableName = srcTable.tableName;
    const operations: IDiffOperation[] = [];

    // 1. Compare Columns
    const { alterColumns, missingColumns } = this.compareColumns(srcTable, destTable);

    // Convert logic results to IDiffOperations
    alterColumns.forEach((op) => {
      if (op.type === 'ADD') {
        operations.push({
          type: 'ADD',
          target: 'COLUMN',
          name: op.name,
          tableName,
          definition: op.def,
        });
      } else if (op.type === 'MODIFY') {
        operations.push({
          type: 'MODIFY',
          target: 'COLUMN',
          name: op.name,
          tableName,
          definition: op.def,
        });
      }
    });

    missingColumns.forEach((colName) => {
      operations.push({ type: 'DROP', target: 'COLUMN', name: colName, tableName });
    });

    // 2. Compare Indexes
    const indexOps = this.compareIndexes(srcTable, destTable);
    indexOps.forEach((op) => {
      operations.push({ ...op, tableName });
    });

    return {
      tableName,
      operations,
      hasChanges: operations.length > 0,
    };
  }

  /**
   * Normalize a definition for comparison
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _normalizeDef(def: string): string {
    if (!def) return '';
    let processed = def.replace(/,$/, '').trim();

    // 1. Normalize Integer Types (MySQL 8.0 ignores display width)
    processed = processed.replace(/(TINYINT|SMALLINT|MEDIUMINT|INT|INTEGER|BIGINT)\(\d+\)/gi, '$1');

    // 2. Clear MySQL Version Comments
    processed = processed.replace(/\/\*!\d+\s*([^/]+)\*\//g, '$1');

    // 3. Normalize spacing and casing
    processed = processed.toUpperCase().replace(/\s+/g, ' ').trim();

    return processed;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compareColumns(srcTable: any, destTable: any) {
    const alterColumns: { type: 'ADD' | 'MODIFY'; name: string; def: string }[] = [];
    const missingColumns: string[] = [];
    let prevColumnName = null;

    // Check for ADD / MODIFY
    for (const columnName in srcTable.columns) {
      if (!destTable.columns[columnName]) {
        // ADD
        const def = `${srcTable.columns[columnName].replace(/[,;]$/, '')} AFTER \`${prevColumnName || 'FIRST'}\``;
        alterColumns.push({ type: 'ADD', name: columnName, def: def });
      } else {
        // Check MODIFY
        const srcColumnDef = srcTable.columns[columnName];
        const destColumnDef = destTable.columns[columnName];

        const normSrc = this._normalizeDef(srcColumnDef);
        const normDest = this._normalizeDef(destColumnDef);

        if (normSrc !== normDest) {
          // Logic from Legacy: Check collation exception
          const srcCollation = srcColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
          if (srcCollation === undefined) {
            const destCollation = destColumnDef.match(/COLLATE\s+(\w+)/)?.[1];
            if (destCollation === 'latin1_swedish_ci') {
              // Skip implicit collation diff
            } else {
              alterColumns.push({ type: 'MODIFY', name: columnName, def: srcColumnDef });
            }
          } else {
            alterColumns.push({ type: 'MODIFY', name: columnName, def: srcColumnDef });
          }
        }
      }
      prevColumnName = columnName;
    }

    // Check for DROP
    for (const destColName in destTable.columns) {
      if (!srcTable.columns[destColName]) {
        missingColumns.push(destColName);
      }
    }

    return { alterColumns, missingColumns };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compareIndexes(srcTable: any, destTable: any): IDiffOperation[] {
    const ops: IDiffOperation[] = [];

    // 1. Check for new or changed indexes
    for (const indexName in srcTable.indexes) {
      const srcDef = srcTable.indexes[indexName].replace(/,$/, '').trim();

      if (!destTable.indexes[indexName]) {
        // ADD
        ops.push({ type: 'ADD', target: 'INDEX', name: indexName, definition: srcDef });
      } else {
        // COMPARE
        const destDef = destTable.indexes[indexName].replace(/,$/, '').trim();
        const normSrc = this._normalizeDef(srcDef);
        const normDest = this._normalizeDef(destDef);

        if (normSrc !== normDest) {
          // DROP + ADD (Modify)
          // Legacy logic was: push DROP then push ADD string.
          // Here we return explicit ops
          ops.push({ type: 'DROP', target: 'INDEX', name: indexName });
          ops.push({ type: 'ADD', target: 'INDEX', name: indexName, definition: srcDef });
        }
      }
    }

    // 2. Check for deprecated indexes
    for (const indexName in destTable.indexes) {
      if (!srcTable.indexes[indexName]) {
        ops.push({ type: 'DROP', target: 'INDEX', name: indexName });
      }
    }

    return ops;
  }

  /**
   * Compare generic DDL objects (Views, Procedures, Functions, Events)
   */
  compareGenericDDL(
    type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'EVENT',
    name: string,
    srcDDL: string,
    destDDL: string,
  ): IObjectDiff | null {
    if (!srcDDL && !destDDL) return null;

    if (srcDDL && !destDDL) {
      return { type, name, operation: 'CREATE', definition: srcDDL };
    }

    if (!srcDDL && destDDL) {
      return { type, name, operation: 'DROP' };
    }

    const normSrc = this.parser.normalize(srcDDL, { ignoreDefiner: true, ignoreWhitespace: true });
    const normDest = this.parser.normalize(destDDL, {
      ignoreDefiner: true,
      ignoreWhitespace: true,
    });

    if (normSrc !== normDest) {
      return { type, name, operation: 'REPLACE', definition: srcDDL };
    }

    return null;
  }

  /**
   * Compare two TRIGGERS
   */
  compareTriggers(name: string, srcDDL: string, destDDL: string): IObjectDiff | null {
    if (!srcDDL && !destDDL) return null;
    if (srcDDL && !destDDL)
      return { type: 'TRIGGER', name, operation: 'CREATE', definition: srcDDL };
    if (!srcDDL && destDDL) return { type: 'TRIGGER', name, operation: 'DROP' };

    const srcTrigger = this.parser.parseTrigger(srcDDL);
    const destTrigger = this.parser.parseTrigger(destDDL);

    if (!srcTrigger || !destTrigger) {
      // Fallback to string compare
      return this.compareGenericDDL('TRIGGER' as any, name, srcDDL, destDDL);
    }

    // Specialized compare logic from Legacy
    const hasChanges =
      srcTrigger.timing !== destTrigger.timing ||
      srcTrigger.event !== destTrigger.event ||
      srcTrigger.tableName !== destTrigger.tableName ||
      this.parser.normalize(srcDDL, { ignoreDefiner: true, ignoreWhitespace: true }) !==
        this.parser.normalize(destDDL, { ignoreDefiner: true, ignoreWhitespace: true });

    if (hasChanges) {
      return { type: 'TRIGGER', name, operation: 'REPLACE', definition: srcDDL };
    }

    return null;
  }
}
