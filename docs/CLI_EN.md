# CLI Guide - @the-andb/core-nest

## Overview

The Command Line Interface (CLI) for the NestJS rewrite of `@the-andb/core` provides tools for project automation and helper utilities. It is built using `nest-commander`.

## Installation

```bash
cd core-nest
npm install
```

## Basic Commands

Currently, the following commands are ported and available:

### `helper` (or `help`)

Provides usage instructions, lists available scripts, and displays project configuration.

```bash
# Show usage
npx andb-cli helper

# List scripts in package.json
npx andb-cli helper --list

# Show current configuration (from andb.yaml and environment)
npx andb-cli helper --config
```

### `generate`

Automatically generates npm scripts in your `package.json` for common database operations across environments.

```bash
# Generate scripts for all environments
npx andb-cli generate

# Generate scripts for specific environments
npx andb-cli generate -e DEV,PROD

# Generate scripts based on environment variables
export ANDB_ENVIRONMENTS="DEV,UAT,PROD"
npx andb-cli generate
```

## Environment Options

The CLI respects several environment variables to determine available targets:

- `ANDB_ENVIRONMENTS`: Comma-separated list of all environments (default: `LOCAL,DEV,UAT,STAGE,PROD`)
- `ANDB_COMPARE_ENVIRONMENTS`: Environments available for comparison.
- `ANDB_MIGRATE_ENVIRONMENTS`: Environments available for migration.

## Configuration

The CLI can load project-specific configuration from `andb.yaml` in the current working directory.

Example `andb.yaml`:

```yaml
ENVIRONMENTS:
  - DEV
  - STAGE
  - PROD
getDBDestination:
  DEV:
    host: localhost
    database: myapp_dev
    user: root
  PROD:
    host: db.production.com
    database: myapp_prod
    user: admin
```

## Running the CLI

During development, you can run the CLI using:

```bash
npx ts-node src/cli/main.ts [command]
```

After building, you can use:

```bash
node dist/cli/main.js [command]
```

## Parity Roadmap

The following commands are planned for porting:

- `export`: Export database structures to SQL files.
- `compare`: Deep-diff environments and generate reports.
- `migrate`: Execute schema changes safely.
- `monitor`: Real-time database monitoring.
