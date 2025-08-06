# Script Generator - Auto-generate scripts for package.json

## Overview

Script generator automatically creates npm scripts in `package.json` based on environment configuration and DDL types. Simplifies database migration and comparison management.

## Usage

### 1. Basic generator

```bash
# Using CLI
node andb generate

# Or via npm script
npm run generate
```

### 2. Customize environments

```bash
# Customize all environments
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" node andb generate

# Customize compare environments
ANDB_COMPARE_ENVIRONMENTS="DEV,PROD" node andb generate

# Customize migrate environments
ANDB_MIGRATE_ENVIRONMENTS="STAGE,PROD" node andb generate

# Combine multiple options
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" ANDB_COMPARE_ENVIRONMENTS="DEV,PROD" ANDB_MIGRATE_ENVIRONMENTS="PROD" node andb generate
```

## Default Configuration

### Environments
- **All**: `LOCAL`, `DEV`, `UAT`, `STAGE`, `PROD`
- **Compare**: All except `LOCAL`
- **Migrate**: All except `LOCAL`, `DEV`

### DDL Types
- `fn` - Functions
- `sp` - Stored Procedures  
- `tbl` - Tables
- `trg` - Triggers

### Operations
- `export` - Export DDL
- `compare` - Compare DDL
- `migrate` - Migration (new/update)
- `deprecate` - Remove DDL

## Generated Scripts

### Export Scripts

```bash
# Export by type
npm run export:dev:fn      # Export functions from DEV
npm run export:dev:sp      # Export procedures from DEV
npm run export:dev:tbl     # Export tables from DEV
npm run export:dev:trg     # Export triggers from DEV

# Export all
npm run export:dev         # Export all from DEV
npm run export:prod        # Export all from PROD
```

### Compare Scripts

```bash
# Compare by type
npm run compare:prod:fn    # Compare functions in PROD
npm run compare:prod:sp    # Compare procedures in PROD
npm run compare:prod:tbl   # Compare tables in PROD
npm run compare:prod:trg   # Compare triggers in PROD

# Generate report
npm run compare:prod:report # Generate report for PROD

# Compare offline (no export)
npm run compare:prod:off   # Compare offline PROD

# Full compare (export + compare)
npm run compare:prod        # Full compare PROD
npm run compare:prod:migrated # Compare after migration
```

### Migrate Scripts

```bash
# Migrate new objects
npm run migrate:prod:new:fn    # Migrate new functions
npm run migrate:prod:new:sp    # Migrate new procedures
npm run migrate:prod:new:tbl   # Migrate new tables
npm run migrate:prod:new:trg   # Migrate new triggers

# Migrate update objects
npm run migrate:prod:update:fn # Update functions
npm run migrate:prod:update:sp # Update procedures
npm run migrate:prod:update:tbl # Update tables
npm run migrate:prod:update:trg # Update triggers

# Migrate by type
npm run migrate:prod:new       # Migrate all new
npm run migrate:prod:update    # Migrate all update

# Full migration
npm run migrate:prod           # Full migration PROD
```

### Deprecate Scripts

```bash
# Deprecate objects
npm run deprecate:prod:fn      # Deprecate functions
npm run deprecate:prod:sp      # Deprecate procedures
npm run deprecate:prod:trg     # Deprecate triggers

# Shorthand
npm run dep:prod:fn            # Shorthand for deprecate

# OTE removal (functions and procedures only)
npm run deprecate:prod:fn:ote  # Remove OTE functions
npm run deprecate:prod:sp:ote  # Remove OTE procedures
npm run dep:prod:fn:ote        # Shorthand OTE removal

# Full deprecate
npm run deprecate:prod         # Deprecate all
npm run dep:prod               # Shorthand
```

## Utility Scripts

```bash
# Generator
npm run generate:scripts       # Regenerate scripts

# Helper
npm run helper                 # Show help
npm run helper:list           # List all scripts
npm run helper --config       # Show current configuration

# Test
npm run test                  # Run all tests
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:watch            # Watch mode

# Lint
npm run lint                  # ESLint check
npm run lint:fix              # ESLint auto-fix
```

## Working Logic

### 1. Environment Priority
```
CLI options > CLI context > Default values
```

### 2. Compare Logic
- **DEV**: `export:dev + compare:dev:off`
- **Others**: `export:prev + export:current + compare:current:off`

### 3. Migrate Logic
- **Full**: `compare + migrate:new + migrate:update + compare:migrated`
- **New**: Only migrate new objects
- **Update**: Only update existing objects

### 4. Deprecate Logic
- **Skip**: Tables (no deprecate)
- **OTE**: Functions and procedures only
- **Shorthand**: `dep` instead of `deprecate`

## Real Examples

### Setup for DEV → STAGE → PROD

```bash
# Generate scripts for 3 environments
ANDB_ENVIRONMENTS="DEV,STAGE,PROD" ANDB_COMPARE_ENVIRONMENTS="DEV,STAGE,PROD" ANDB_MIGRATE_ENVIRONMENTS="STAGE,PROD" node andb generate
```

### Typical Workflow

```bash
# 1. Export from DEV
npm run export:dev

# 2. Compare DEV with STAGE
npm run compare:stage

# 3. Migrate new objects to STAGE
npm run migrate:stage:new

# 4. Test on STAGE
npm run compare:stage:migrated

# 5. Migrate to PROD
npm run migrate:prod
```

## Troubleshooting

### Common Issues

1. **Package.json not found**
   - Check `baseDir` path
   - Ensure running from project root

2. **Scripts not generated**
   - Check file write permissions
   - Check environment variables syntax

3. **Environment incorrect**
   - Check environment variables
   - View log output for debugging

### Debug

```bash
# Show current configuration
npm run helper --config

# View all scripts
npm run helper --list

# Test individual script
npm run export:dev:fn --dry-run
```

## Best Practices

1. **Version Control**: Commit `package.json` after generation
2. **Environment**: Use environment variables for production
3. **Testing**: Test scripts on dev before running production
4. **Backup**: Always backup before migration
5. **Documentation**: Document workflow for team 