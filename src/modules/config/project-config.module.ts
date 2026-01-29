import { Module, Global } from '@nestjs/common';
import { ProjectConfigService } from './project-config.service';
import { PROJECT_CONFIG_SERVICE } from '../../common/constants/tokens';

@Global()
@Module({
  providers: [
    ProjectConfigService,
    {
      provide: PROJECT_CONFIG_SERVICE,
      useExisting: ProjectConfigService,
    },
  ],
  exports: [ProjectConfigService, PROJECT_CONFIG_SERVICE],
})
export class ProjectConfigModule { }
