const jestMock = () => jest.fn(() => jest.fn());

jest.mock('../utils/file.helper', () => {
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
jest.mock('../utils/report.helper', () => ({
  createReportHelper: jest.fn(() => mockReportHelper)
}));

const mockExport = jest.fn();
jest.mock('../service/exporter', () => jest.fn().mockImplementation(() => ({ export: mockExport })));
const mockCompare = jest.fn();
jest.mock('../service/comparator', () => jest.fn().mockImplementation(() => ({ compare: mockCompare })));
const mockMigrate = jest.fn();
jest.mock('../service/migrator', () => jest.fn().mockImplementation(() => ({ migrate: mockMigrate })));
const mockMonitor = jest.fn();
jest.mock('../service/monitor', () => jest.fn().mockImplementation(() => ({ monitor: mockMonitor })));

const Container = require('../service/container');

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

  test('khởi tạo và lấy config', () => {
    const container = new Container(config);
    expect(container.get('baseDir')).toBe('/test/base/dir');
    expect(container.get('dbUtilFn')).toMatchObject({ getDBDestination: config.getDBDestination });
  });

  test('lấy fileManager là singleton', () => {
    const container = new Container(config);
    const fm1 = container.get('fileManager');
    const fm2 = container.get('fileManager');
    expect(fm1).toBe(fm2);
  });

  test('lấy reportHelper đúng', () => {
    const container = new Container(config);
    const rh = container.get('reportHelper');
    expect(rh).toBe(mockReportHelper);
  });

  test('exporter trả về function và gọi đúng', () => {
    const container = new Container(config);
    const exporter = container.get('exporter');
    expect(typeof exporter).toBe('function');
    exporter('TABLES');
    expect(mockExport).toHaveBeenCalledWith('TABLES');
  });

  test('comparator trả về function và gọi đúng', () => {
    const container = new Container(config);
    const comparator = container.get('comparator');
    expect(typeof comparator).toBe('function');
    comparator('TABLES');
    expect(mockCompare).toHaveBeenCalledWith('TABLES');
  });

  test('migrator trả về function và gọi đúng', () => {
    const container = new Container(config);
    const migrator = container.get('migrator');
    expect(typeof migrator).toBe('function');
    migrator('TABLES', 'status');
    expect(mockMigrate).toHaveBeenCalledWith('TABLES', 'status');
  });

  test('monitor trả về function và gọi đúng', () => {
    const container = new Container(config);
    const monitor = container.get('monitor');
    expect(typeof monitor).toBe('function');
    monitor('field');
    expect(mockMonitor).toHaveBeenCalledWith('field');
  });

  test('getServices trả về đủ các service', () => {
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

  test('gọi service không tồn tại sẽ throw', () => {
    const container = new Container(config);
    expect(() => container.get('unknown')).toThrow(/not found/);
  });

  test('không circular dependency khi gọi getServices', () => {
    const container = new Container(config);
    expect(() => container.getServices()).not.toThrow();
  });
}); 