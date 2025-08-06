# CLI Guide - andb-core

## Overview

CLI (Command Line Interface) of andb-core provides commands to manage database migration and comparison.

## Installation

```bash
npm install andb-core
```

## Basic Commands

### Export Commands

```bash
# Export tables
andb export -t [environment]

# Export stored procedures
andb export -p [environment]

# Export functions
andb export -f [environment]

# Export triggers
andb export -tr [environment]

# Export all DDL types
andb export -a [environment]
```

### Compare Commands

```bash
# Compare tables
andb compare -t [environment]

# Compare stored procedures
andb compare -p [environment]

# Compare functions
andb compare -f [environment]

# Compare triggers
andb compare -tr [environment]

# Generate comparison report
andb compare -r [environment]

# Compare all DDL types
andb compare -a [environment]
```

### Migration Commands

```bash
# Migrate new objects
andb migrate:new -t [environment]  # Tables
andb migrate:new -p [environment]  # Procedures
andb migrate:new -f [environment]  # Functions
andb migrate:new -tr [environment] # Triggers

# Update existing objects
andb migrate:update -t [environment]  # Tables
andb migrate:update -p [environment]  # Procedures
andb migrate:update -f [environment]  # Functions
andb migrate:update -tr [environment] # Triggers
```

### Deprecate Commands

```bash
# Deprecate objects
andb deprecate -p [environment]  # Procedures
andb deprecate -f [environment]  # Functions
andb deprecate -tr [environment] # Triggers

# Shorthand
andb dep -p [environment]  # Procedures
andb dep -f [environment]  # Functions
andb dep -tr [environment] # Triggers

# OTE removal (functions and procedures only)
andb deprecate -rmof [environment] # Remove OTE functions
andb deprecate -rmos [environment] # Remove OTE procedures
andb dep -rmof [environment]       # Shorthand OTE functions
andb dep -rmos [environment]       # Shorthand OTE procedures
```

### Monitor Commands

```bash
# Monitor process list
andb monitor -p [environment]

# Monitor database status
andb monitor -s [environment]

# Monitor with custom query
andb monitor -q "SELECT * FROM information_schema.tables" [environment]
```

### Utility Commands

```bash
# Show help
andb --help
andb -h

# Show version
andb --version
andb -v

# Generate scripts
andb generate

# Show helper
andb helper
andb helper --list
andb helper --config
```

## Environment Options

### Default Environments
- `DEV` - Development environment
- `PROD` - Production environment

> 💡 **Note**: Can be customized with additional environments like `STAGE`, `UAT`, `TEST` based on project needs.

### Custom Environments
```bash
# Set custom environments
export ANDB_ENVIRONMENTS="DEV,STAGE,PROD"

# Set compare environments
export ANDB_COMPARE_ENVIRONMENTS="DEV,PROD"

# Set migrate environments
export ANDB_MIGRATE_ENVIRONMENTS="STAGE,PROD"
```

## Options

### Global Options
```bash
--help, -h          # Show help
--version, -v       # Show version
--config <file>     # Config file path
--env <environment> # Target environment
--dry-run          # Show commands without executing
--verbose          # Verbose output
--quiet            # Quiet mode
```

### Export Options
```bash
-t, --tables       # Export tables
-p, --procedures   # Export stored procedures
-f, --functions    # Export functions
-tr, --triggers    # Export triggers
-a, --all          # Export all DDL types
-o, --output <dir> # Output directory
--format <format>  # Output format (sql, json, yaml)
```

### Compare Options
```bash
-r, --report       # Generate comparison report
--html             # Generate HTML report
--json             # Generate JSON report
--diff             # Show diff only
--summary          # Show summary only
```

### Migration Options
```bash
--force            # Force migration without confirmation
--backup           # Create backup before migration
--rollback         # Enable rollback capability
--validate         # Validate before migration
```

## Examples

### Basic Workflow

```bash
# 1. Export from DEV
andb export -a DEV

# 2. Compare DEV with STAGE
andb compare -a STAGE

# 3. Migrate new objects to STAGE
andb migrate:new -a STAGE

# 4. Generate report
andb compare -r STAGE

# 5. Migrate to PROD
andb migrate:new -a PROD
```

### Advanced Workflow

```bash
# Export specific types
andb export -p DEV    # Export procedures from DEV
andb export -f DEV    # Export functions from DEV

# Compare with custom options
andb compare -p PROD --html    # Compare procedures with HTML report
andb compare -f PROD --diff    # Show function differences only

# Migration with validation
andb migrate:new -p STAGE --validate
andb migrate:update -f PROD --backup

# Monitor database
andb monitor -p PROD
andb monitor -s DEV
```

### Environment Configuration

```bash
# Set up environment variables
export DEV_DB_HOST=localhost
export DEV_DB_NAME=dev_database
export DEV_DB_USER=root
export DEV_DB_PASS=password

export PROD_DB_HOST=prod-server.com
export PROD_DB_NAME=prod_database
export PROD_DB_USER=prod_user
export PROD_DB_PASS=prod_password

# Run commands
andb export -t DEV
andb compare -f PROD
```

## Configuration

### Environment Variables
```bash
# Database Configuration
<ENV>_DB_HOST      # Database host
<ENV>_DB_NAME      # Database name
<ENV>_DB_USER      # Database user
<ENV>_DB_PASS      # Database password
<ENV>_DB_PORT      # Database port (default: 3306)

# Tool Configuration
ANDB_ENVIRONMENTS           # All environments
ANDB_COMPARE_ENVIRONMENTS  # Compare environments
ANDB_MIGRATE_ENVIRONMENTS  # Migrate environments
ANDB_BASE_DIR             # Base directory
ANDB_OUTPUT_DIR           # Output directory
ANDB_LOG_LEVEL            # Log level (debug, info, warn, error)
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

## Troubleshooting

### Common Issues

1. **Connection Error**
   ```bash
   # Check database connection
   mysql -h <host> -u <user> -p <database>
   
   # Verify environment variables
   echo $DEV_DB_HOST
   echo $DEV_DB_NAME
   ```

2. **Permission Error**
   ```bash
   # Check file permissions
   ls -la output/
   
   # Create output directory
   mkdir -p output/
   ```

3. **Configuration Error**
   ```bash
   # Show current configuration
   andb helper --config
   
   # Check environment variables
   env | grep ANDB
   ```

### Debug Mode

```bash
# Enable debug logging
export ANDB_LOG_LEVEL=debug

# Run with verbose output
andb export -t DEV --verbose

# Dry run to see commands
andb migrate:new -p PROD --dry-run
```

## Best Practices

1. **Always backup before migration**
2. **Test on staging before production**
3. **Use environment variables for sensitive data**
4. **Validate DDL before migration**
5. **Monitor database performance**
6. **Keep logs for audit trail** 