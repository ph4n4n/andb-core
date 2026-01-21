/**
 * @anph/core Container Service
 * 
 * @author ph4n4n
 * @version 1.0.0
 * @license MIT
 * @description Service container for dependency injection
 * 
 * Copyright (c) 2024 ph4n4n
 * https://github.com/ph4n4n/@anph/core
 */
const [EXPORTER, COMPARATOR, MIGRATOR, MONITOR,
  REPORT_HELPER, FILE_MANAGER, DB_UTIL_FN, BASE_DIR, STORAGE, DRIVER,
  CONNECTION_FACTORY
] = [
    'exporter', 'comparator', 'migrator', 'monitor',
    'reportHelper', 'fileManager', 'dbUtilFn', 'baseDir', 'storage', 'driver',
    'connectionFactory'
  ];
const ExporterService = require('./exporter');
const ComparatorService = require('./comparator');
const MigratorService = require('./migrator');
const MonitorService = require('./monitor');
const ConnectionFactory = require('./connection.factory');
const { createReportHelper } = require('../utils/report.helper');

module.exports = class Container {
  constructor(config) {
    this.config = config;
    this.services = new Map();
    this.configs = new Map();
    this.build();
  }

  build() {
    this
      .registerConfigurations()
      .addBaseDirectory()
      .createFileManager()
      .createStorage()
      .createDriver()
      .buildReportHelper()
      .buildExporter()
      .buildComparator()
      .buildMigrator()
      .buildMonitor();
  }

  // ... (buildMonitor, buildMigrator, buildComparator omitted/unchanged for now, focusing on Exporter first)

  buildMonitor() {
    this.services.set(MONITOR, (container) => {
      const dbUtilFn = container.get(DB_UTIL_FN);
      const fileManager = container.get(FILE_MANAGER);
      const driver = container.get(DRIVER); // Inject Driver

      return (field) => {
        const monitorService = new MonitorService({ ...dbUtilFn, fileManager, driver });
        return monitorService.monitor(field);
      };
    });
    return this;
  }

  buildMigrator() {
    this.services.set(MIGRATOR, (container) => {
      const dbUtilFn = container.get(DB_UTIL_FN);
      const fileManager = container.get(FILE_MANAGER);
      const storage = container.get(STORAGE);
      const driver = container.get(DRIVER); // Inject Driver

      const migratorService = new MigratorService({
        ...dbUtilFn,
        fileManager,
        storage,
        driver,
        isNotMigrateCondition: this.config.isNotMigrateCondition
      });

      return (ddl, status, name = null) => migratorService.migrate(ddl, status, name);
    });
    return this;
  }

  buildComparator() {
    this.services.set(COMPARATOR, (container) => {
      const dbUtilFn = container.get(DB_UTIL_FN);
      const reportHelper = container.get(REPORT_HELPER);
      const fileManager = container.get(FILE_MANAGER);
      const storage = container.get(STORAGE);
      const driver = container.get(DRIVER); // Inject Driver

      const comparatorService = new ComparatorService({
        ...dbUtilFn,
        appendReport: reportHelper.appendReport.bind(reportHelper),
        report2console: reportHelper.report2console.bind(reportHelper),
        report2html: reportHelper.report2html.bind(reportHelper),
        vimDiffToHtml: reportHelper.vimDiffToHtml.bind(reportHelper),
        fileManager,
        storage,
        driver,
        domainNormalization: this.config.domainNormalization
      });
      return (ddl, name = null) => comparatorService.compare(ddl, name);
    });
    return this;
  }

  buildExporter() {
    this.services.set(EXPORTER, (container) => {
      const dbUtilFn = container.get(DB_UTIL_FN);
      const reportHelper = container.get(REPORT_HELPER);
      const fileManager = container.get(FILE_MANAGER);
      const storage = container.get(STORAGE);
      const driver = container.get(DRIVER); // NEW: Inject Driver

      const exporterService = new ExporterService({
        ...dbUtilFn,
        appendReport: reportHelper.appendReport.bind(reportHelper),
        report2console: reportHelper.report2console.bind(reportHelper),
        report2html: reportHelper.report2html.bind(reportHelper),
        vimDiffToHtml: reportHelper.vimDiffToHtml.bind(reportHelper),
        fileManager,
        storage,
        driver, // NEW
        config: this.config
      });
      return (ddl, name = null) => exporterService.export(ddl, name);
    });
    return this;
  }

  buildReportHelper() {
    this.services.set(REPORT_HELPER, (container) => {
      const dbUtilFn = container.get(DB_UTIL_FN);
      const fileManager = container.get(FILE_MANAGER);
      return createReportHelper({
        ...dbUtilFn,
        fileManager,
        reportDir: this.config.reportDir || 'reports'
      });
    });
    return this;
  }

  createFileManager() {
    this.services.set(FILE_MANAGER, (container) => {
      const baseDir = container.get(BASE_DIR);
      const FileManager = require('../utils/file.helper');
      return FileManager.getInstance(baseDir);
    });
    return this;
  }

  createDriver() {
    // 1. Register ConnectionFactory
    this.services.set(CONNECTION_FACTORY, () => {
      const MySQLDriver = require('../drivers/mysql/MySQLDriver');
      return new ConnectionFactory({
        mysql: MySQLDriver,
        mariadb: MySQLDriver
      });
    });

    // 2. Register DRIVER as a connection requester
    this.services.set(DRIVER, (container) => {
      const factory = container.get(CONNECTION_FACTORY);
      // Returns an async function that establishes connection (with SSH support)
      return async (config) => await factory.getConnection(config);
    });
    return this;
  }

  createStorage() {
    this.services.set(STORAGE, (container) => {
      const baseDir = container.get(BASE_DIR);
      const fileManager = container.get(FILE_MANAGER);
      const storageType = this.config.storage || 'file';

      switch (storageType) {
        case 'sqlite': return this._buildSQLiteStorage(baseDir);
        case 'hybrid': return this._buildHybridStorage(baseDir, fileManager);
        default: return this._buildFileStorage(baseDir, fileManager);
      }
    });
    return this;
  }

  _buildSQLiteStorage(baseDir) {
    const { SQLiteStorage } = require('../utils/storage.strategy');
    return new SQLiteStorage(this.config.storagePath || './andb.db', baseDir);
  }

  _buildHybridStorage(baseDir, fileManager) {
    const { HybridStorage, SQLiteStorage, FileStorage } = require('../utils/storage.strategy');
    const dbPath = this.config.storagePath || './andb.db';
    return new HybridStorage(
      new SQLiteStorage(dbPath, baseDir),
      new FileStorage(fileManager, baseDir),
      this.config.autoExport || false
    );
  }

  _buildFileStorage(baseDir, fileManager) {
    const { FileStorage } = require('../utils/storage.strategy');
    return new FileStorage(fileManager, baseDir);
  }


  addBaseDirectory() {
    this.configs.set(BASE_DIR, this.config.baseDir || process.cwd());
    return this;
  }

  registerConfigurations() {
    this.configs.set(DB_UTIL_FN, {
      getDBDestination: this.config.getDBDestination,
      getSourceEnv: this.config.getSourceEnv,
      getDestEnv: this.config.getDestEnv,
      getDBName: this.config.getDBName,
      replaceWithEnv: this.config.replaceWithEnv,
      ENVIRONMENTS: this.config.ENVIRONMENTS
    });
    return this;
  }

  get(name) {
    // Get config if exist
    if (this.configs.has(name)) {
      return this.configs.get(name);
    }
    // Get service if exist
    if (this.services.has(name)) {
      return this.services.get(name)?.(this);
    }

    throw new Error(`Service or config '${name}' not found`);
  }

  // Helper method to get all services at once
  getServices() {
    return {
      exporter: this.get(EXPORTER),
      comparator: this.get(COMPARATOR),
      migrator: this.get(MIGRATOR),
      monitor: this.get(MONITOR),
      reportHelper: this.get(REPORT_HELPER)
    };
  }
}
