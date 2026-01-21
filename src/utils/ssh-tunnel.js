const { Client } = require('ssh2');
const net = require('net');

/**
 * SSH Tunneling Utility
 * Handles creation of secure tunnels for database connections.
 */
class SSHTunnel {
  constructor(config) {
    this.sshConfig = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      // Priority: Private Key > Password
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase
    };
    this.dbTarget = {
      host: config.dbHost,
      port: config.dbPort
    };
    this.sshClient = new Client();
    this.server = null;
    this.localPort = null;
  }

  /**
   * Start the SSH tunnel
   * @returns {Promise<number>} Returns the local port assigned to the tunnel
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.sshClient
        .on('ready', () => {
          // Create a local server to listen for DB connections
          this.server = net.createServer((sock) => {
            this.sshClient.forwardOut(
              '127.0.0.1',
              sock.remotePort,
              this.dbTarget.host,
              this.dbTarget.port,
              (err, stream) => {
                if (err) {
                  sock.end();
                  return;
                }
                sock.pipe(stream).pipe(sock);
              }
            );
          });

          // Listen on a random available port
          this.server.listen(0, '127.0.0.1', () => {
            this.localPort = this.server.address().port;
            if (global.logger) {
              global.logger.info(`SSH Tunnel established: 127.0.0.1:${this.localPort} -> ${this.dbTarget.host}:${this.dbTarget.port}`);
            }
            resolve(this.localPort);
          });

          this.server.on('error', (err) => {
            this.sshClient.end();
            reject(new Error(`Local tunnel server error: ${err.message}`));
          });
        })
        .on('error', (err) => {
          reject(new Error(`SSH Connection error: ${err.message}`));
        })
        .connect(this.sshConfig);
    });
  }

  /**
   * Close the tunnel and SSH connection
   */
  async close() {
    if (this.server) {
      this.server.close();
    }
    this.sshClient.end();
  }
}

module.exports = SSHTunnel;
