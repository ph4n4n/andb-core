# Hướng dẫn tích hợp - andb-core

## Tổng quan

andb-core cung cấp API programmatic để tích hợp vào ứng dụng Node.js của bạn.

## Cài đặt

```bash
npm install andb-core
```

## Import và Setup

```javascript
// Import andb-core
const andb = require('andb-core');

// Destructure các services
const { service, utils, commander, interfaces } = andb;
```

## Interface Implementation

### 1. Database Service Interface

```javascript
class MyDatabaseService extends interfaces.IDatabaseService {
  // Cấu hình database cho từng environment
  getDBDestination(env, mail = false) {
    const configs = {
      DEV: {
        host: process.env.DEV_DB_HOST,
        database: process.env.DEV_DB_NAME,
        user: process.env.DEV_DB_USER,
        password: process.env.DEV_DB_PASS
      },
      PROD: {
        host: process.env.PROD_DB_HOST,
        database: process.env.PROD_DB_NAME,
        user: process.env.PROD_DB_USER,
        password: process.env.PROD_DB_PASS
      }
    };
    return configs[env.toUpperCase()];
  }

  // Xác định source environment
  getSourceEnv(envName) {
    return envName === 'PROD' ? 'DEV' : 'DEV';
  }

  // Xác định destination environment
  getDestEnv(env) {
    return env === 'DEV' ? 'PROD' : 'PROD';
  }

  // Lấy tên database
  getDBName(env, isDbMail = false) {
    return process.env[`${env}_DB_NAME`];
  }

  // Thay thế environment-specific values
  replaceWithEnv(ddl, destEnv) {
    return destEnv === 'PROD' 
      ? ddl.replace(/@dev\.com/g, '@prod.com')
      : ddl;
  }
}
```

### 2. CLI Builder

```javascript
// Tạo instance của database service
const dbService = new MyDatabaseService();

// Build CLI với implementation của bạn
const cli = commander.build({
  getDBDestination: dbService.getDBDestination.bind(dbService),
  getSourceEnv: dbService.getSourceEnv.bind(dbService),
  getDestEnv: dbService.getDestEnv.bind(dbService),
  getDBName: dbService.getDBName.bind(dbService),
  replaceWithEnv: dbService.replaceWithEnv.bind(dbService),
  ENVIRONMENTS: { DEV: 'DEV', PROD: 'PROD' },
  baseDir: process.cwd()
});

// Parse CLI arguments
cli.parse(process.argv);
```

## Services

### 1. Export Service

```javascript
const { Exporter } = service;

// Export tables
const exporter = new Exporter();
await exporter.exportTables('DEV');

// Export procedures
await exporter.exportProcedures('DEV');

// Export functions
await exporter.exportFunctions('DEV');

// Export triggers
await exporter.exportTriggers('DEV');
```

### 2. Compare Service

```javascript
const { Comparator } = service;

// Compare tables
const comparator = new Comparator();
await comparator.compareTables('DEV', 'PROD');

// Compare procedures
await comparator.compareProcedures('DEV', 'PROD');

// Generate report
await comparator.generateReport('PROD');
```

### 3. Migration Service

```javascript
const { Migrator } = service;

// Migrate new objects
const migrator = new Migrator();
await migrator.migrateNew('DEV', 'PROD');

// Update existing objects
await migrator.migrateUpdate('DEV', 'PROD');

// Deprecate objects
await migrator.deprecate('PROD');
```

### 4. Monitor Service

```javascript
const { Monitor } = service;

// Monitor process list
const monitor = new Monitor();
await monitor.getProcessList('PROD');

// Monitor database status
await monitor.getStatus('PROD');

// Custom query
await monitor.executeQuery('SELECT * FROM information_schema.tables', 'PROD');
```

## Utils

### 1. File Helper

```javascript
const { FileHelper } = utils;

// Read file
const content = await FileHelper.readFile('path/to/file.sql');

// Write file
await FileHelper.writeFile('path/to/output.sql', content);

// Create directory
await FileHelper.createDir('path/to/directory');

// List files
const files = await FileHelper.listFiles('path/to/directory');
```

### 2. Report Helper

```javascript
const { ReportHelper } = utils;

// Generate HTML report
await ReportHelper.generateHtmlReport(data, 'output/report.html');

// Generate JSON report
await ReportHelper.generateJsonReport(data, 'output/report.json');

// Generate diff report
await ReportHelper.generateDiffReport(diffData, 'output/diff.html');
```

### 3. Crypt Utils

```javascript
const { Crypt } = utils;

// Encrypt sensitive data
const encrypted = Crypt.encrypt('sensitive_data', 'secret_key');

// Decrypt data
const decrypted = Crypt.decrypt(encrypted, 'secret_key');

// Hash password
const hashed = Crypt.hash('password');
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DEV_DB_HOST=localhost
DEV_DB_NAME=dev_database
DEV_DB_USER=root
DEV_DB_PASS=password

PROD_DB_HOST=prod-server.com
PROD_DB_NAME=prod_database
PROD_DB_USER=prod_user
PROD_DB_PASS=prod_password

# Tool Configuration
ANDB_ENVIRONMENTS=DEV,STAGE,PROD
ANDB_COMPARE_ENVIRONMENTS=DEV,PROD
ANDB_MIGRATE_ENVIRONMENTS=STAGE,PROD
ANDB_BASE_DIR=/path/to/project
ANDB_OUTPUT_DIR=./output
ANDB_LOG_LEVEL=info
```

### Config File

```json
{
  "environments": {
    "DEV": {
      "host": "localhost",
      "database": "dev_database",
      "user": "root",
      "password": "password"
    },
    "PROD": {
      "host": "prod-server.com",
      "database": "prod_database",
      "user": "prod_user",
      "password": "prod_password"
    }
  },
  "output": {
    "directory": "./output",
    "format": "sql"
  },
  "logging": {
    "level": "info"
  }
}
```

## Examples

### 1. Basic Integration

```javascript
const andb = require('andb-core');
const { service, utils } = andb;

class DatabaseManager {
  constructor() {
    this.exporter = new service.Exporter();
    this.comparator = new service.Comparator();
    this.migrator = new service.Migrator();
  }

  async exportAll(env) {
    await this.exporter.exportTables(env);
    await this.exporter.exportProcedures(env);
    await this.exporter.exportFunctions(env);
    await this.exporter.exportTriggers(env);
  }

  async compareEnvironments(source, target) {
    await this.comparator.compareTables(source, target);
    await this.comparator.compareProcedures(source, target);
    await this.comparator.compareFunctions(source, target);
    await this.comparator.compareTriggers(source, target);
  }

  async migrateToProduction() {
    await this.migrator.migrateNew('DEV', 'PROD');
    await this.migrator.migrateUpdate('DEV', 'PROD');
  }
}

// Usage
const dbManager = new DatabaseManager();
await dbManager.exportAll('DEV');
await dbManager.compareEnvironments('DEV', 'PROD');
await dbManager.migrateToProduction();
```

### 2. Custom CLI

```javascript
const andb = require('andb-core');
const { commander, interfaces } = andb;

class CustomDatabaseService extends interfaces.IDatabaseService {
  getDBDestination(env, mail = false) {
    // Custom implementation
    return {
      host: process.env[`${env}_DB_HOST`],
      database: process.env[`${env}_DB_NAME`],
      user: process.env[`${env}_DB_USER`],
      password: process.env[`${env}_DB_PASS`]
    };
  }

  getSourceEnv(envName) {
    return envName === 'PROD' ? 'DEV' : 'DEV';
  }

  getDestEnv(env) {
    return env === 'DEV' ? 'PROD' : 'PROD';
  }

  getDBName(env, isDbMail = false) {
    return process.env[`${env}_DB_NAME`];
  }

  replaceWithEnv(ddl, destEnv) {
    return destEnv === 'PROD' 
      ? ddl.replace(/@dev\.com/g, '@prod.com')
      : ddl;
  }
}

// Build CLI
const dbService = new CustomDatabaseService();
const cli = commander.build({
  getDBDestination: dbService.getDBDestination.bind(dbService),
  getSourceEnv: dbService.getSourceEnv.bind(dbService),
  getDestEnv: dbService.getDestEnv.bind(dbService),
  getDBName: dbService.getDBName.bind(dbService),
  replaceWithEnv: dbService.replaceWithEnv.bind(dbService),
  ENVIRONMENTS: { DEV: 'DEV', PROD: 'PROD' },
  baseDir: process.cwd()
});

cli.parse(process.argv);
```

### 3. Automated Workflow

```javascript
const andb = require('andb-core');
const { service, utils } = andb;

class AutomatedWorkflow {
  constructor() {
    this.exporter = new service.Exporter();
    this.comparator = new service.Comparator();
    this.migrator = new service.Migrator();
    this.monitor = new service.Monitor();
  }

  async runFullWorkflow() {
    try {
      // 1. Export from DEV
      console.log('Exporting from DEV...');
      await this.exporter.exportTables('DEV');
      await this.exporter.exportProcedures('DEV');
      await this.exporter.exportFunctions('DEV');

      // 2. Compare with STAGE
      console.log('Comparing with STAGE...');
      await this.comparator.compareTables('DEV', 'STAGE');
      await this.comparator.compareProcedures('DEV', 'STAGE');
      await this.comparator.compareFunctions('DEV', 'STAGE');

      // 3. Migrate to STAGE
      console.log('Migrating to STAGE...');
      await this.migrator.migrateNew('DEV', 'STAGE');
      await this.migrator.migrateUpdate('DEV', 'STAGE');

      // 4. Monitor STAGE
      console.log('Monitoring STAGE...');
      await this.monitor.getStatus('STAGE');

      // 5. Migrate to PROD
      console.log('Migrating to PROD...');
      await this.migrator.migrateNew('STAGE', 'PROD');
      await this.migrator.migrateUpdate('STAGE', 'PROD');

      console.log('Workflow completed successfully!');
    } catch (error) {
      console.error('Workflow failed:', error);
      throw error;
    }
  }
}

// Usage
const workflow = new AutomatedWorkflow();
await workflow.runFullWorkflow();
```

## Error Handling

```javascript
const andb = require('andb-core');
const { service } = andb;

class SafeDatabaseManager {
  constructor() {
    this.exporter = new service.Exporter();
  }

  async safeExport(env) {
    try {
      await this.exporter.exportTables(env);
      console.log(`✅ Tables exported from ${env}`);
    } catch (error) {
      console.error(`❌ Failed to export tables from ${env}:`, error.message);
      throw error;
    }
  }

  async safeCompare(source, target) {
    try {
      await this.comparator.compareTables(source, target);
      console.log(`✅ Tables compared between ${source} and ${target}`);
    } catch (error) {
      console.error(`❌ Failed to compare tables:`, error.message);
      throw error;
    }
  }
}
```

## Best Practices

1. **Always implement error handling**
2. **Use environment variables for sensitive data**
3. **Validate database connections before operations**
4. **Implement logging for audit trail**
5. **Test on staging before production**
6. **Backup before migrations**
7. **Monitor database performance**
8. **Use transactions for critical operations**

## Testing

```javascript
const andb = require('andb-core');
const { service } = andb;

// Test export functionality
async function testExport() {
  const exporter = new service.Exporter();
  
  try {
    await exporter.exportTables('DEV');
    console.log('✅ Export test passed');
  } catch (error) {
    console.error('❌ Export test failed:', error);
  }
}

// Test compare functionality
async function testCompare() {
  const comparator = new service.Comparator();
  
  try {
    await comparator.compareTables('DEV', 'PROD');
    console.log('✅ Compare test passed');
  } catch (error) {
    console.error('❌ Compare test failed:', error);
  }
}

// Run tests
testExport();
testCompare();
``` 