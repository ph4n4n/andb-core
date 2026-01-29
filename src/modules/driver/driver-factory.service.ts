
import { Injectable } from '@nestjs/common';
import { IDatabaseConfig, ConnectionType } from '../../common/interfaces/connection.interface';
import { MysqlDriver } from './mysql/mysql.driver';
import { IDatabaseDriver } from '../../common/interfaces/driver.interface';
import { DumpDriver } from './dump/dump.driver';
import { ParserService } from '../parser/parser.service';

@Injectable()
export class DriverFactoryService {
  constructor(private readonly parser: ParserService) { }

  async create(type: ConnectionType, config: IDatabaseConfig): Promise<IDatabaseDriver> {
    if (type === 'mysql' || type === 'mariadb') {
      return new MysqlDriver(config);
    }

    if (type === 'dump') {
      return new DumpDriver(config, this.parser);
    }

    throw new Error(`Unsupported connection type: ${type}`);
  }
}
