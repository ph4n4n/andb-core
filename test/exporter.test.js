const ExporterService = require('../service/exporter');

const mockFileManager = {
  makeSureFolderExisted: jest.fn(),
  emptyDirectory: jest.fn(),
  saveToFile: jest.fn(),
  readFromFile: jest.fn(() => []),
};
const mockAppendReport = jest.fn();
const mockGetDBName = jest.fn(env => 'mockdb');
const mockGetDBDestination = jest.fn(env => ({ envName: env, host: 'h', database: 'd', user: 'u', password: 'p', port: 3306 }));

function createExporter() {
  const exporter = new ExporterService({
    fileManager: mockFileManager,
    appendReport: mockAppendReport,
    getDBName: mockGetDBName,
    getDBDestination: mockGetDBDestination,
  });
  // Override methods that are not in dependencies
  exporter.getDBName = mockGetDBName;
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

  test('makeDDLFolderReady gọi đúng các hàm fileManager', () => {
    const exporter = createExporter();
    const path = exporter.makeDDLFolderReady('db/DEV/mockdb', 'TABLES');
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/TABLES');
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/current-ddl');
    expect(mockFileManager.emptyDirectory).toHaveBeenCalledWith('db/DEV/mockdb/TABLES');
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('db/DEV/mockdb/current-ddl', 'TABLES.list', '');
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalledWith('db/DEV/mockdb/backup/TABLES');
    expect(path).toBe('db/DEV/mockdb/TABLES');
  });

  test('appendDDL gọi đúng fileManager', () => {
    const exporter = createExporter();
    mockFileManager.readFromFile.mockReturnValue(['a']);
    exporter.appendDDL('DEV', 'folder', 'TABLES', 'b', 'sql');
    expect(mockFileManager.readFromFile).toHaveBeenCalledWith('./db/DEV/mockdb/current-ddl', 'TABLES.list', 1);
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('./db/DEV/mockdb/current-ddl', 'TABLES.list', 'a\nb');
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('folder', 'b.sql', 'sql');
  });

  test('export trả về function', () => {
    const exporter = createExporter();
    const fn = exporter.export('TABLES');
    expect(typeof fn).toBe('function');
  });
}); 