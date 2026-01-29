import { Module } from '@nestjs/common';
import { MigratorService } from './migrator.service';

@Module({
  providers: [MigratorService],
  exports: [MigratorService],
})
export class MigratorModule {}
