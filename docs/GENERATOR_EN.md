# Script Generator - @the-andb/core-nest

## Overview

The Script Generator automatically creates npm scripts in your `package.json` to streamline database workflows across multiple environments. It is a key part of the `@the-andb/core-nest` package, ensuring consistent and predictable database operations.

## Usage

### 1. Basic Generation

Run the `generate` command to create scripts based on default configurations:

```bash
npx andb generate
```

### 2. Customizing Environments

You can specify which environments to generate scripts for via CLI options or environment variables:

```bash
# Via CLI option
npx andb generate --environments DEV,STAGE,PROD

# Via Environment Variables
export ANDB_ENVIRONMENTS="DEV,PROD"
npx andb generate
```

## Supported Configurations

### Environments

The generator handles several environment types:

- **All Environments** (`ANDB_ENVIRONMENTS`): List of all target environments.
- **Compare Environments** (`ANDB_COMPARE_ENVIRONMENTS`): Environments intended as comparison targets.
- **Migrate Environments** (`ANDB_MIGRATE_ENVIRONMENTS`): Environments where migrations are allowed.

### DDL Object Types

Scripts are generated for the following object types (shorthands in brackets):

- **Tables** (`tbl`)
- **Functions** (`fn`)
- **Stored Procedures** (`sp`)
- **Triggers** (`trg`)
- **Events** (`ev`)

## Generated Scripts Categories

The generator typically creates the following types of scripts:

### Export Scripts

Tools to dump schema from a specific environment.

- `npm run export:dev:tbl`
- `npm run export:prod` (all types)

### Compare Scripts

Tools to diff schemas between environments.

- `npm run compare:prod:tbl`
- `npm run compare:prod:report` (generates premium HTML reports)

### Migrate Scripts

Tools to safely apply schema changes.

- `npm run migrate:prod:new`
- `npm run migrate:prod:update`

## How it Works

1. **Discovery**: The generator reads your `package.json` to find the base project path.
2. **Analysis**: It determines the target environments from `andb.yaml`, CLI flags, or environment variables (in that order of priority).
3. **Template Rendering**: It builds the appropriate `andb` commands for each environment/operation combination.
4. **Injection**: It updates the `scripts` section of your `package.json` with the new commands, preserving existing scripts.

## Best Practices

- **Commit Scripts**: Always commit your updated `package.json` after running the generator so your team can use the same scripts.
- **Dry Run**: Before executing a generated migration script on production, use the `--dry-run` flag (if available in the underlying command) or check the generated SQL in the comparison report.
- **andb.yaml**: Use an `andb.yaml` file for a stable and version-controlled environment configuration.
