# Script Generator - Tự động sinh scripts cho package.json

## Tổng quan

Script generator tự động tạo các npm scripts trong `package.json` dựa trên cấu hình môi trường và loại DDL. Giúp đơn giản hóa việc quản lý database migration và comparison.

## Cách sử dụng

### 1. Chạy generator cơ bản

```bash
# Sử dụng CLI
node andb generate

# Hoặc qua npm script
npm run generate
```

### 2. Tùy chỉnh môi trường

```bash
# Tùy chỉnh tất cả môi trường
ANDB_ENVIRONMENTS="DEV,PROD" node andb generate

# Tùy chỉnh môi trường compare
ANDB_COMPARE_ENVIRONMENTS="DEV,PROD" node andb generate

# Tùy chỉnh môi trường migrate
ANDB_MIGRATE_ENVIRONMENTS="PROD" node andb generate

# Kết hợp nhiều tùy chọn
ANDB_ENVIRONMENTS="DEV,PROD" ANDB_COMPARE_ENVIRONMENTS="DEV,PROD" ANDB_MIGRATE_ENVIRONMENTS="PROD" node andb generate
```

## Cấu hình mặc định

### Môi trường

- **Tất cả**: `DEV`, `PROD`
- **Compare**: `DEV`, `PROD`
- **Migrate**: `PROD`

> 💡 **Lưu ý**: Có thể mở rộng tùy chỉnh thêm môi trường khác như `STAGE`, `UAT`, `TEST` tùy theo nhu cầu project.

### Loại DDL

- `fn` - Functions
- `sp` - Stored Procedures
- `tbl` - Tables
- `trg` - Triggers
- `ev` - Events

### Operations

- `export` - Xuất DDL
- `compare` - So sánh DDL
- `migrate` - Migration (new/update)
- `deprecate` - Loại bỏ DDL

## Scripts được tạo

### Export Scripts

```bash
# Export từng loại
npm run export:dev:fn      # Export functions từ DEV
npm run export:dev:sp      # Export procedures từ DEV
npm run export:dev:tbl     # Export tables từ DEV
npm run export:dev:trg     # Export triggers từ DEV
npm run export:dev:ev      # Export events từ DEV

# Export tất cả
npm run export:dev         # Export tất cả từ DEV
npm run export:prod        # Export tất cả từ PROD
```

### Compare Scripts

```bash
# Compare từng loại
npm run compare:prod:fn    # Compare functions trong PROD
npm run compare:prod:sp    # Compare procedures trong PROD
npm run compare:prod:tbl   # Compare tables trong PROD
npm run compare:prod:trg   # Compare triggers trong PROD
npm run compare:prod:ev    # Compare events trong PROD

# Generate report
npm run compare:prod:report # Tạo report cho PROD

# Compare offline (không export)
npm run compare:prod:off   # Compare offline PROD

# Full compare (export + compare)
npm run compare:prod        # Full compare PROD
npm run compare:prod:migrated # Compare sau migration
```

### Migrate Scripts

```bash
# Migrate new objects
npm run migrate:prod:new:fn    # Migrate new functions
npm run migrate:prod:new:sp    # Migrate new procedures
npm run migrate:prod:new:tbl   # Migrate new tables
npm run migrate:prod:new:trg   # Migrate new triggers
npm run migrate:prod:new:ev    # Migrate new events

# Migrate update objects
npm run migrate:prod:update:fn # Update functions
npm run migrate:prod:update:sp # Update procedures
npm run migrate:prod:update:tbl # Update tables
npm run migrate:prod:update:trg # Update triggers
npm run migrate:prod:update:ev  # Update events

# Migrate theo loại
npm run migrate:prod:new       # Migrate tất cả new
npm run migrate:prod:update    # Migrate tất cả update

# Full migration
npm run migrate:prod           # Full migration PROD
```

### Deprecate Scripts

```bash
# Deprecate objects
npm run deprecate:prod:fn      # Deprecate functions
npm run deprecate:prod:sp      # Deprecate procedures
npm run deprecate:prod:trg     # Deprecate triggers
npm run deprecate:prod:ev      # Deprecate events

# Shorthand
npm run dep:prod:fn            # Shorthand cho deprecate

# OTE removal (chỉ functions và procedures)
npm run deprecate:prod:fn:ote  # Remove OTE functions
npm run deprecate:prod:sp:ote  # Remove OTE procedures
npm run dep:prod:fn:ote        # Shorthand OTE removal

# Full deprecate
npm run deprecate:prod         # Deprecate tất cả
npm run dep:prod               # Shorthand
```

## Utility Scripts

```bash
# Generator
npm run generate:scripts       # Tái tạo scripts

# Helper
npm run helper                 # Hiển thị help
npm run helper:list           # Liệt kê tất cả scripts
npm run helper --config       # Hiển thị cấu hình hiện tại

# Test
npm run test                  # Chạy tất cả test
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:watch            # Watch mode

# Lint
npm run lint                  # ESLint check
npm run lint:fix              # ESLint auto-fix
```

## Logic hoạt động

### 1. Environment Priority

```
CLI options > CLI context > Default values
```

### 2. Compare Logic

- **DEV**: `export:dev + compare:dev:off`
- **Khác**: `export:prev + export:current + compare:current:off`

### 3. Migrate Logic

- **Full**: `compare + migrate:new + migrate:update + compare:migrated`
- **New**: Chỉ migrate objects mới
- **Update**: Chỉ update objects hiện có

### 4. Deprecate Logic

- **Bỏ qua**: Tables (không deprecate)
- **OTE**: Chỉ functions và procedures
- **Shorthand**: `dep` thay cho `deprecate`

## Ví dụ thực tế

### Setup cho DEV → PROD

```bash
# Tạo scripts cho 2 môi trường
ANDB_ENVIRONMENTS="DEV,PROD" ANDB_COMPARE_ENVIRONMENTS="DEV,PROD" ANDB_MIGRATE_ENVIRONMENTS="PROD" node andb generate
```

### Workflow điển hình

```bash
# 1. Export từ DEV
npm run export:dev

# 2. Compare DEV với PROD
npm run compare:prod

# 3. Migrate new objects lên PROD
npm run migrate:prod:new

# 4. Test trên PROD
npm run compare:prod:migrated
```

## Troubleshooting

### Lỗi thường gặp

1. **Package.json không tìm thấy**
   - Kiểm tra đường dẫn `baseDir`
   - Đảm bảo chạy từ thư mục gốc project

2. **Scripts không được tạo**
   - Kiểm tra quyền ghi file
   - Kiểm tra cú pháp environment variables

3. **Environment không đúng**
   - Kiểm tra biến môi trường
   - Xem log output để debug

### Debug

```bash
# Hiển thị cấu hình hiện tại
npm run helper --config

# Xem tất cả scripts
npm run helper --list

# Test từng script
npm run export:dev:fn --dry-run
```

## Best Practices

1. **Version Control**: Commit `package.json` sau khi generate
2. **Environment**: Sử dụng biến môi trường cho production
3. **Testing**: Test scripts trên dev trước khi chạy production
4. **Backup**: Luôn backup trước khi migrate
5. **Documentation**: Ghi chú workflow cho team
