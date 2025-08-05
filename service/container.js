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
    this.initialize();
  }

  initialize() {
    // Register configurations from injected config
    this.configs.set('dbUtilFn', {
      getDBDestination: this.config.getDBDestination,
      getSourceEnv: this.config.getSourceEnv,
      getDestEnv: this.config.getDestEnv,
      getDBName: this.config.getDBName,
      replaceWithEnv: this.config.replaceWithEnv,
      ENVIRONMENTS: this.config.ENVIRONMENTS
    });

    // Add base directory to configs
    this.configs.set('baseDir', this.config.baseDir || process.cwd());

    // Create fileManager first (shared instance)
    this.services.set('fileManager', (container) => {
      const baseDir = container.get('baseDir');
      const FileManager = require('../utils/file.helper');
      return FileManager.getInstance(baseDir);
    });

    // ReportHelper (factory, not need DI class) - create first to avoid circular dependency
    this.services.set('reportHelper', (container) => {
      const dbUtilFn = container.get('dbUtilFn');
      const fileManager = container.get('fileManager');

      return createReportHelper({ ...dbUtilFn, fileManager });
    });

    // Exporter: class-based DI
    this.services.set('exporter', (container) => {
      const dbUtilFn = container.get('dbUtilFn');
      const reportHelper = container.get('reportHelper');
      const fileManager = container.get('fileManager');
      const exporterService = new ExporterService({ 
        ...dbUtilFn, 
        appendReport: reportHelper.appendReport.bind(reportHelper),
        report2console: reportHelper.report2console.bind(reportHelper),
        report2html: reportHelper.report2html.bind(reportHelper),
        vimDiffToHtml: reportHelper.vimDiffToHtml.bind(reportHelper),
        fileManager 
      });
      return (ddl) => exporterService.export(ddl);
    });

    // Comparator: class-based DI
    this.services.set('comparator', (container) => {
      const dbUtilFn = container.get('dbUtilFn');
      const reportHelper = container.get('reportHelper');
      const fileManager = container.get('fileManager');
      const comparatorService = new ComparatorService({ 
        ...dbUtilFn, 
        appendReport: reportHelper.appendReport.bind(reportHelper),
        report2console: reportHelper.report2console.bind(reportHelper),
        report2html: reportHelper.report2html.bind(reportHelper),
        vimDiffToHtml: reportHelper.vimDiffToHtml.bind(reportHelper),
        fileManager 
      });
      return (ddl) => comparatorService.compare(ddl);
    });

    // Migrator: class-based DI
    this.services.set('migrator', (container) => {
      const dbUtilFn = container.get('dbUtilFn');
      const fileManager = container.get('fileManager');
      const migratorService = new MigratorService({ ...dbUtilFn, fileManager });
      return (ddl, status) => migratorService.migrate(ddl, status);
    });

    // Monitor: class-based DI
    this.services.set('monitor', (container) => {
      const dbUtilFn = container.get('dbUtilFn');
      const fileManager = container.get('fileManager');
      const monitorService = new MonitorService({ ...dbUtilFn, fileManager });
      return (field) => monitorService.monitor(field);
    });
  }

  get(name) {
    if (this.configs.has(name)) {
      return this.configs.get(name);
    }

    if (this.services.has(name)) {
      return this.services.get(name)?.(this);
    }

    throw new Error(`Service or config '${name}' not found`);
  }

  // Helper method to get all services at once
  getServices() {
    return {
      exporter: this.get('exporter'),
      comparator: this.get('comparator'),
      migrator: this.get('migrator'),
      monitor: this.get('monitor'),
      reportHelper: this.get('reportHelper')
    };
  }
}
 