const ENVIRONMENTS = {
  DEV: 'DEV',
  PROD: 'PROD'
};

const getDBDestination = (env) => {
  // Return database connection config for environment
  return {
    host: process.env[`DB_HOST_${env}`],
    port: process.env[`DB_PORT_${env}`] || 3306,
    user: process.env[`DB_USER_${env}`],
    password: process.env[`DB_PASSWORD_${env}`],
    database: process.env[`DB_NAME_${env}`]
  };
};

const getSourceEnv = () => process.env.SOURCE_ENV || 'DEV';
const getDestEnv = () => process.env.DEST_ENV || 'PROD';
const getDBName = (env) => process.env[`DB_NAME_${env}`] || 'default_db';

const replaceWithEnv = (str, env) => {
  return str.replace(/\{ENV\}/g, env);
};

module.exports = {
  ENVIRONMENTS,
  getDBDestination,
  getSourceEnv,
  getDestEnv,
  getDBName,
  replaceWithEnv
}; 