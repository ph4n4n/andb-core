/**
 * The Andb Core - Database Orchestration Engine
 * 
 * @author ph4n4n
 * @version 3.0.0
 * @license MIT
 * @description Core module for database migration, comparison and monitoring
 * 
 * Copyright (c) 2026 The Andb
 * https://github.com/The-Andb/andb-core
 */

const utils = require('./src/utils');
const configs = require('./src/configs');
const interfaces = require('./src/interfaces');

// Services
const ExporterService = require('./src/service/exporter');
const ComparatorService = require('./src/service/comparator');
const MigratorService = require('./src/service/migrator');
const MonitorService = require('./src/service/monitor');
const Container = require('./src/service/container');

// CLI Builder
const { build: buildCLI } = require('./src/cli');

module.exports = {
  utils,
  configs,
  interfaces,
  ExporterService,
  ComparatorService,
  MigratorService,
  MonitorService,
  Container,
  buildCLI
};