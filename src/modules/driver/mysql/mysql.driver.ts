import {
  IDatabaseDriver,
  IDatabaseConfig,
  IIntrospectionService,
  IMonitoringService,
} from '../../../common/interfaces/driver.interface';
import { MysqlIntrospectionService } from './mysql.introspection';
import { MysqlMonitoringService } from './mysql.monitoring';
import * as mysql from 'mysql2/promise'; // Use promise wrapper natively
import { Logger } from '@nestjs/common';
import { ParserService } from '../../parser/parser.service'; // We need this for Introspection

export class MysqlDriver implements IDatabaseDriver {
  private connection: mysql.Connection | null = null;
  private readonly logger = new Logger(MysqlDriver.name);

  // Cache services
  private introspectionService?: IIntrospectionService;
  private monitoringService?: IMonitoringService;
  private parserService: ParserService;

  constructor(private readonly config: IDatabaseConfig) {
    this.parserService = new ParserService(); // Instantiate directly or inject if we refactor Driver to be Injectable
  }

  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host === 'localhost' ? '127.0.0.1' : this.config.host,
        port: this.config.port || 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        multipleStatements: true,
      });

      // Session hygiene
      await this.connection.query(
        "SET SESSION sql_mode = 'NO_AUTO_VALUE_ON_ZERO,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
      );
      await this.connection.query("SET NAMES 'utf8mb4'");

      this.logger.log(`Connected to MySQL at ${this.config.host}`);
    } catch (err: unknown) {
      // Cast to Error to access message safely
      const error = err as Error;
      this.logger.error(`MySQL Connection Failed: ${error.message}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.connection) {
      await this.connect();
    }
    // mysql2 execute returns [rows, fields], we usually just want rows
    // using query() instead of execute() for better compatibility with un-prepared statements if needed
    // but allow prepared statements via params
    const [rows] = await this.connection!.query(sql, params);
    return rows as T;
  }

  getIntrospectionService(): IIntrospectionService {
    if (!this.introspectionService) {
      this.introspectionService = new MysqlIntrospectionService(this, this.parserService);
    }
    return this.introspectionService;
  }

  getMonitoringService(): IMonitoringService {
    if (!this.monitoringService) {
      this.monitoringService = new MysqlMonitoringService(this);
    }
    return this.monitoringService;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getSessionContext(): Promise<any> {
    const results = await this.query(`
      SELECT 
        @@session.sql_mode as sql_mode,
        @@session.time_zone as time_zone,
        @@session.wait_timeout as lock_wait_timeout,
        @@session.character_set_results as charset
    `);
    return Array.isArray(results) ? results[0] : results;
  }

  async setForeignKeyChecks(enabled: boolean): Promise<void> {
    const value = enabled ? 1 : 0;
    await this.query(`SET FOREIGN_KEY_CHECKS = ${value};`);
  }
}
