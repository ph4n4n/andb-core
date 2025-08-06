/**
 * @anph/core CLI - Command Line Interface
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description command line tool written for database migration, comparison and monitoring
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */

module.exports = {
  build: ({
    getDBDestination,
    getSourceEnv,
    getDestEnv,
    getDBName,
    replaceWithEnv,
    ENVIRONMENTS,
    baseDir,
    logName
  }) => {
    // init logger
    global.logger = require('andb-logger')
      .getInstance({
        mode: process.env.MODE || 'PROD',
        dirpath: __dirname,
        logName: logName || 'ANDB-CORE',
      })

    const { Command } = require('commander');
    const {
      REPORT,
      DDL: { TABLES, FUNCTIONS, PROCEDURES, TRIGGERS },
      STATUSES: { NEW, UPDATED, DEPRECATED, OTE }
    } = require('./configs/constants');

    const Container = require('./service/container');
    const container = new Container({
      getDBDestination,
      getSourceEnv,
      getDestEnv,
      getDBName,
      replaceWithEnv,
      ENVIRONMENTS
    });
    const { exporter, comparator, migrator, monitor } = container.getServices();

    const program = new Command();
    program
      .command("export")
      .version('1.0.0', '-v, --version')
      .option('-t, --tables [value]', 'export tables', exporter(TABLES))
      .option('-p, --procedures [value]', 'export procedures', exporter(PROCEDURES))
      .option('-f, --functions [value]', 'export functions', exporter(FUNCTIONS))
      .option('-tr, --triggers [value]', 'export triggers', exporter(TRIGGERS));

    program
      .command("compare")
      .version('1.1.0', '-v, --version')
      .option('-p, --procedures [value]', 'compare procedures to get ready migrate to next ENV', comparator(PROCEDURES))
      .option('-f, --functions [value]', 'compare functions to get ready migrate to next ENV', comparator(FUNCTIONS))
      .option('-t, --tables [value]', 'compare tables to get ready migrate to next ENV', comparator(TABLES))
      .option('-tr, --triggers [value]', 'compare triggers to get ready migrate to next ENV', comparator(TRIGGERS))
      .option('-r, --report [value]', 'compare tables to get ready migrate to next ENV', comparator(REPORT));

    program
      .command('migrate:new')
      .version('1.2.0', '-v, --version')
      .option('-p, --procedures [value]', 'migrate new procedures', migrator(PROCEDURES, NEW))
      .option('-f, --functions [value]', 'migrate new functions', migrator(FUNCTIONS, NEW))
      .option('-t, --tables [value]', 'migrate new tables', migrator(TABLES, NEW))
      .option('-tr, --triggers [value]', 'migrate new triggers', migrator(TRIGGERS, NEW));

    program
      .command('migrate:update')
      .version('1.2.0', '-v, --version')
      .option('-p, --procedures [value]', 'update procedures', migrator(PROCEDURES, UPDATED))
      .option('-f, --functions [value]', 'update functions', migrator(FUNCTIONS, UPDATED))
      .option('-t, --tables [value]', 'update tables', migrator(TABLES, UPDATED))
      .option('-tr, --triggers [value]', 'update triggers', migrator(TRIGGERS, UPDATED));
    // .option('-s, --seed-data [value]', 'seed data to tables', migrator(TABLES, 'SEEDING'));

    program
      .command('deprecate')
      .alias('dep')
      .version('1.2.0', '-v, --version')
      .option('-p, --procedures [value]', 'deprecate procedures', migrator(PROCEDURES, DEPRECATED))
      .option('-f, --functions [value]', 'deprecate functions', migrator(FUNCTIONS, DEPRECATED))
      .option('-tr, --triggers [value]', 'deprecate triggers', migrator(TRIGGERS, DEPRECATED))
      .option('-rmos, --remove-ote-procedures [value]', 'remove OTE procedures', migrator(PROCEDURES, OTE))
      .option('-rmof, --remove-ote-functions [value]', 'remove OTE functions', migrator(FUNCTIONS, OTE));

    program
      .command('monitor')
      .version('1.3.0', '-v, --version')
      .option('-p, --processlist [value]', 'monitor processlist', monitor('PROCESSLIST'))
      .option('-s, --status [value]', 'monitor status', monitor('STATUS'))
      .option('-vv, --variables [value]', 'monitor variables', monitor('VARIABLES'))
      .option('-c, --connections [value]', 'monitor connections', monitor('CONNECTIONS'))
      .option('-t, --transactions [value]', 'monitor transactions', monitor('TRANSACTIONS'))
      .option('-V, --version-sql [value]', 'monitor version', monitor('VERSION'));

    // Scripts commands
    program
      .command('generate')
      .alias('gen')
      .version('1.4.0', '-v, --version')
      .description('Generate scripts and utilities')
      .option('-e, --environments <list>', 'comma-separated list of environments (e.g., DEV,PROD)')
      .option('-c, --compare-envs <list>', 'comma-separated list of environments for comparison')
      .option('-m, --migrate-envs <list>', 'comma-separated list of environments for migration')
      .action((options) => {
        const path = require('path');
        const scriptPath = path.join(__dirname, 'scripts', 'generator.js');

        // Set environment variables from CLI options
        if (options.environments) {
          process.env.ANDB_ENVIRONMENTS = options.environments;
        }
        if (options.compareEnvs) {
          process.env.ANDB_COMPARE_ENVIRONMENTS = options.compareEnvs;
        }
        if (options.migrateEnvs) {
          process.env.ANDB_MIGRATE_ENVIRONMENTS = options.migrateEnvs;
        }

        // Set global context for scripts
        global.ANDB_BASE_DIR = baseDir;
        global.ANDB_CONTEXT = {
          baseDir,
          getDBDestination,
          getSourceEnv,
          getDestEnv,
          getDBName,
          replaceWithEnv,
          ENVIRONMENTS
        };

        require(scriptPath);
      });

    program
      .command('helper')
      .alias('help')
      .version('1.4.0', '-v, --version')
      .description('Helper utilities and tools')
      .option('-l, --list', 'list available helpers')
      .option('-c, --config', 'show current configuration')
      .action((options) => {
        const path = require('path');
        const scriptPath = path.join(__dirname, 'scripts', 'helper.js');

        // Set global context for scripts
        global.ANDB_BASE_DIR = baseDir;
        global.ANDB_CONTEXT = {
          baseDir,
          getDBDestination,
          getSourceEnv,
          getDestEnv,
          getDBName,
          replaceWithEnv,
          ENVIRONMENTS
        };

        // Pass arguments to helper script
        const args = process.argv.slice(3); // Remove 'node', 'andb.js', 'helper'
        if (options.list) {
          args.unshift('--list');
        }
        if (options.config) {
          args.unshift('--config');
        }

        // Set process.argv for helper script
        const originalArgv = process.argv;
        process.argv = ['node', scriptPath, ...args];

        try {
          require(scriptPath);
        } finally {
          // Restore original argv
          process.argv = originalArgv;
        }
      });

    return program;
  }
};