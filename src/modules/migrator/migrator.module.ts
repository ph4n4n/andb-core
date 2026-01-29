import { Module } from '@nestjs/common';
import { MigratorService } from './migrator.service';
import { MIGRATOR_SERVICE } from '../../common/constants/tokens';

@Module({
  providers: [
    MigratorService,
    {
      provide: MIGRATOR_SERVICE,
      useExisting: MigratorService,
    },
  ],
  exports: [MigratorService, MIGRATOR_SERVICE],
})
export class MigratorModule { }
