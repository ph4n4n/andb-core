require('dotenv').config();

const { commander } = require('andb-core');

const {
  getDBDestination,
  getSourceEnv,
  getDestEnv,
  getDBName,
  replaceWithEnv,
  ENVIRONMENTS
} = require('./configs/db');

const andbCli = commander.build({
  getDBDestination,
  getSourceEnv,
  getDestEnv,
  getDBName,
  replaceWithEnv,
  ENVIRONMENTS,
  baseDir: process.env.BASE_DIR || process.cwd()
});

andbCli.parse(process.argv); 