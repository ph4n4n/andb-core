require('dotenv').config();

const andbCore = require('andb-core');
const cli = andbCore.cli;

const {
  getDBDestination,
  getSourceEnv,
  getDestEnv,
  getDBName,
  replaceWithEnv,
  ENVIRONMENTS
} = require('./configs/db');

const andbCli = cli.build({
  getDBDestination,
  getSourceEnv,
  getDestEnv,
  getDBName,
  replaceWithEnv,
  ENVIRONMENTS,
  baseDir: process.env.BASE_DIR || process.cwd()
});

andbCli.parse(process.argv); 