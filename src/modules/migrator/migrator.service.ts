import { Injectable } from '@nestjs/common';
import { MysqlMigrator } from './mysql/mysql.migrator';
import { ITableDiff, ISchemaDiff, IObjectDiff } from '../../common/interfaces/diff.interface';

@Injectable()
export class MigratorService {
  private mysqlMigrator = new MysqlMigrator();

  generateAlterSQL(diff: ITableDiff): string[] {
    // Future: Switch driver here
    return this.mysqlMigrator.generateTableAlterSQL(diff);
  }

  generateObjectSQL(obj: IObjectDiff): string[] {
    return this.mysqlMigrator.generateObjectSQL(obj);
  }

  generateSchemaSQL(schemaDiff: ISchemaDiff): string[] {
    const allStatements: string[] = [];

    // 1. Drop Objects (Views, Procedures, etc.) - To avoid dependency issues if replaced
    // and Tables (Dropped)
    for (const tableName of schemaDiff.droppedTables) {
      allStatements.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
    }

    const dropOperations = schemaDiff.objects.filter((obj) => obj.operation === 'DROP');
    for (const obj of dropOperations) {
      allStatements.push(...this.mysqlMigrator.generateObjectSQL(obj));
    }

    // 2. Table Alters
    for (const tableName in schemaDiff.tables) {
      const tableDiff = schemaDiff.tables[tableName];
      allStatements.push(...this.mysqlMigrator.generateTableAlterSQL(tableDiff));
    }

    // 3. Create/Replace Objects
    const createReplaceOperations = schemaDiff.objects.filter((obj) => obj.operation !== 'DROP');
    for (const obj of createReplaceOperations) {
      allStatements.push(...this.mysqlMigrator.generateObjectSQL(obj));
    }

    return allStatements;
  }
}
