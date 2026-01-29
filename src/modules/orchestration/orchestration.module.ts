import { Module, Global } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { ANDB_ORCHESTRATOR } from '../../common/constants/tokens';
import { ComparatorModule } from '../comparator/comparator.module';
import { ExporterModule } from '../exporter/exporter.module';
import { MigratorModule } from '../migrator/migrator.module';
import { DriverModule } from '../driver/driver.module';
import { ProjectConfigModule } from '../config/project-config.module';
import { StorageModule } from '../storage/storage.module';

@Global()
@Module({
  imports: [
    DriverModule,
    ComparatorModule,
    ExporterModule,
    MigratorModule,
    ProjectConfigModule,
    StorageModule,
  ],
  providers: [
    OrchestrationService,
    {
      provide: ANDB_ORCHESTRATOR,
      useExisting: OrchestrationService,
    },
  ],
  exports: [ANDB_ORCHESTRATOR],
})
export class OrchestrationModule { }
