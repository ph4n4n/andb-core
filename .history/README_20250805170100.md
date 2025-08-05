# andb-core

Database migration and comparison tool by ph4n4n

## Installation

```bash
npm install andb-core
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
const andb = require('andb-core');

// Use services
const { service, utils, cli, configs, interfaces } = andb;
```

## Features

- Database object export (tables, procedures, functions, triggers)
- Database comparison between environments
- Migration tools for new/updated objects
- Database monitoring
- Multi-environment support

## License

MIT 