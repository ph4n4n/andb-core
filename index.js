/**
 * @anph/core - Database migration and comparison tool
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Core module for database migration, comparison and monitoring
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */

const utils = require('./core/utils')
const configs = require('./core/configs')
const interfaces = require('./core/interfaces')

// Services
const ExporterService = require('./core/service/exporter')
const ComparatorService = require('./core/service/comparator')
const MigratorService = require('./core/service/migrator')
const MonitorService = require('./core/service/monitor')
const Container = require('./core/service/container')

// CLI Builder
const { build: buildCLI } = require('./core/cli')

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
}