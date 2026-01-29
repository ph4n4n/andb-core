import { Injectable, Logger } from '@nestjs/common';
import { DriverFactoryService } from '../driver/driver-factory.service';
import { ProjectConfigService } from '../config/project-config.service';
import * as fs from 'fs';
import * as path from 'path';
import { ConnectionType } from '../../common/interfaces/connection.interface';

@Injectable()
export class ExporterService {
  private readonly logger = new Logger(ExporterService.name);

  constructor(
    private readonly driverFactory: DriverFactoryService,
    private readonly configService: ProjectConfigService,
  ) { }

  async exportSchema(envName: string, specificName?: string) {
    const connection = this.configService.getConnection(envName);
    if (!connection) {
      throw new Error(`Connection not found for env: ${envName}`);
    }

    const driver = await this.driverFactory.create(connection.type, connection.config);
    try {
      await driver.connect();
      const introspection = driver.getIntrospectionService();
      const dbName = connection.config.database || 'default';

      const baseDir = path.join(process.cwd(), 'db', envName, dbName);
      this._ensureDir(baseDir);
      this._ensureDir(path.join(baseDir, 'current-ddl'));

      const types = ['TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EVENT'] as const;
      const summary: Record<string, number> = {};

      for (const type of types) {
        const pluralType = `${type}S` as const;
        const dir = path.join(baseDir, pluralType.toLowerCase());
        this._ensureDir(dir);

        const list = await this._listObjects(introspection, dbName, type, specificName);
        summary[pluralType] = list.length;

        const exportedNames: string[] = [];
        for (const name of list) {
          const ddl = await this._getDDL(introspection, dbName, type, name);
          if (ddl) {
            fs.writeFileSync(path.join(dir, `${name}.sql`), ddl);
            exportedNames.push(name);
          }
        }

        // Save list file for parity with legacy
        if (!specificName) {
          fs.writeFileSync(
            path.join(baseDir, 'current-ddl', `${pluralType.toLowerCase()}.list`),
            exportedNames.join('\n'),
          );
        }
      }

      this.logger.log(`Exported schema for ${envName}: ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      await driver.disconnect();
    }
  }

  private _ensureDir(p: string) {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }

  private async _listObjects(
    introspection: any,
    dbName: string,
    type: string,
    specificName?: string,
  ): Promise<string[]> {
    if (specificName) return [specificName];

    switch (type) {
      case 'TABLE':
        return introspection.listTables(dbName);
      case 'VIEW':
        return introspection.listViews(dbName);
      case 'PROCEDURE':
        return introspection.listProcedures(dbName);
      case 'FUNCTION':
        return introspection.listFunctions(dbName);
      case 'TRIGGER':
        return introspection.listTriggers(dbName);
      case 'EVENT':
        return introspection.listEvents(dbName);
      default:
        return [];
    }
  }

  private async _getDDL(
    introspection: any,
    dbName: string,
    type: string,
    name: string,
  ): Promise<string> {
    switch (type) {
      case 'TABLE':
        return introspection.getTableDDL(dbName, name);
      case 'VIEW':
        return introspection.getViewDDL(dbName, name);
      case 'PROCEDURE':
        return introspection.getProcedureDDL(dbName, name);
      case 'FUNCTION':
        return introspection.getFunctionDDL(dbName, name);
      case 'TRIGGER':
        return introspection.getTriggerDDL(dbName, name);
      case 'EVENT':
        return introspection.getEventDDL(dbName, name);
      default:
        return '';
    }
  }
}
