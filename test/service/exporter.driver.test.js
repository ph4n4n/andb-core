const ExporterService = require('../../src/service/exporter');
const { DDL: { TABLES, TRIGGERS, FUNCTIONS } } = require('../../src/configs/constants');

// Mock dependencies
const mockFileManager = {
  makeSureFolderExisted: jest.fn(),
  emptyDirectory: jest.fn(),
  saveToFile: jest.fn(),
  readFromFile: jest.fn(() => []),
};
const mockAppendReport = jest.fn();
const mockGetDBName = jest.fn(env => 'mockdb');
const mockGetDBDestination = jest.fn(env => ({ envName: env, host: 'h', database: 'd', user: 'u', password: 'p', port: 3306 }));

// Mock Introspection Service
const mockIntrospection = {
  listTables: jest.fn(),
  getTableDDL: jest.fn(),
  listTriggers: jest.fn(),
  getTriggerDDL: jest.fn(),
  listFunctions: jest.fn(),
  getFunctionDDL: jest.fn(),
  listProcedures: jest.fn(),
  getProcedureDDL: jest.fn(),
  listViews: jest.fn(),
  getViewDDL: jest.fn(),
  listEvents: jest.fn(),
  getEventDDL: jest.fn(),
};

// Mock Driver
const mockDriver = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  query: jest.fn().mockResolvedValue([]),
  getIntrospectionService: jest.fn(() => mockIntrospection),
  getDDLParser: jest.fn(() => ({
    normalize: jest.fn(ddl => ddl)
  }))
};

// Driver Factory Mock
const mockDriverFactory = jest.fn(async (config) => {
  await mockDriver.connect();
  return mockDriver;
});

function createExporter() {
  const exporter = new ExporterService({
    fileManager: mockFileManager,
    appendReport: mockAppendReport,
    getDBName: mockGetDBName,
    getDBDestination: mockGetDBDestination,
    driver: mockDriverFactory // Inject the factory
  });
  return exporter;
}

describe('ExporterService with Driver Abstraction', () => {
  let exporter;

  beforeEach(() => {
    jest.clearAllMocks();
    exporter = createExporter();
  });

  test('should use driver and introspection for TABLES export', async () => {
    // Setup
    mockIntrospection.listTables.mockResolvedValue(['user']);
    mockIntrospection.getTableDDL.mockResolvedValue('CREATE TABLE user ...');

    // Execute
    const exportFn = exporter.export(TABLES);
    const result = await exportFn('DEV');

    // Verify
    expect(mockDriverFactory).toHaveBeenCalled();
    expect(mockDriver.connect).toHaveBeenCalled();
    expect(mockDriver.getIntrospectionService).toHaveBeenCalled();
    expect(mockIntrospection.listTables).toHaveBeenCalledWith('d', null);
    expect(mockIntrospection.getTableDDL).toHaveBeenCalledWith('d', 'user');
    expect(mockDriver.disconnect).toHaveBeenCalled();

    // Verify Result
    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe('user');
    expect(result.data[0].ddl).toBe('CREATE TABLE user ...');
  });

  test('should use driver and introspection for TRIGGERS export', async () => {
    // Setup
    mockIntrospection.listTriggers.mockResolvedValue(['trg_user_insert']);
    mockIntrospection.getTriggerDDL.mockResolvedValue('CREATE TRIGGER trg_user_insert ...');

    // Execute
    const exportFn = exporter.export(TRIGGERS);
    const result = await exportFn('DEV');

    // Verify
    expect(mockIntrospection.listTriggers).toHaveBeenCalledWith('d', null);
    expect(mockIntrospection.getTriggerDDL).toHaveBeenCalledWith('d', 'trg_user_insert');

    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe('trg_user_insert');
  });

  test('should use driver and introspection for FUNCTIONS export', async () => {
    // Setup
    mockIntrospection.listFunctions.mockResolvedValue(['fn_calc']);
    mockIntrospection.getFunctionDDL.mockResolvedValue('CREATE FUNCTION fn_calc ...');

    // Execute
    const exportFn = exporter.export(FUNCTIONS);
    const result = await exportFn('DEV');

    // Verify
    expect(mockIntrospection.listFunctions).toHaveBeenCalledWith('d', null);
    expect(mockIntrospection.getFunctionDDL).toHaveBeenCalledWith('d', 'fn_calc');

    expect(result.count).toBe(1);
  });
});
