const jestMock = () => jest.fn(() => jest.fn());

jest.mock('../core/utils/file.helper', () => {
  const mockFileManagerInstance = {
    readFromFile: jest.fn(),
    saveToFile: jest.fn(),
    makeSureFolderExisted: jest.fn(),
    emptyDirectory: jest.fn(),
    copyFile: jest.fn(),
    removeFile: jest.fn()
  };
  return {
    getInstance: jest.fn(() => mockFileManagerInstance)
  };
});

const mockReportHelper = {
  appendReport: jest.fn(),
  report2console: jest.fn(),
  report2html: jest.fn(),
  vimDiffToHtml: jest.fn()
};
jest.mock('../core/utils/report.helper', () => ({
  createReportHelper: jest.fn(() => mockReportHelper)
}));

const mockExport = jest.fn();
jest.mock('../core/service/exporter', () => jest.fn().mockImplementation(() => ({ export: mockExport })));
const mockCompare = jest.fn();
jest.mock('../core/service/comparator', () => jest.fn().mockImplementation(() => ({ compare: mockCompare })));
const mockMigrate = jest.fn();
jest.mock('../core/service/migrator', () => jest.fn().mockImplementation(() => ({ migrate: mockMigrate })));
const mockMonitor = jest.fn();
jest.mock('../core/service/monitor', () => jest.fn().mockImplementation(() => ({ monitor: mockMonitor })));

const Container = require('../core/service/container');

describe('Container DI System', () => {
  let config;
  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      getDBDestination: jest.fn(),
      getSourceEnv: jest.fn(),
      getDestEnv: jest.fn(),
      getDBName: jest.fn(),
      replaceWithEnv: jest.fn(),
      ENVIRONMENTS: { DEV: 'DEV', UAT: 'UAT' },
      baseDir: '/test/base/dir'
    };
  });

  test('initializes and gets config', () => {
    const container = new Container(config);
    expect(container.get('baseDir')).toBe('/test/base/dir');
    expect(container.get('dbUtilFn')).toMatchObject({ getDBDestination: config.getDBDestination });
  });

  test('gets fileManager as singleton', () => {
    const container = new Container(config);
    const fm1 = container.get('fileManager');
    const fm2 = container.get('fileManager');
    expect(fm1).toBe(fm2);
  });

  test('gets reportHelper correctly', () => {
    const container = new Container(config);
    const rh = container.get('reportHelper');
    expect(rh).toBe(mockReportHelper);
  });

  test('exporter returns function and calls correctly', () => {
    const container = new Container(config);
    const exporter = container.get('exporter');
    expect(typeof exporter).toBe('function');
    exporter('TABLES');
    expect(mockExport).toHaveBeenCalledWith('TABLES');
  });

  test('comparator returns function and calls correctly', () => {
    const container = new Container(config);
    const comparator = container.get('comparator');
    expect(typeof comparator).toBe('function');
    comparator('TABLES');
    expect(mockCompare).toHaveBeenCalledWith('TABLES');
  });

  test('migrator returns function and calls correctly', () => {
    const container = new Container(config);
    const migrator = container.get('migrator');
    expect(typeof migrator).toBe('function');
    migrator('TABLES', 'status');
    expect(mockMigrate).toHaveBeenCalledWith('TABLES', 'status');
  });

  test('monitor returns function and calls correctly', () => {
    const container = new Container(config);
    const monitor = container.get('monitor');
    expect(typeof monitor).toBe('function');
    monitor('field');
    expect(mockMonitor).toHaveBeenCalledWith('field');
  });

  test('getServices returns all services', () => {
    const container = new Container(config);
    const services = container.getServices();
    expect(Object.keys(services)).toEqual(
      expect.arrayContaining(['exporter', 'comparator', 'migrator', 'monitor', 'reportHelper'])
    );
    expect(typeof services.exporter).toBe('function');
    expect(typeof services.comparator).toBe('function');
    expect(typeof services.migrator).toBe('function');
    expect(typeof services.monitor).toBe('function');
    expect(services.reportHelper).toBe(mockReportHelper);
  });

  test('calling non-existent service throws', () => {
    const container = new Container(config);
    expect(() => container.get('unknown')).toThrow(/not found/);
  });

  test('no circular dependency when calling getServices', () => {
    const container = new Container(config);
    expect(() => container.getServices()).not.toThrow();
  });
}); 