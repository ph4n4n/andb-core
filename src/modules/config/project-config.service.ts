import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { IDatabaseConfig, ConnectionType } from '../../common/interfaces/connection.interface';

@Injectable()
export class ProjectConfigService {
  private readonly logger = new Logger(ProjectConfigService.name);
  private config: any = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const configPath = path.join(process.cwd(), 'andb.yaml');
    if (fs.existsSync(configPath)) {
      try {
        this.config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
        this.logger.log('Loaded configuration from andb.yaml');
      } catch (e: any) {
        this.logger.error(`Error parsing andb.yaml: ${e.message}`);
      }
    }
  }

  getEnvironments(): string[] {
    return this.config.ENVIRONMENTS || ['LOCAL', 'DEV', 'UAT', 'STAGE', 'PROD'];
  }

  getDBDestination(env: string): IDatabaseConfig | null {
    if (!this.config.getDBDestination) return null;

    // Legacy mapping: andb.yaml usually has a map of envs to configs
    // or a function. In the YAML case, it's just a mapping.
    const destinations = this.config.getDBDestination;
    return destinations[env] || null;
  }

  getDBName(env: string): string {
    const config = this.getDBDestination(env);
    return config?.database || 'unknown';
  }

  getConnection(env: string): { type: ConnectionType; config: IDatabaseConfig } | null {
    const dbConfig = this.getDBDestination(env);
    if (!dbConfig) return null;

    return {
      type: (dbConfig as any).type || ConnectionType.MYSQL,
      config: dbConfig,
    };
  }

  getDomainNormalization() {
    return this.config.domainNormalization || { pattern: /(?!)/, replacement: '' };
  }

  setConnection(env: string, config: IDatabaseConfig, type: ConnectionType = ConnectionType.MYSQL) {
    if (!this.config.getDBDestination) {
      this.config.getDBDestination = {};
    }
    this.config.getDBDestination[env] = { ...config, type };
  }

  setDomainNormalization(pattern: RegExp, replacement: string) {
    this.config.domainNormalization = { pattern, replacement };
  }
}
