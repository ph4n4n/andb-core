import { Module } from '@nestjs/common';
import { ExporterService } from './exporter.service';
import { DriverModule } from '../driver/driver.module';
import { ProjectConfigModule } from '../config/project-config.module';

@Module({
  imports: [DriverModule, ProjectConfigModule],
  providers: [ExporterService],
  exports: [ExporterService],
})
export class ExporterModule { }
