import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { STORAGE_SERVICE } from '../../common/constants/tokens';

@Global()
@Module({
  providers: [
    StorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: StorageService,
    },
  ],
  exports: [StorageService, STORAGE_SERVICE],
})
export class StorageModule { }
