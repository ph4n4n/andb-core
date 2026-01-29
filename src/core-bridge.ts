import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ANDB_ORCHESTRATOR, STORAGE_SERVICE } from './common/constants/tokens';

export class CoreBridge {
  private static app: any = null;
  private static orchestrator: any = null;
  private static storage: any = null;

  /**
   * Initialize the Core Engine
   */
  public static async init(userDataPath?: string) {
    if (!this.app) {
      console.log('🚀 [CoreBridge] Initializing NestJS Engine...');
      this.app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

      this.orchestrator = this.app.get(ANDB_ORCHESTRATOR);
      this.storage = this.app.get(STORAGE_SERVICE);

      if (userDataPath) {
        const path = require('path');
        const dbPath = path.join(userDataPath, 'andb-storage.db');
        this.storage.initialize(dbPath);
      }
      console.log('✅ [CoreBridge] Engine Ready.');
    }
  }

  /**
   * Execute an operation via Orchestrator
   */
  public static async execute(operation: string, payload: any) {
    if (!this.orchestrator) {
      await this.init();
    }
    return await this.orchestrator.execute(operation, payload);
  }

  /**
   * Direct access to Storage for UI history/snapshots
   */
  public static async getStorage() {
    if (!this.storage) {
      await this.init();
    }
    return this.storage;
  }
}
