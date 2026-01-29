
import { Module, Global } from '@nestjs/common';
import { ProjectConfigService } from './project-config.service';

@Global()
@Module({
  providers: [ProjectConfigService],
  exports: [ProjectConfigService],
})
export class ProjectConfigModule { }
