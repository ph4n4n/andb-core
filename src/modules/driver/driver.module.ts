import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConnectionType, IDatabaseConfig } from '../../common/interfaces/connection.interface';
import { MysqlDriver } from './mysql/mysql.driver';
import { DriverFactoryService } from './driver-factory.service';
import { ParserModule } from '../parser/parser.module';
import { DRIVER_FACTORY_SERVICE } from '../../common/constants/tokens';

export const DATABASE_DRIVER = 'DATABASE_DRIVER';

@Global()
@Module({
  imports: [ParserModule],
  providers: [
    DriverFactoryService,
    {
      provide: DRIVER_FACTORY_SERVICE,
      useExisting: DriverFactoryService,
    },
  ],
  exports: [DriverFactoryService, DRIVER_FACTORY_SERVICE],
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
