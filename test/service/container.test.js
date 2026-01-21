const Container = require('../../src/service/container');

const mockFileManagerInstance = {
  readFromFile: jest.fn(),
  saveToFile: jest.fn(),
  makeSureFolderExisted: jest.fn(),
  emptyDirectory: jest.fn(),
  copyFile: jest.fn(),
  removeFile: jest.fn()
};

jest.mock('../../src/utils/file.helper', () => ({
  getInstance: jest.fn(() => mockFileManagerInstance)
}));

const mockReportHelper = {
  appendReport: jest.fn(),
  report2console: jest.fn(),
  report2html: jest.fn(),
  vimDiffToHtml: jest.fn()
};
jest.mock('../../src/utils/report.helper', () => ({
  createReportHelper: jest.fn(() => mockReportHelper)
}));

// Mock services to avoid actual instantiation errors if they require complex setups
jest.mock('../../src/service/exporter', () => jest.fn().mockImplementation(() => ({ export: jest.fn() })));
jest.mock('../../src/service/comparator', () => jest.fn().mockImplementation(() => ({ compare: jest.fn() })));
jest.mock('../../src/service/migrator', () => jest.fn().mockImplementation(() => ({ migrate: jest.fn() })));
jest.mock('../../src/service/monitor', () => jest.fn().mockImplementation(() => ({ monitor: jest.fn() })));
jest.mock('../../src/service/connection.factory', () => jest.fn().mockImplementation(() => ({ getConnection: jest.fn() })));

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
      baseDir: '/test/base/dir',
      storage: 'file'
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

  test('exporter returns wrapped function', () => {
    const container = new Container(config);
    const exporter = container.get('exporter');
    expect(typeof exporter).toBe('function');
  });

  test('driver returns an async function factory', () => {
    const container = new Container(config);
    const driverFactory = container.get('driver');
    expect(typeof driverFactory).toBe('function');
  });

  test('getServices returns all major services', () => {
    const container = new Container(config);
    const services = container.getServices();
    expect(services).toHaveProperty('exporter');
    expect(services).toHaveProperty('comparator');
    expect(services).toHaveProperty('migrator');
    expect(services).toHaveProperty('monitor');
    expect(services).toHaveProperty('reportHelper');
  });
});