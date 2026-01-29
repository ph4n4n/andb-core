import { Injectable } from '@nestjs/common';
import { MysqlMigrator } from './mysql/mysql.migrator';
import { ITableDiff } from '../../common/interfaces/diff.interface';

@Injectable()
export class MigratorService {
  private mysqlMigrator = new MysqlMigrator();

  generateAlterSQL(diff: ITableDiff): string[] {
    // Future: Switch driver here
    return this.mysqlMigrator.generateTableAlterSQL(diff);
  }
}
