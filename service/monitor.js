/**
 * @anph/core Monitor Service - Database monitoring
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Service for monitoring database status
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */

const mysql = require('mysql2');
const util = require("util");

module.exports = class MonitorService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }
  }

  async monitorProcessList(connection) {
    const query = 'SHOW full PROCESSLIST';
    const result = await util.promisify(connection.query).call(connection, query);
    console.table(result);
    return result.length;
  }

  async monitorStatus(connection) {
    const query = 'SHOW STATUS';
    const result = await util.promisify(connection.query).call(connection, query);
    console.table(result);
    return result.length;
  }

  async monitorVariables(connection) {
    const query = 'SHOW VARIABLES';
    const result = await util.promisify(connection.query).call(connection, query);
    console.table(result);
    return result.length;
  }

  async monitorVersion(connection) {
    const query = 'SELECT VERSION() AS version';
    const result = await util.promisify(connection.query).call(connection, query);
    console.log('==============================================');
    console.log('MySQL Version', result[0].version);
    console.log('==============================================');
    return result[0].version;
  }

  async monitorConnections(connection) {
    const query = `
      select count(*) connections, pl.* 
        from information_schema.PROCESSLIST pl
       group by pl.user
       order by 1 desc;
    `;
    const result = await util.promisify(connection.query).call(connection, query);
    console.table(result);
    return result.length;
  }

  async monitorTransactions(connection) {
    const query = `
      select * 
        from information_schema.innodb_trx 
       where trx_state is not null;
    `;
    const result = await util.promisify(connection.query).call(connection, query);
    console.table(result);
    return result.length;
  }

  monitor(field) {
    return async (env) => {
      alog.warn(`Monitor ${field} for...`, env);
      const labelTime = `... showed from ${env}.${this.getDBName(env)} success in:`;
      const dbConfig = this.getDBDestination(env);
      // Create a MySQL connection
      const connection = mysql.createConnection({
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port,
      });
      // Connect to the MySQL server
      connection.connect(async (err) => {
        console.time(labelTime);
        if (err) {
          alog.error("Error connecting to the database: ", err);
          process.exit(1);
        }
        let rs;
        switch (field) {
          case 'PROCESSLIST':
            rs = await this.monitorProcessList(connection);
            break;
          case 'STATUS':
            rs = await this.monitorStatus(connection);
            break;
          case 'VARIABLES':
            rs = await this.monitorVariables(connection);
            break;
          case 'VERSION':
            rs = await this.monitorVersion(connection);
            break;
          case 'CONNECTIONS':
            rs = await this.monitorConnections(connection);
            break;
          case 'TRANSACTIONS':
            rs = await this.monitorTransactions(connection);
            break;
        }
        // Close the MySQL connection
        connection.end();
        alog.info(`\nThere are ${rs} ${field} have been..`);
        console.timeEnd(labelTime);
      });
    };
  }
}