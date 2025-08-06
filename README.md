# @anph/core

Database migration and comparison tool by ph4n4n

## 🌍 Language / Ngôn ngữ

- 🇺🇸 [English](#installation) (Default)
- 🇻🇳 [Tiếng Việt](#installation-1) (Vietnamese version below)

## Installation

```bash
npm install @anph/core
```

## Usage

### CLI

```bash
# Export database objects
andb export -t tables
andb export -p procedures
andb export -f functions
andb export -tr triggers

# Compare database objects
andb compare -t tables
andb compare -p procedures
andb compare -f functions
andb compare -tr triggers

# Migrate new objects
andb migrate:new -t tables
andb migrate:new -p procedures

# Update existing objects
andb migrate:update -t tables
andb migrate:update -p procedures

# Deprecate objects
andb deprecate -p procedures
andb deprecate -f functions

# Monitor database
andb monitor -p processlist
andb monitor -s status
```

### Programmatic

```javascript
// 1. import
const andb = require('@anph/core');

// 2. Use services
const { service, utils, commander, interfaces } = andb;

// 3. implement interface
class MyDatabaseService extends interfaces.IDatabaseService {
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

// 4. enjoy it
const dbService = new MyDatabaseService();

// Build CLI with your implementation
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

**Environment Setup:**
```bash
# .env
# Database Configuration for DEV
DEV_DB_HOST=localhost
DEV_DB_NAME=dev_database
DEV_DB_USERNAME=root
DEV_DB_PASSWORD=password
DEV_DB_MAIL=dev_mail_db

# Database Configuration for PROD
PROD_DB_HOST=prod-server.com
PROD_DB_NAME=prod_database
PROD_DB_USERNAME=prod_user
PROD_DB_PASSWORD=prod_password
PROD_DB_MAIL=prod_mail_db

# Base directory for andb-core operations
BASE_DIR=/path/to/your/project 
```

**Usage Examples:**
```bash
# Export tables from DEV
node app.js export -t

# Compare functions between DEV and PROD
node app.js compare -f

# Migrate new procedures to PROD
node app.js migrate:new -p

# Monitor database status
node app.js monitor -s

**Advanced Usage - Generate Scripts for package.json:**

📖 **Documentation**: 
- 🇻🇳 [GENERATOR.md](GENERATOR.md) (Vietnamese)
- 🇺🇸 [GENERATOR_EN.md](GENERATOR_EN.md) (English)

```bash
# Generate scripts with default environments
node andb generate

# Generate with custom environments
node andb generate -e "DEV,PROD" -c "DEV,PROD" -m "PROD"

# Or use npm scripts
npm run generate
npm run helper
```

**Generated Scripts Examples:**
```bash
# Export commands
npm run export:dev:fn          # Export functions from DEV
npm run export:prod:sp          # Export procedures from PROD
npm run export:dev              # Export all from DEV

# Compare commands  
npm run compare:prod:fn         # Compare functions in PROD
npm run compare:prod:report     # Generate PROD report
npm run compare:prod            # Full PROD comparison

# Migrate commands
npm run migrate:prod:new:fn     # Migrate new functions to PROD
npm run migrate:prod:update     # Update all DDL in PROD
npm run migrate:prod            # Full PROD migration

# Deprecate commands
npm run deprecate:prod:fn       # Deprecate functions in PROD
npm run dep:prod:sp:ote         # Remove OTE procedures in PROD
```

**Helper Commands:**
```bash
npm run helper                  # Show usage help
npm run helper --list          # List all available scripts
npm run helper --config        # Show current configuration
```

### Integration Examples

See [examples/](examples/) directory for complete integration examples with basic .env configuration.

## Architecture

![Database Migration Process](diagram/diagram.jpg)

*Simple Export and Migration Process (DEV to PROD)*

## 🚀 Script Generator

Script generator tự động tạo các npm scripts trong `package.json` dựa trên cấu hình môi trường và loại DDL. Giúp đơn giản hóa việc quản lý database migration và comparison.

### Tính năng chính

- ✅ **Tự động sinh scripts** cho tất cả environments và DDL types
- ✅ **Tùy chỉnh môi trường** qua environment variables
- ✅ **Workflow scripts** cho export, compare, migrate, deprecate
- ✅ **Shorthand commands** (dep thay cho deprecate)
- ✅ **Utility scripts** cho testing, linting, helper

### Cách sử dụng nhanh

```bash
# Generate với cấu hình mặc định
npm run generate

# Tùy chỉnh môi trường
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" npm run generate

# Xem hướng dẫn chi tiết
# 📖 [GENERATOR.md](GENERATOR.md) (Vietnamese)
# 📖 [GENERATOR_EN.md](GENERATOR_EN.md) (English)
```

## Features

- Database object export (tables, procedures, functions, triggers)
- Database comparison between 2 environments each time
- Migration tools for new/updated/removed objects
- Database monitoring
- Multi-environment support, for example (DEV/PROD) or (DEV/STAGE/PROD),...
- Basic .env configuration support
- **Script Generator**: Tự động sinh npm scripts cho package.json

## 📁 Output Folder Structure

### 🗄️ Database Schema Structure
```
📦 <environment>
├── 📂 <schema>
│   ├── 📄 current-ddl
│   ├── ⚙️ functions
│   └── 📊 tables
└── 📂 preflow_40
    ├── 💾 backup
    │   ├── 📅 1_12_2024
    │   │   ├── 🔧 procedures
    │   │   ├── ⚙️ functions
    │   │   └── 🔄 triggers
    │   ├── ⚙️ functions
    │   ├── 🔧 procedures
    │   ├── 📊 tables
    │   └── 🔄 triggers
    ├── 📄 current-ddl
    ├── ⚙️ functions
    ├── 🔧 procedures
    ├── 📊 tables
    └── 🔄 triggers
```

### 🚀 Migration Map Structure
```
📦 map-migrate
└── 📂 <source env>-to-<destination env>  ← <DEV>-to-<PROD>
    └── 📂 <schema>
        ├── ⚙️ functions
        ├── 🔧 procedures
        ├── 📊 tables
        │   └── 🔄 alters
        │       ├── 📋 columns
        │       ├── 🔍 indexes
        │       └── 🗑️ rmv-columns
        └── 🔄 triggers
```

## License
MIT

---

# @anph/core (Tiếng Việt)

Công cụ migration và so sánh database bởi ph4n4n

## Cài đặt

```bash
npm install @anph/core
```

## Sử dụng

### CLI

```bash
# Export database objects
andb export -t tables
andb export -p procedures
andb export -f functions
andb export -tr triggers

# Compare database objects
andb compare -t tables
andb compare -p procedures
andb compare -f functions
andb compare -tr triggers

# Migrate new objects
andb migrate:new -t tables
andb migrate:new -p procedures

# Update existing objects
andb migrate:update -t tables
andb migrate:update -p procedures

# Deprecate objects
andb deprecate -p procedures
andb deprecate -f functions

# Monitor database
andb monitor -p processlist
andb monitor -s status
```

### Programmatic

```javascript
// 1. import
const andb = require('@anph/core');

// 2. Use services
const { service, utils, commander, interfaces } = andb;

// 3. implement interface
class MyDatabaseService extends interfaces.IDatabaseService {
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

// 4. enjoy it
const dbService = new MyDatabaseService();

// Build CLI with your implementation
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

**Environment Setup:**
```bash
# .env
# Database Configuration for DEV
DEV_DB_HOST=localhost
DEV_DB_NAME=dev_database
DEV_DB_USERNAME=root
DEV_DB_PASSWORD=password
DEV_DB_MAIL=dev_mail_db

# Database Configuration for PROD
PROD_DB_HOST=prod-server.com
PROD_DB_NAME=prod_database
PROD_DB_USERNAME=prod_user
PROD_DB_PASSWORD=prod_password
PROD_DB_MAIL=prod_mail_db

# Base directory for andb-core operations
BASE_DIR=/path/to/your/project 
```

**Usage Examples:**
```bash
# Export tables from DEV
node app.js export -t

# Compare functions between DEV and PROD
node app.js compare -f

# Migrate new procedures to PROD
node app.js migrate:new -p

# Monitor database status
node app.js monitor -s

**Advanced Usage - Generate Scripts for package.json:**

📖 **Tài liệu**: 
- 🇻🇳 [GENERATOR.md](GENERATOR.md) (Tiếng Việt)
- 🇺🇸 [GENERATOR_EN.md](GENERATOR_EN.md) (English)

```bash
# Generate scripts with default environments
node andb generate

# Generate with custom environments
node andb generate -e "DEV,PROD" -c "DEV,PROD" -m "PROD"

# Or use npm scripts
npm run generate
npm run helper
```

**Generated Scripts Examples:**
```bash
# Export commands
npm run export:dev:fn          # Export functions from DEV
npm run export:prod:sp          # Export procedures from PROD
npm run export:dev              # Export all from DEV

# Compare commands  
npm run compare:prod:fn         # Compare functions in PROD
npm run compare:prod:report     # Generate PROD report
npm run compare:prod            # Full PROD comparison

# Migrate commands
npm run migrate:prod:new:fn     # Migrate new functions to PROD
npm run migrate:prod:update     # Update all DDL in PROD
npm run migrate:prod            # Full PROD migration

# Deprecate commands
npm run deprecate:prod:fn       # Deprecate functions in PROD
npm run dep:prod:sp:ote         # Remove OTE procedures in PROD
```

**Helper Commands:**
```bash
npm run helper                  # Show usage help
npm run helper --list          # List all available scripts
npm run helper --config        # Show current configuration
```

### Integration Examples

See [examples/](examples/) directory for complete integration examples with basic .env configuration.

## Architecture

![Database Migration Process](diagram/diagram.jpg)

*Simple Export and Migration Process (DEV to PROD)*

## 🚀 Script Generator

Script generator tự động tạo các npm scripts trong `package.json` dựa trên cấu hình môi trường và loại DDL. Giúp đơn giản hóa việc quản lý database migration và comparison.

### Tính năng chính

- ✅ **Tự động sinh scripts** cho tất cả environments và DDL types
- ✅ **Tùy chỉnh môi trường** qua environment variables
- ✅ **Workflow scripts** cho export, compare, migrate, deprecate
- ✅ **Shorthand commands** (dep thay cho deprecate)
- ✅ **Utility scripts** cho testing, linting, helper

### Cách sử dụng nhanh

```bash
# Generate với cấu hình mặc định
npm run generate

# Tùy chỉnh môi trường
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" npm run generate

# Xem hướng dẫn chi tiết
# 📖 [GENERATOR.md](GENERATOR.md) (Vietnamese)
# 📖 [GENERATOR_EN.md](GENERATOR_EN.md) (English)
```

## Features

- Database object export (tables, procedures, functions, triggers)
- Database comparison between 2 environments each time
- Migration tools for new/updated/removed objects
- Database monitoring
- Multi-environment support, for example (DEV/PROD) or (DEV/STAGE/PROD),...
- Basic .env configuration support
- **Script Generator**: Tự động sinh npm scripts cho package.json

## 📁 Output Folder Structure

### 🗄️ Database Schema Structure
```
📦 <environment>
├── 📂 <schema>
│   ├── 📄 current-ddl
│   ├── ⚙️ functions
│   └── 📊 tables
└── 📂 preflow_40
    ├── 💾 backup
    │   ├── 📅 1_12_2024
    │   │   ├── 🔧 procedures
    │   │   ├── ⚙️ functions
    │   │   └── 🔄 triggers
    │   ├── ⚙️ functions
    │   ├── 🔧 procedures
    │   ├── 📊 tables
    │   └── 🔄 triggers
    ├── 📄 current-ddl
    ├── ⚙️ functions
    ├── 🔧 procedures
    ├── 📊 tables
    └── 🔄 triggers
```

### 🚀 Migration Map Structure
```
📦 map-migrate
└── 📂 <source env>-to-<destination env>  ← <DEV>-to-<PROD>
    └── 📂 <schema>
        ├── ⚙️ functions
        ├── 🔧 procedures
        ├── 📊 tables
        │   └── 🔄 alters
        │       ├── 📋 columns
        │       ├── 🔍 indexes
        │       └── 🗑️ rmv-columns
        └── 🔄 triggers
```

## License
MIT 