const AWS = require('aws-sdk');

class SSMStorage {
  static async init(ssmName, region, environment) {
    const ssm = new AWS.SSM({ region });
    
    try {
      const params = {
        Name: ssmName,
        WithDecryption: true
      };
      
      const result = await ssm.getParameter(params).promise();
      const config = JSON.parse(result.Parameter.Value);
      
      // Set environment variables for database connection
      process.env[`DB_HOST_${environment}`] = config.host;
      process.env[`DB_PORT_${environment}`] = config.port;
      process.env[`DB_USER_${environment}`] = config.user;
      process.env[`DB_PASSWORD_${environment}`] = config.password;
      process.env[`DB_NAME_${environment}`] = config.database;
      
      console.log(`SSM config loaded for ${environment}`);
    } catch (error) {
      console.error(`Failed to load SSM config for ${environment}:`, error.message);
    }
  }
}

module.exports = SSMStorage; 