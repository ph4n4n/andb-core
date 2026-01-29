import {
  IIntrospectionService,
  IDatabaseDriver,
} from '../../../common/interfaces/driver.interface';
import { ParserService } from '../../parser/parser.service';
import { RowDataPacket } from 'mysql2';

export class MysqlIntrospectionService implements IIntrospectionService {
  constructor(
    private readonly driver: IDatabaseDriver,
    private readonly parser: ParserService,
  ) {}

  async listTables(_dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>('SHOW TABLES');
    return results.map((row) => Object.values(row)[0] as string);
  }

  async listViews(_dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>(
      "SHOW FULL TABLES WHERE Table_type = 'VIEW'",
    );
    return results.map((row) => Object.values(row)[0] as string);
  }

  async listProcedures(dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>(
      'SHOW PROCEDURE STATUS WHERE LOWER(Db) = LOWER(?)',
      [dbName],
    );
    return results.map((row) => row.Name);
  }

  async listFunctions(dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>(
      'SHOW FUNCTION STATUS WHERE LOWER(Db) = LOWER(?)',
      [dbName],
    );
    return results.map((row) => row.Name);
  }

  async listTriggers(_dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>('SHOW TRIGGERS');
    return results.map((row) => row.Trigger);
  }

  async listEvents(dbName: string): Promise<string[]> {
    const results = await this.driver.query<RowDataPacket[]>('SHOW EVENTS WHERE Db = ?', [dbName]);
    return results.map((row) => row.Name);
  }

  // --- DDL Retrieval ---

  private _normalizeDDL(ddl: string): string {
    return this.parser.cleanDefiner(ddl); // Basic cleaning for now, extend if needed
  }

  async getTableDDL(dbName: string, tableName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';

    // Check if it's a view
    if (row['Create View']) return '';

    let ddl = row['Create Table'];
    // Cleanup Auto Increment
    ddl = ddl.replace(/AUTO_INCREMENT=\d+\s/, '');
    return this._normalizeDDL(ddl);
  }

  async getViewDDL(dbName: string, viewName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(`SHOW CREATE VIEW \`${viewName}\``);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';
    return this._normalizeDDL(row['Create View']);
  }

  async getProcedureDDL(dbName: string, procName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(
      `SHOW CREATE PROCEDURE \`${procName}\``,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';
    return this._normalizeDDL(row['Create Procedure']);
  }

  async getFunctionDDL(dbName: string, funcName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(`SHOW CREATE FUNCTION \`${funcName}\``);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';
    return this._normalizeDDL(row['Create Function']);
  }

  async getTriggerDDL(dbName: string, triggerName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(
      `SHOW CREATE TRIGGER \`${triggerName}\``,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';

    let ddl = row['SQL Original Statement'];
    // Trigger cleanup (Naive regex port from legacy)
    ddl = ddl
      .replace(/\sDEFINER=`[^`]+`@`[^`]+`\s/g, ' ')
      .replace(/\sCOLLATE\s+\w+\s/, ' ')
      .replace(/\sCHARSET\s+\w+\s/, ' ');

    return this._normalizeDDL(ddl);
  }

  async getEventDDL(dbName: string, eventName: string): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>(`SHOW CREATE EVENT \`${eventName}\``);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = result[0] as any;
    if (!row) return '';
    return this._normalizeDDL(row['Create Event']);
  }

  async getChecksums(dbName: string): Promise<Record<string, string>> {
    const results = await this.driver.query<RowDataPacket[]>(
      `
      SELECT TABLE_NAME, CHECKSUM, UPDATE_TIME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `,
      [dbName],
    );

    // Convert to Record<string, string>
    const map: Record<string, string> = {};
    for (const row of results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      map[r.TABLE_NAME] = `${r.CHECKSUM || ''}|${r.UPDATE_TIME || ''}`;
    }
    return map;
  }
}
