# andb-core

Database migration and comparison tool by ph4n4n

## Quick Start

```bash
# Install
npm install andb-core

# Basic usage
andb export -t tables
andb compare -f functions
andb migrate:new -p procedures
```

## 🚀 Features

- ✅ **Database Export** - Tables, Procedures, Functions, Triggers
- ✅ **Environment Comparison** - Compare between DEV/STAGE/PROD
- ✅ **Migration Tools** - New/Update/Remove objects
- ✅ **Script Generator** - Auto-generate npm scripts
- ✅ **Multi-Environment** - Support DEV/PROD workflows (extensible)

## 📚 Documentation

### 🇺🇸 English
- 📖 [CLI Usage](docs/CLI_EN.md) - Complete CLI commands
- 📖 [Script Generator](docs/GENERATOR_EN.md) - Auto-generate npm scripts
- 📖 [Integration Guide](docs/INTEGRATION_EN.md) - Programmatic usage
- 📖 [Examples](examples/) - Ready-to-use examples, please check [QUICKSTART](examples/basic-with-env/QUICKSTART.md) guild

### 🇻🇳 Tiếng Việt  
- 📖 [Hướng dẫn CLI](docs/CLI.md) - Lệnh CLI đầy đủ
- 📖 [Script Generator](docs/GENERATOR.md) - Tự động sinh npm scripts
- 📖 [Hướng dẫn tích hợp](docs/INTEGRATION.md) - Sử dụng programmatic
- 📖 [Ví dụ](examples/) - Ví dụ sẵn sàng sử dụng, xem [QUICKSTART](examples/basic-with-env/QUICKSTART.md) để thấy rõ hơn

## 🛠️ Script Generator

Auto-generate npm scripts for your workflow:

```bash
# Generate with default config
npm run generate

# Custom environments
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" npm run generate

# Generated scripts
npm run export:dev:fn      # Export functions from DEV
npm run compare:prod:sp    # Compare procedures in PROD  
npm run migrate:stage:new  # Migrate new objects to STAGE
```

📖 **Documentation**: [GENERATOR.md](docs/GENERATOR.md) | [GENERATOR_EN.md](docs/GENERATOR_EN.md)

## 📁 Project Structure

```
andb-core/
├── core/           # Core functionality
├── examples/       # Integration examples
├── docs/          # Documentation
├── scripts/       # CLI scripts
└── test/          # Test files
```

## 🔧 Environment Setup

```bash
# .env
DEV_DB_HOST=localhost
DEV_DB_NAME=dev_database
DEV_DB_USER=root
DEV_DB_PASS=password

PROD_DB_HOST=prod-server.com
PROD_DB_NAME=prod_database
PROD_DB_USER=prod_user
PROD_DB_PASS=prod_password

# 💡 Extend with more environments
# STAGE_DB_HOST=stage-server.com
# STAGE_DB_NAME=stage_database
# STAGE_DB_USER=stage_user
# STAGE_DB_PASS=stage_password
```

## 📊 Output Structure

```
📦 <environment>
├── 📂 <schema>
│   ├── 📂 current-ddl
        ├── functions.list
        ├── procedures.list
        ├── tables.list
        └── triggers.list
│   ├── ⚙️ functions
│   ├── 🔧 procedures
│   ├── 📊 tables
│   └── 🔄 triggers
└── 📂 backup/
    └── 📅 <date>/
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file

ph4n4n