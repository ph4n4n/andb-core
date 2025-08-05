const utils = require('./utils')
const cli = require('./cli')
const { IDatabaseService, IDatabaseConfig } = require('./interfaces/database.interface')

module.exports = {
  utils, cli, interfaces: { IDatabaseService, IDatabaseConfig }
}