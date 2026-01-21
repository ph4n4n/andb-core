const ExporterService = require('../../src/service/exporter');
const { DDL } = require('../../src/configs/constants');

const mockFileManager = {
  makeSureFolderExisted: jest.fn(),
  emptyDirectory: jest.fn(),
  saveToFile: jest.fn(),
  readFromFile: jest.fn(() => []),
};
const mockAppendReport = jest.fn();
const mockGetDBName = jest.fn(env => 'mockdb');
const mockGetDBDestination = jest.fn(env => ({ envName: env, host: 'h', database: 'd', user: 'u', password: 'p', port: 3306 }));

const mockIntrospection = {
  listTables: jest.fn().mockResolvedValue(['table1']),
  getTableDDL: jest.fn().mockResolvedValue('CREATE TABLE table1...'),
  listViews: jest.fn().mockResolvedValue([]),
};

const mockDriver = {
  config: { database: 'mockdb' },
  getIntrospectionService: jest.fn(() => mockIntrospection),
};

function createExporter() {
  const exporter = new ExporterService({
    fileManager: mockFileManager,
    appendReport: mockAppendReport,
    getDBName: mockGetDBName,
    getDBDestination: mockGetDBDestination,
  });
  return exporter;
}

describe('ExporterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('constructor assigns dependencies', () => {
    const exporter = createExporter();
    expect(exporter.fileManager).toBe(mockFileManager);
    expect(exporter.appendReport).toBe(mockAppendReport);
  });

  test('makeDDLFolderReady calls fileManager functions correctly', () => {
    const exporter = createExporter();
    const path = exporter.makeDDLFolderReady('db/DEV/mockdb', DDL.TABLES);
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/tables');
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/current-ddl');
    expect(mockFileManager.emptyDirectory).toHaveBeenCalledWith('db/DEV/mockdb/tables');
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('db/DEV/mockdb/current-ddl', 'tables.list', '');
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/backup/tables');
    expect(path).toBe('db/DEV/mockdb/tables');
  });

  test('appendDDL calls fileManager correctly', () => {
    const exporter = createExporter();
    mockFileManager.readFromFile.mockReturnValue(['a']);
    exporter.appendDDL('DEV', 'folder', DDL.TABLES, 'b', 'sql');
    expect(mockFileManager.readFromFile).toHaveBeenCalledWith('./db/DEV/mockdb/current-ddl', 'tables.list', 1);
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('./db/DEV/mockdb/current-ddl', 'tables.list', 'a\nb');
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('folder', 'b.sql', 'sql');
  });

  test('_exportDDL handles generic export flow', async () => {
    const exporter = createExporter();
    const dbConfig = { envName: 'DEV', database: 'mockdb' };

    const result = await exporter._exportDDL(mockDriver, dbConfig, DDL.TABLES);

    expect(mockIntrospection.listTables).toHaveBeenCalledWith('mockdb', null);
    expect(mockIntrospection.getTableDDL).toHaveBeenCalledWith('mockdb', 'table1');
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith(expect.any(String), 'table1.sql', 'CREATE TABLE table1...');
    expect(result.count).toBe(1);
    expect(result.data[0].name).toBe('table1');
  });
});