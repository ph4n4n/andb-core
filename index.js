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
const commander = require('./core/cli')
const configs = require('./core/configs')
const interfaces = require('./core/interfaces')

module.exports = {
  utils, commander, configs, interfaces
}