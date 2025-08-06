#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import core modules
const andb = require('../../index');
const { generator } = require('./generator');
const { helper } = require('./helper');

// Set global context for scripts
global.ANDB_BASE_DIR = process.cwd();

function showUsage() {
  console.log(`
🔧 ANDB Core CLI
================

📋 Available Commands:
---------------------

1. Generate Scripts:
   node andb generate                    # Generate package.json scripts
   node andb generate -e "DEV,PROD"     # Custom environments
   node andb generate -c "DEV,PROD"     # Custom compare environments
   node andb generate -m "PROD"         # Custom migrate environments

2. Helper Commands:
   node andb helper                      # Show usage help
   node andb helper --list              # List all scripts
   node andb helper --config            # Show configuration

3. Direct CLI Commands:
   node andb export -t                  # Export tables
   node andb export -f                  # Export functions
   node andb export -p                  # Export procedures
   node andb export -tr                 # Export triggers

   node andb compare -t                 # Compare tables
   node andb compare -f                 # Compare functions
   node andb compare -p                 # Compare procedures
   node andb compare -tr                # Compare triggers
   node andb compare -r                 # Generate report

   node andb migrate:new -t             # Migrate new tables
   node andb migrate:new -f             # Migrate new functions
   node andb migrate:new -p             # Migrate new procedures
   node andb migrate:new -tr            # Migrate new triggers

   node andb migrate:update -t          # Update tables
   node andb migrate:update -f          # Update functions
   node andb migrate:update -p          # Update procedures
   node andb migrate:update -tr         # Update triggers

   node andb deprecate -f               # Deprecate functions
   node andb deprecate -p               # Deprecate procedures
   node andb deprecate -tr              # Deprecate triggers
   node andb deprecate -rmos            # Remove OTE procedures
   node andb deprecate -rmof            # Remove OTE functions

   node andb monitor -s                 # Monitor status
   node andb monitor -p                 # Monitor processlist
   node andb monitor -vv                # Monitor variables
   node andb monitor -c                 # Monitor connections
   node andb monitor -t                 # Monitor transactions

💡 Quick Examples:
-----------------
node andb generate                      # Setup package.json scripts
npm run export:dev                     # Export all from DEV
npm run compare:uat                    # Compare UAT with DEV
npm run migrate:stage                  # Migrate STAGE from UAT
npm run deprecate:prod:fn              # Deprecate functions in PROD

🔧 Environment Variables:
------------------------
ANDB_ENVIRONMENTS="DEV,PROD"           # Custom environments
ANDB_COMPARE_ENVIRONMENTS="DEV,PROD"   # Custom compare environments
ANDB_MIGRATE_ENVIRONMENTS="PROD"       # Custom migrate environments
BASE_DIR="/path/to/project"            # Base directory

📝 Notes:
---------
- Use 'node andb generate' to setup package.json scripts
- Use 'npm run' commands after generation for convenience
- Direct CLI commands work without package.json setup
- Environment variables override default configuration
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    showUsage();
    return;
  }

  switch (command) {
    case 'generate':
      // Parse options for generator
      const options = {};
      for (let i = 1; i < args.length; i += 2) {
        if (args[i] === '-e' && args[i + 1]) {
          process.env.ANDB_ENVIRONMENTS = args[i + 1];
        } else if (args[i] === '-c' && args[i + 1]) {
          process.env.ANDB_COMPARE_ENVIRONMENTS = args[i + 1];
        } else if (args[i] === '-m' && args[i + 1]) {
          process.env.ANDB_MIGRATE_ENVIRONMENTS = args[i + 1];
        }
      }
      generator.updatePackageJson();
      break;

    case 'helper':
      helper.showUsage();
      break;

    case 'export':
    case 'compare':
    case 'migrate:new':
    case 'migrate:update':
    case 'deprecate':
    case 'monitor':
      // Delegate to core CLI
      const { commander } = andb;
      const cli = commander.build({
        getDBDestination: (env, mail = false) => {
          // Default implementation - should be overridden
          return {
            host: process.env[`${env}_DB_HOST`],
            database: process.env[`${env}_DB_NAME`],
            user: process.env[`${env}_DB_USERNAME`],
            password: process.env[`${env}_DB_PASSWORD`]
          };
        },
        getSourceEnv: (envName) => envName === 'PROD' ? 'DEV' : 'DEV',
        getDestEnv: (env) => env === 'DEV' ? 'PROD' : 'PROD',
        getDBName: (env, isDbMail = false) => {
          return isDbMail 
            ? process.env[`${env}_DB_MAIL`]
            : process.env[`${env}_DB_NAME`];
        },
        replaceWithEnv: (ddl, destEnv) => {
          return destEnv === 'PROD' 
            ? ddl.replace(/@dev\.com/g, '@prod.com')
            : ddl;
        },
        ENVIRONMENTS: { DEV: 'DEV', PROD: 'PROD' },
        baseDir: process.cwd()
      });
      
      // Reconstruct command line arguments
      const cliArgs = ['node', 'andb', ...args];
      process.argv = cliArgs;
      cli.parse(cliArgs);
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      showUsage();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, showUsage }; 