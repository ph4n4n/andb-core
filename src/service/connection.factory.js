const SSHTunnel = require('../utils/ssh-tunnel');

/**
 * ConnectionFactory
 * Standardized way to create database connections with SSH support.
 */
class ConnectionFactory {
  /**
   * @param {Object} drivers - Map of available driver classes
   */
  constructor(drivers = {}) {
    this.drivers = {
      ...drivers,
      'dump': require('../drivers/mysql/DumpDriver')
    };
    this.activeTunnels = new Map();
  }

  /**
   * Orchestrate connection: SSH (optional) + Driver
   * @param {Object} config - Database and SSH configuration
   * @returns {Promise<IDatabaseDriver>}
   */
  async getConnection(config) {
    const type = config.type || 'mysql';
    const DriverClass = this.drivers[type];

    if (!DriverClass) {
      throw new Error(`Unsupported database type: ${type}`);
    }

    let connectionConfig = { ...config };
    let tunnel = null;

    if (config.ssh && config.ssh.enabled) {
      const { tunnel: t, config: c } = await this._setupSSHTunnel(config);
      tunnel = t;
      connectionConfig = c;
    }

    const driver = new DriverClass(connectionConfig);
    this._wrapDisconnect(driver, tunnel);

    await driver.connect();
    return driver;
  }

  async _setupSSHTunnel(config) {
    const tunnel = new SSHTunnel({
      ...config.ssh,
      dbHost: config.host,
      dbPort: config.port
    });

    const localPort = await tunnel.connect();
    return {
      tunnel,
      config: { ...config, host: '127.0.0.1', port: localPort }
    };
  }

  _wrapDisconnect(driver, tunnel) {
    const originalDisconnect = driver.disconnect.bind(driver);
    driver.disconnect = async () => {
      await originalDisconnect();
      if (tunnel) await tunnel.close();
    };
  }
}

module.exports = ConnectionFactory;
