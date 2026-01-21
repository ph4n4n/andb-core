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

module.exports = class MonitorService {
  constructor(dependencies) {
    for (const key in dependencies) {
      this[key] = dependencies[key];
    }
  }

  monitor(field) {
    return async (env) => {
      if (global.logger) global.logger.warn(`Monitor ${field} for...`, env);
      const startTime = Date.now();
      const dbConfig = this.getDBDestination(env);

      const driver = await this.driver(dbConfig);
      const monitorService = driver.getMonitoringService();

      try {
        const methods = {
          'PROCESSLIST': () => monitorService.getProcessList(),
          'STATUS': () => monitorService.getStatus(),
          'VARIABLES': () => monitorService.getVariables(),
          'VERSION': () => monitorService.getVersion(),
          'CONNECTIONS': () => monitorService.getConnections(),
          'TRANSACTIONS': () => monitorService.getTransactions(),
        };

        if (!methods[field]) throw new Error(`Unknown monitor field: ${field}`);
        rs = await methods[field]();

        console.table(rs);
        const duration = Date.now() - startTime;

        if (global.logger) {
          global.logger.info(`\nMonitored ${rs?.length || 0} ${field} records in ${duration}ms`);
        }

        return {
          success: true,
          field,
          env,
          database: this.getDBName(env),
          count: typeof rs === 'number' ? rs : (Array.isArray(rs) ? rs.length : null),
          data: rs,
          duration
        };
      } catch (error) {
        if (global.logger) global.logger.error(`Monitor failed: ${error.message}`);
        throw error;
      } finally {
        await driver.disconnect();
      }
    };
  }
}