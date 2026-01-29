
import { DumpDriver } from '../src/modules/driver/dump/dump.driver';
import { ParserService } from '../src/modules/parser/parser.service';
import { ComparatorService } from '../src/modules/comparator/comparator.service';
import { MigratorService } from '../src/modules/migrator/migrator.service';
import * as path from 'path';

/**
 * Real-world test using provided dump files f1.sql and f2.sql
 */
async function runRealWorldTest() {
  console.log('🚀 Starting Real World Dump Test');
  console.log('------------------------------------------------');

  const f1Path = path.join(process.cwd(), 'scripts', 'f1.sql');
  const ddl2File = path.join(process.cwd(), 'scripts', 'f2.sql');

  const parser = new ParserService();

  // 1. Initialize Drivers for f1 and f2
  const driver1 = new DumpDriver(
    { host: f1Path, user: '', password: '', database: '', port: 0 },
    parser,
  );
  const driver2 = new DumpDriver(
    { host: ddl2File, user: '', password: '', database: '', port: 0 },
    parser,
  );

  await driver1.connect();
  await driver2.connect();

  console.log(`✅ Loaded f1.sql: ${driver1.data.TABLES.size} tables`);
  console.log(`✅ Loaded f2.sql: ${driver2.data.TABLES.size} tables`);

  // 2. Initialize Services
  const comparator = new ComparatorService(parser);
  const migrator = new MigratorService();

  const service1 = driver1.getIntrospectionService();
  const service2 = driver2.getIntrospectionService();

  const tables1 = await service1.listTables('db');

  // 3. Compare All Tables (f1 vs f2)
  // Assuming f1 is Source (Target state), f2 is Dest (Current state) -> Migrate f2 to f1?
  // Or vice versa. Let's assume we want to migrate f2 to become f1.

  console.log('⚔️  Comparing f1 (Target) vs f2 (Current)...');

  let totalChanges = 0;
  let totalOps = 0;

  for (const tableName of tables1) {
    const ddl1 = await service1.getTableDDL('db', tableName);
    const ddl2 = await service2.getTableDDL('db', tableName);

    if (!ddl2) {
      console.log(`   [NEW TABLE] ${tableName}`);
      // Core migrator doesn't handle CREATE TABLE from scratch yet (only ALTER) in this version
      // But we can detect it.
      continue;
    }

    const diff = comparator.compareTables(ddl1, ddl2);
    if (diff.hasChanges) {
      console.log(`   ⚠️  Table \`${tableName}\` has changes:`);
      diff.operations.forEach(op => console.log(`      - [${op.type}] ${op.target} ${op.name}`));

      const sql = migrator.generateAlterSQL(diff);
      if (sql.length > 0) {
        console.log(`      📜 SQL: ${sql[0].replace(/\n/g, ' ')}`);
      }
      totalChanges++;
      totalOps += diff.operations.length;
    }
  }

  console.log('------------------------------------------------');
  console.log(`📊 Summary: ${totalChanges} tables w/ changes, ${totalOps} total operations.`);

  if (totalChanges === 0) {
    console.log('✅ Files are identical (structurally)!');
  }
}

runRealWorldTest().catch(err => console.error(err));
