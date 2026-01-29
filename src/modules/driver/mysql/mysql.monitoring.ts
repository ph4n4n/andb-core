import { IDatabaseDriver, IMonitoringService } from '../../../common/interfaces/driver.interface';
import { RowDataPacket } from 'mysql2';

export class MysqlMonitoringService implements IMonitoringService {
  constructor(private readonly driver: IDatabaseDriver) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getProcessList(): Promise<any[]> {
    return this.driver.query('SHOW FULL PROCESSLIST');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getStatus(): Promise<any> {
    return this.driver.query('SHOW STATUS');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getVariables(): Promise<any> {
    return this.driver.query('SHOW VARIABLES');
  }

  async getVersion(): Promise<string> {
    const result = await this.driver.query<RowDataPacket[]>('SELECT VERSION() AS version');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result[0] as any).version;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getConnections(): Promise<any> {
    return this.driver.query(`
        SELECT COUNT(*) connections, pl.* 
          FROM information_schema.PROCESSLIST pl
         GROUP BY pl.user
         ORDER BY 1 DESC;
      `);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTransactions(): Promise<any> {
    return this.driver.query(`
        SELECT * 
          FROM information_schema.innodb_trx 
         WHERE trx_state IS NOT NULL;
      `);
  }
}
