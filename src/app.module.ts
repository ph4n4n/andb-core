import { Module } from '@nestjs/common';
import { GenerateCommand } from './cli/commands/generate.command';
import { HelperCommand } from './cli/commands/helper.command';
import { ExportCommand } from './cli/commands/export.command';
import { CompareCommand } from './cli/commands/compare.command';
import { MigrateCommand } from './cli/commands/migrate.command';
import { ParserModule } from './modules/parser/parser.module';
import { DriverModule } from './modules/driver/driver.module';
import { ComparatorModule } from './modules/comparator/comparator.module';
import { MigratorModule } from './modules/migrator/migrator.module';
import { ProjectConfigModule } from './modules/config/project-config.module';
import { ExporterModule } from './modules/exporter/exporter.module';
import { ReporterModule } from './modules/reporter/reporter.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ParserModule,
    DriverModule,
    ComparatorModule,
    MigratorModule,
    ProjectConfigModule,
    ExporterModule,
    ReporterModule,
    StorageModule,
  ],
  controllers: [],
  providers: [
    GenerateCommand,
    HelperCommand,
    ExportCommand,
    CompareCommand,
    MigrateCommand,
  ],
})
export class AppModule { }
