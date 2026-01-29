import { Injectable, Inject } from '@nestjs/common';
import {
  PROJECT_CONFIG_SERVICE,
  STORAGE_SERVICE,
  DRIVER_FACTORY_SERVICE,
  COMPARATOR_SERVICE,
  EXPORTER_SERVICE,
  MIGRATOR_SERVICE
} from '../../common/constants/tokens';

@Injectable()
export class OrchestrationService {
  constructor(
    @Inject(PROJECT_CONFIG_SERVICE) private configService: any,
    @Inject(STORAGE_SERVICE) private storageService: any,
    @Inject(DRIVER_FACTORY_SERVICE) private driverFactory: any,
    @Inject(COMPARATOR_SERVICE) private comparator: any,
    @Inject(EXPORTER_SERVICE) private exporter: any,
    @Inject(MIGRATOR_SERVICE) private migrator: any,
  ) { }

  async execute(operation: string, payload: any) {
    // Synchronize Config Service with Payload if provided
    if (payload.sourceConfig && payload.srcEnv) {
      this.configService.setConnection(payload.srcEnv, payload.sourceConfig, payload.sourceConfig.type);
    }
    if (payload.targetConfig && payload.destEnv) {
      this.configService.setConnection(payload.destEnv, payload.targetConfig, payload.targetConfig.type);
    }
    if (payload.domainNormalization) {
      this.configService.setDomainNormalization(
        new RegExp(payload.domainNormalization.pattern),
        payload.domainNormalization.replacement
      );
    }

    switch (operation) {
      case 'getSchemaObjects':
        return this.getSchemaObjects(payload);
      case 'export':
        return this.exportSchema(payload);
      case 'compare':
        return this.compareSchema(payload);
      case 'migrate':
        return this.migrateSchema(payload);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async exportSchema(payload: any) {
    const { env, name = null } = payload;
    return await this.exporter.exportSchema(env, name);
  }

  private async getSchemaObjects(payload: any) {
    const { connection, type } = payload;
    const driver = await this.getDriverFromConnection(connection);

    try {
      await driver.connect();
      const intro = driver.getIntrospectionService();
      const dbName = (connection.database || connection.name) || 'default';

      switch (type.toLowerCase()) {
        case 'tables': return await intro.listTables(dbName);
        case 'views': return await intro.listViews(dbName);
        case 'procedures': return await intro.listProcedures(dbName);
        case 'functions': return await intro.listFunctions(dbName);
        case 'triggers': return await intro.listTriggers(dbName);
        default: return [];
      }
    } finally {
      await driver.disconnect();
    }
  }

  private async compareSchema(payload: any) {
    const { srcEnv, destEnv, type = 'tables' } = payload;
    const ddlType = type.toLowerCase();

    const srcConn = this.configService.getConnection(srcEnv);
    const destConn = this.configService.getConnection(destEnv);

    const srcDriver = await this.driverFactory.create(srcConn.type, srcConn.config);
    const destDriver = await this.driverFactory.create(destConn.type, destConn.config);

    try {
      await srcDriver.connect();
      await destDriver.connect();

      const srcIntro = srcDriver.getIntrospectionService();
      const destIntro = destDriver.getIntrospectionService();
      const dbName = srcConn.config.database || 'default';
      const destDbName = destConn.config.database || 'default';

      const diff = await this.comparator.compareSchema(srcIntro, destIntro, dbName);
      const results: any[] = [];

      if (ddlType === 'tables') {
        for (const name of Object.keys(diff.tables)) {
          results.push({
            name,
            status: 'different',
            type: 'TABLES',
            ddl: this.migrator.generateAlterSQL(diff.tables[name]),
            diff: {
              source: await srcIntro.getTableDDL(dbName, name),
              target: await destIntro.getTableDDL(destDbName, name)
            }
          });
        }
        for (const name of diff.droppedTables) {
          results.push({
            name,
            status: 'missing_in_source',
            type: 'TABLES',
            ddl: [`DROP TABLE IF EXISTS \`${name}\`;`],
            diff: { source: null, target: await destIntro.getTableDDL(destDbName, name) }
          });
        }
        const srcTables = await srcIntro.listTables(dbName);
        const destTables = await destIntro.listTables(destDbName);
        for (const name of srcTables) {
          if (!destTables.includes(name)) {
            const ddl = await srcIntro.getTableDDL(dbName, name);
            results.push({
              name,
              status: 'missing_in_target',
              type: 'TABLES',
              ddl: [ddl],
              diff: { source: ddl, target: null }
            });
          }
        }
      } else {
        // Generic Objects (Procedures, Functions, Views, Triggers)
        for (const obj of diff.objects) {
          const typeMatch = obj.type.toLowerCase() + 's' === ddlType || (ddlType === 'procedures' && obj.type === 'PROCEDURE');
          if (!typeMatch) continue;

          results.push({
            name: obj.name,
            status: obj.operation === 'DROP' ? 'missing_in_source' : (obj.operation === 'CREATE' ? 'missing_in_target' : 'different'),
            type: obj.type + 'S',
            ddl: this.migrator.generateObjectSQL(obj),
            diff: {
              source: obj.operation === 'DROP' ? null : obj.definition,
              target: obj.operation === 'CREATE' ? null : (await destIntro.getObjectDDL(destDbName, obj.type, obj.name))
            }
          });
        }
      }

      return results;
    } finally {
      await srcDriver.disconnect();
      await destDriver.disconnect();
    }
  }

  private async migrateSchema(payload: any) {
    const { srcEnv, destEnv, objects } = payload;
    const destConn = this.configService.getConnection(destEnv);
    const destDriver = await this.driverFactory.create(destConn.type, destConn.config);

    const successful: any[] = [];
    const failed: any[] = [];

    try {
      await destDriver.connect();
      for (const obj of objects) {
        try {
          if (Array.isArray(obj.ddl)) {
            for (const statement of obj.ddl) {
              await destDriver.query(statement);
            }
          } else {
            await destDriver.query(obj.ddl);
          }
          successful.push(obj);
          await this.storageService.saveMigration(destEnv, destConn.config.database || 'default', obj.type, obj.name, obj.status, 'SUCCESS');
        } catch (err: any) {
          failed.push({ ...obj, error: err.message });
          await this.storageService.saveMigration(destEnv, destConn.config.database || 'default', obj.type, obj.name, obj.status, 'FAILED', err.message);
        }
      }
      return { success: true, successful, failed };
    } finally {
      await destDriver.disconnect();
    }
  }

  private async getDriverFromConnection(connection: any) {
    const config = {
      host: connection.host,
      port: connection.port,
      database: connection.database || connection.name,
      user: connection.username,
      password: connection.password || '',
    };
    const connType = (connection as any).type === 'dump' || connection.host === 'file' ? 'dump' : 'mysql';
    return await this.driverFactory.create(connType, config);
  }
}
