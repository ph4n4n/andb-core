import { Module } from '@nestjs/common';
import { ReporterService } from './reporter.service';

@Module({
  providers: [ReporterService],
  exports: [ReporterService],
})
export class ReporterModule { }
