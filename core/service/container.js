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
  REPORT_HELPER, FILE_MANAGER, DB_UTIL_FN, BASE_DIR, STORAGE, DRIVER
] = [
    'exporter', 'comparator', 'migrator', 'monitor',
    'reportHelper', 'fileManager', 'dbUtilFn', 'baseDir', 'storage', 'driver'
  ];
const ExporterService = require('./exporter');
const ComparatorService = require('./comparator');
const MigratorService = require('./migrator');
const MonitorService = require('./monitor');
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
      .createDriver() // NEW: Driver abstraction
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
      return createReportHelper({ ...dbUtilFn, fileManager });
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
    this.services.set(DRIVER, (container) => {
      // For now, hardcode MySQL, but strictly we should use config.type
      // const type = this.config.type || 'mysql';

      const MySQLDriver = require('../drivers/mysql/MySQLDriver');

      // Driver needs config, but config depends on Environment (DEV, PROD) which is passed at runtime...
      // Wait, the Driver in `driver.interface.js` takes config in constructor.
      // But Exporter `export(env)` function gets `env` at runtime.

      // So Container should return a "DriverFactory" or the Driver should be stateless/connect on demand with config?
      // In logical decoupling, the Service calls `driver.connect(config)`.

      // Let's modify the Driver Interface to allow creating instances or connecting with config.
      // Actually, my MySQLDriver implementation takes config in Constructor.

      // So here we should return a factory function: (config) => new MySQLDriver(config)

      return (config) => new MySQLDriver(config);
    });
    return this;
  }

  createStorage() {
    this.services.set(STORAGE, (container) => {
      const baseDir = container.get(BASE_DIR);
      const fileManager = container.get(FILE_MANAGER);

      // Determine storage strategy from config
      const storageType = this.config.storage || 'file'; // Default: file (backward compatible)

      if (storageType === 'sqlite') {
        const { SQLiteStorage } = require('../utils/storage.strategy');
        const dbPath = this.config.storagePath || './andb.db';
        return new SQLiteStorage(dbPath, baseDir);
      }

      if (storageType === 'hybrid') {
        const { HybridStorage, SQLiteStorage, FileStorage } = require('../utils/storage.strategy');
        const dbPath = this.config.storagePath || './andb.db';
        const sqlite = new SQLiteStorage(dbPath, baseDir);
        const files = new FileStorage(fileManager, baseDir);
        const autoExport = this.config.autoExport || false;
        return new HybridStorage(sqlite, files, autoExport);
      }

      // Default: FileStorage (backward compatible)
      const { FileStorage } = require('../utils/storage.strategy');
      return new FileStorage(fileManager, baseDir);
    });
    return this;
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
