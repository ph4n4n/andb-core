import {
  IDatabaseDriver,
  IIntrospectionService,
  IMonitoringService,
  IDatabaseConfig,
} from '../../../common/interfaces/driver.interface';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DumpIntrospectionService } from './dump.introspection';
import { ParserService } from '../../parser/parser.service';

export class DumpDriver implements IDatabaseDriver {
  private readonly logger = new Logger(DumpDriver.name);
  // Store DDLs by type
  public data: Record<string, Map<string, string>> = {
    TABLES: new Map(),
    VIEWS: new Map(),
    PROCEDURES: new Map(),
    FUNCTIONS: new Map(),
    TRIGGERS: new Map(),
    EVENTS: new Map(),
  };

  private parserService: ParserService;
  private introspectionService?: IIntrospectionService;

  constructor(private readonly config: IDatabaseConfig) {
    this.parserService = new ParserService();
  }

  async connect(): Promise<void> {
    // DumpPath is usually passed via host or a specific field if we extended the interface
    // Ideally IDatabaseConfig should have extra fields, but for now we look at 'host' or 'database' as path
    // if type is "dump".
    // Wait, the factory decides.
    // Let's assume config.host contains the path for now or we add a property.
    // Core legacy used `config.dumpPath || config.host`.

    // Check if IDatabaseDriver has arbitrary props? It is strict.
    // We will cast config for now or assume host is the path.
    const dumpPath = this.config.host;

    if (!dumpPath) {
      throw new Error('Dump file path is required (in host field)');
    }

    let resolvedPath = dumpPath;
    if (dumpPath.startsWith('./') || dumpPath.startsWith('../')) {
      resolvedPath = path.resolve(process.cwd(), dumpPath);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Dump file not found: ${resolvedPath}`);
    }

    this.logger.log(`Parsing dump file: ${resolvedPath}`);
    // Check if file is too big? 2MB is fine.
    const content = fs.readFileSync(resolvedPath, 'utf8');
    this._parseDump(content);

    const count = this.data.TABLES.size;
    this.logger.log(`Parsed ${count} tables from dump.`);
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T = any>(sql: string): Promise<T> {
    this.logger.warn(`Query on DumpDriver is not supported: ${sql}`);
    return [] as unknown as T;
  }

  getIntrospectionService(): IIntrospectionService {
    if (!this.introspectionService) {
      this.introspectionService = new DumpIntrospectionService(this);
    }
    return this.introspectionService;
  }

  getMonitoringService(): IMonitoringService {
    // Stub
    return {
      getProcessList: async () => [],
      getStatus: async () => ({}),
      getVariables: async () => ({}),
      getVersion: async () => 'Dump-1.0',
      getConnections: async () => [],
      getTransactions: async () => [],
    };
  }

  async getSessionContext(): Promise<unknown> {
    return {};
  }

  async setForeignKeyChecks(_enabled: boolean): Promise<void> {
    // No-op
  }

  /**
   * Stateful dump parser (Ported from Legacy DumpDriver.js)
   */
  private _parseDump(content: string) {
    if (!content) return;

    // 1. Remove comments but keep pragmas
    const cleaned = content.replace(/(\/\*([\s\S]*?)\*\/)|(--.*)|(#.*)/g, (match) => {
      if (match.startsWith('/*!')) {
        // Executable comment: /*!50003 CREATE ... */ -> CREATE ...
        return match.replace(/^\/\*!\d*\s*/, '').replace(/\s*\*\/$/, ' ');
      }
      return '';
    });

    const lines = cleaned.split('\n');
    let buffer: string[] = [];
    let inBeginEndBlock = 0;
    let currentDelimiter = ';';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // DELIMITER logic
      if (trimmed.toUpperCase().startsWith('DELIMITER')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1) {
          currentDelimiter = parts[1];
        }
        continue;
      }

      // BEGIN...END tracking (naive regex)
      const upper = trimmed.toUpperCase();
      if (/\bBEGIN\b/.test(upper)) inBeginEndBlock++;
      if (/\bEND\b/.test(upper)) inBeginEndBlock--;

      buffer.push(line);

      // Check statement complete
      const isActuallyDelimited =
        trimmed.endsWith(currentDelimiter) && (currentDelimiter !== ';' || inBeginEndBlock <= 0);

      if (isActuallyDelimited) {
        let stmt = buffer.join('\n').trim();
        if (stmt.endsWith(currentDelimiter)) {
          stmt = stmt.substring(0, stmt.length - currentDelimiter.length).trim();
        }

        if (stmt) {
          this._processStatement(stmt);
        }
        buffer = [];
        inBeginEndBlock = 0;
      }
    }
  }

  private _processStatement(stmt: string) {
    const normalized = stmt.replace(/\s+/g, ' ');
    // Detect CREATE statement
    const createMatch = normalized.match(
      /CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:DEFINER\s*=\s*(?:'[^']+'|`[^`]+`|\S+)|ALGORITHM\s*=\s*\S+|SQL\s+SECURITY\s+\S+)\s+)*(TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`)|(?:[^\s\(\)]+))/i,
    );

    if (!createMatch) return;

    const typeKey = createMatch[1].toUpperCase() + 'S'; // TABLE -> TABLES
    const rawName = createMatch[2];
    const name = this._extractName(rawName);

    if (name && this.data[typeKey]) {
      this.data[typeKey].set(name, stmt + ';');
    }
  }

  private _extractName(rawName: string): string | null {
    if (!rawName) return null;
    let name = rawName.replace(/[`"']/g, '');
    if (name.includes('.')) {
      name = name.split('.').pop() || name;
    }
    return name;
  }
}
