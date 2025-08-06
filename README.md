# andb-core

Database migration and comparison tool by ph4n4n

## 🌍 Language / Ngôn ngữ

- 🇺🇸 [English](#quick-start)
- 🇻🇳 [Tiếng Việt](#quick-start-1)

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
- ✅ **Multi-Environment** - Support DEV/STAGE/PROD workflows

## 📚 Documentation

### 🇺🇸 English
- 📖 [CLI Usage](docs/CLI_EN.md) - Complete CLI commands
- 📖 [Script Generator](docs/GENERATOR_EN.md) - Auto-generate npm scripts
- 📖 [Integration Guide](docs/INTEGRATION_EN.md) - Programmatic usage
- 📖 [Examples](examples/) - Ready-to-use examples

### 🇻🇳 Tiếng Việt  
- 📖 [Hướng dẫn CLI](docs/CLI.md) - Lệnh CLI đầy đủ
- 📖 [Script Generator](docs/GENERATOR.md) - Tự động sinh npm scripts
- 📖 [Hướng dẫn tích hợp](docs/INTEGRATION.md) - Sử dụng programmatic
- 📖 [Ví dụ](examples/) - Ví dụ sẵn sàng sử dụng

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
```

## 📊 Output Structure

```
📦 <environment>
├── 📂 <schema>
│   ├── 📄 current-ddl
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

---

# andb-core (Tiếng Việt)

Công cụ migration và so sánh database bởi ph4n4n

## Bắt đầu nhanh

```bash
# Cài đặt
npm install andb-core

# Sử dụng cơ bản
andb export -t tables
andb compare -f functions
andb migrate:new -p procedures
```

## 🚀 Tính năng

- ✅ **Export Database** - Tables, Procedures, Functions, Triggers
- ✅ **So sánh môi trường** - Compare giữa DEV/STAGE/PROD
- ✅ **Công cụ Migration** - New/Update/Remove objects
- ✅ **Script Generator** - Tự động sinh npm scripts
- ✅ **Đa môi trường** - Hỗ trợ workflow DEV/STAGE/PROD

## 📚 Tài liệu

### 🇺🇸 English
- 📖 [CLI Usage](docs/CLI_EN.md) - Complete CLI commands
- 📖 [Script Generator](docs/GENERATOR_EN.md) - Auto-generate npm scripts
- 📖 [Integration Guide](docs/INTEGRATION_EN.md) - Programmatic usage
- 📖 [Examples](examples/) - Ready-to-use examples

### 🇻🇳 Tiếng Việt  
- 📖 [Hướng dẫn CLI](docs/CLI.md) - Lệnh CLI đầy đủ
- 📖 [Script Generator](docs/GENERATOR.md) - Tự động sinh npm scripts
- 📖 [Hướng dẫn tích hợp](docs/INTEGRATION.md) - Sử dụng programmatic
- 📖 [Ví dụ](examples/) - Ví dụ sẵn sàng sử dụng

## 🛠️ Script Generator

Tự động sinh npm scripts cho workflow:

```bash
# Generate với cấu hình mặc định
npm run generate

# Tùy chỉnh môi trường
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" npm run generate

# Scripts được tạo
npm run export:dev:fn      # Export functions từ DEV
npm run compare:prod:sp    # Compare procedures trong PROD
npm run migrate:stage:new  # Migrate new objects lên STAGE
```

📖 **Tài liệu**: [GENERATOR.md](docs/GENERATOR.md) | [GENERATOR_EN.md](docs/GENERATOR_EN.md)

## 📁 Cấu trúc project

```
andb-core/
├── core/           # Chức năng core
├── examples/       # Ví dụ tích hợp
├── docs/          # Tài liệu
├── scripts/       # CLI scripts
└── test/          # Test files
```

## 🔧 Cấu hình môi trường

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
```

## 📊 Cấu trúc output

```
📦 <environment>
├── 📂 <schema>
│   ├── 📄 current-ddl
│   ├── ⚙️ functions
│   ├── 🔧 procedures
│   ├── 📊 tables
│   └── 🔄 triggers
└── 📂 backup/
    └── 📅 <date>/
```

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file [LICENSE](LICENSE) 