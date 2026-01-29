import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ComparatorService } from '../src/modules/comparator/comparator.service';
import { DriverFactoryService } from '../src/modules/driver/driver-factory.service';
import { MigratorService } from '../src/modules/migrator/migrator.service';
import * as path from 'path';
import { ConnectionType } from '../src/common/interfaces/connection.interface';
import { IObjectDiff } from '../src/common/interfaces/diff.interface';

async function testFullSchemaComparison() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const comparator = app.get(ComparatorService);
  const driverFactory = app.get(DriverFactoryService);
  const migrator = app.get(MigratorService);

  const f1Path = path.join(process.cwd(), 'scripts', 'f1.sql');
  const ddl2File = path.join(process.cwd(), 'scripts', 'f2.sql');

  console.log('--- Testing Full Schema Comparison (f1.sql vs f2.sql) ---');

  const srcDriver = await driverFactory.create(ConnectionType.DUMP, { path: f1Path } as any);
  const destDriver = await driverFactory.create(ConnectionType.DUMP, { path: ddl2File } as any);

  const srcRepo = srcDriver.getIntrospectionService();
  const destRepo = destDriver.getIntrospectionService();

  const diff = await comparator.compareSchema(srcRepo, destRepo, 'test_db');

  console.log('Summary:', JSON.stringify(diff.summary, null, 2));
  console.log('Tables Changed:', Object.keys(diff.tables));
  console.log('Dropped Tables:', diff.droppedTables);
  console.log('Objects Changed:', diff.objects.map((o: IObjectDiff) => `${o.type} ${o.name} (${o.operation})`));

  const sql = migrator.generateSchemaSQL(diff);
  console.log('\n--- Generated Migration SQL ---');
  console.log(sql.join('\n'));

  await app.close();
}

testFullSchemaComparison().catch(console.error);
