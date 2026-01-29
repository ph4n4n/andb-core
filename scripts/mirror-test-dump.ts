
import { DumpDriver } from '../src/modules/driver/dump/dump.driver';
import * as path from 'path';

async function runTest() {
  console.log('🧪 Starting Mirror Test: Dump Driver');
  const dumpFile = path.resolve(__dirname, 'test-dump.sql');

  // Config host acts as file path for DumpDriver
  const driver = new DumpDriver({
    host: dumpFile,
    user: '', password: '', database: '', port: 0
  });

  try {
    await driver.connect();

    const introspection = driver.getIntrospectionService();

    const tables = await introspection.listTables('db');
    const views = await introspection.listViews('db');
    const procs = await introspection.listProcedures('db');

    console.log('Tables:', tables);
    console.log('Views:', views);
    console.log('Procs:', procs);

    if (tables.includes('users') && views.includes('v_users') && procs.includes('sp_test')) {
      console.log('✅ Dump parsed successfully!');
    } else {
      console.error('❌ Failed to parse expected objects');
      process.exit(1);
    }

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTest();
