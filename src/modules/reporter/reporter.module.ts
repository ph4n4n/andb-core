import { Module } from '@nestjs/common';
import { ReporterService } from './reporter.service';
import { REPORTER_SERVICE } from '../../common/constants/tokens';

@Module({
  providers: [
    ReporterService,
    {
      provide: REPORTER_SERVICE,
      useExisting: ReporterService,
    },
  ],
  exports: [ReporterService, REPORTER_SERVICE],
})
export class ReporterModule { }
