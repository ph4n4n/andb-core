
import { MysqlDriver } from '../src/modules/driver/mysql/mysql.driver';
import { IDatabaseConfig } from '../src/common/interfaces/driver.interface';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load root env if valid

// Defaults match docker/docker-compose.yml for mysql-dev
const config: IDatabaseConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: Number(process.env.TEST_DB_PORT) || 3306,
  user: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASSWORD || 'root123',
  database: process.env.TEST_DB_NAME || 'dev_database'
};

async function runTest() {
  console.log('🧪 Starting Mirror Test: MySQL Driver Connection');
  console.log(`Target: ${config.user}@${config.host}:${config.port}/${config.database}`);

  const driver = new MysqlDriver(config);

  try {
    console.log('🔌 Connecting...');
    await driver.connect();
    console.log('✅ Connected successfully!');

    console.log('🕵️ Checking Introspection...');
    const introspection = driver.getIntrospectionService();
    const tables = await introspection.listTables(config.database as string);
    console.log(`✅ Tables found: ${tables.length}`, tables);

    console.log('🔍 Checking Monitoring...');
    const version = await driver.getMonitoringService().getVersion();
    console.log(`✅ MySQL Version: ${version}`);

  } catch (err) {
    console.error('❌ Connection Failed:', err);
    process.exit(1);
  } finally {
    await driver.disconnect();
    console.log('🔌 Disconnected');
  }

  console.log('\n✨ Live Connection Test Passed!');
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
