const SSMStorage = require('./configs/SSMStorage');
const {
  ENVIRONMENTS: { DEV, PROD }
} = require('./configs/db');

require('dotenv').config();

(async () => {
  const {
    AWS_SSM_NAME_DEV = '',
    AWS_SSM_NAME_PROD = '',
    AWS_REGION_DEV = '',
    AWS_REGION_PROD = '',
  } = process.env;

  if (AWS_SSM_NAME_DEV.length) {
    await SSMStorage.init(AWS_SSM_NAME_DEV, AWS_REGION_DEV, DEV);
  }
  if (AWS_SSM_NAME_PROD.length) {
    await SSMStorage.init(AWS_SSM_NAME_PROD, AWS_REGION_PROD, PROD);
  }

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
})(); 