import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConnectionType, IDatabaseConfig } from '../../common/interfaces/connection.interface';
import { MysqlDriver } from './mysql/mysql.driver';
import { DriverFactoryService } from './driver-factory.service';

export const DATABASE_DRIVER = 'DATABASE_DRIVER';

@Global()
@Module({
  providers: [DriverFactoryService],
  exports: [DriverFactoryService],
})
export class DriverModule {
  static forRoot(type: ConnectionType, config: IDatabaseConfig): DynamicModule {
    const providers = [
      {
        provide: DATABASE_DRIVER,
        useFactory: async () => {
          const driver = new MysqlDriver(config);
          return driver;
        },
      },
    ];

    return {
      module: DriverModule,
      providers: providers,
      exports: providers,
    };
  }
}
