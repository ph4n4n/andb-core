import { IIntrospectionService } from '../../../common/interfaces/driver.interface';
import { DumpDriver } from './dump.driver';

export class DumpIntrospectionService implements IIntrospectionService {
  constructor(private readonly driver: DumpDriver) {}

  private _list(type: string): string[] {
    const map = this.driver.data[type];
    if (!map) return [];
    return Array.from(map.keys());
  }

  private _get(type: string, name: string): string {
    return this.driver.data[type]?.get(name) || '';
  }

  async listTables(): Promise<string[]> {
    return this._list('TABLES');
  }
  async listViews(): Promise<string[]> {
    return this._list('VIEWS');
  }
  async listProcedures(): Promise<string[]> {
    return this._list('PROCEDURES');
  }
  async listFunctions(): Promise<string[]> {
    return this._list('FUNCTIONS');
  }
  async listTriggers(): Promise<string[]> {
    return this._list('TRIGGERS');
  }
  async listEvents(): Promise<string[]> {
    return this._list('EVENTS');
  }

  async getTableDDL(db: string, name: string): Promise<string> {
    return this._get('TABLES', name);
  }
  async getViewDDL(db: string, name: string): Promise<string> {
    return this._get('VIEWS', name);
  }
  async getProcedureDDL(db: string, name: string): Promise<string> {
    return this._get('PROCEDURES', name);
  }
  async getFunctionDDL(db: string, name: string): Promise<string> {
    return this._get('FUNCTIONS', name);
  }
  async getTriggerDDL(db: string, name: string): Promise<string> {
    return this._get('TRIGGERS', name);
  }
  async getEventDDL(db: string, name: string): Promise<string> {
    return this._get('EVENTS', name);
  }

  async getChecksums(): Promise<Record<string, string>> {
    return {};
  }
}
