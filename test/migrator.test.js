// Mock alog globally
global.logger = { error: jest.fn(), warning: jest.fn(), info: jest.fn(), dev: jest.fn() };
const MigratorService = require('../core/service/migrator');

const mockFileManager = {
  makeSureFolderExisted: jest.fn(),
  readFromFile: jest.fn(() => []),
  saveToFile: jest.fn(),
  copyFile: jest.fn(),
  removeFile: jest.fn(),
};
const mockGetSourceEnv = jest.fn(env => 'DEV');
const mockGetDBName = jest.fn(env => 'mockdb');
const mockGetDBDestination = jest.fn(env => ({ envName: env, host: 'h', database: 'd', user: 'u', password: 'p', port: 3306 }));
const mockReplaceWithEnv = jest.fn((sql, env) => sql);

function createMigrator() {
  const migrator = new MigratorService({
    fileManager: mockFileManager,
    getSourceEnv: mockGetSourceEnv,
    getDBName: mockGetDBName,
    getDBDestination: mockGetDBDestination,
    replaceWithEnv: mockReplaceWithEnv,
  });
  // Override methods that are not in dependencies
  migrator.getSourceEnv = mockGetSourceEnv;
  migrator.getDBName = mockGetDBName;
  migrator.getDBDestination = mockGetDBDestination;
  migrator.replaceWithEnv = mockReplaceWithEnv;
  // Mock alog
  migrator.alog = { error: jest.fn(), warning: jest.fn(), info: jest.fn(), dev: jest.fn() };
  return migrator;
}

describe('MigratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('constructor assigns dependencies', () => {
    const migrator = createMigrator();
    expect(migrator.fileManager).toBe(mockFileManager);
    expect(migrator.getSourceEnv).toBe(mockGetSourceEnv);
  });

  test('isNotMigrateCondition returns true for test functions', () => {
    const migrator = createMigrator();
    expect(migrator.isNotMigrateCondition('test_function')).toBe(true);
    expect(migrator.isNotMigrateCondition('OTE_function')).toBe(true);
    expect(migrator.isNotMigrateCondition('normal_function')).toBe(false);
  });

  test('migrate returns function', () => {
    const migrator = createMigrator();
    const fn = migrator.migrate('FUNCTIONS', 'NEW');
    expect(typeof fn).toBe('function');
  });

  test('migrateFunctions calls fileManager correctly', async () => {
    const migrator = createMigrator();
    mockFileManager.readFromFile.mockReturnValue(['func1', 'func2']);
    mockFileManager.readFromFile.mockReturnValueOnce('DROP FUNCTION IF EXISTS `func1`;');
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE FUNCTION func1() RETURNS INT BEGIN RETURN 1; END;');
    mockFileManager.readFromFile.mockReturnValueOnce('DROP FUNCTION IF EXISTS `func2`;');
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE FUNCTION func2() RETURNS INT BEGIN RETURN 2; END;');
    
    const mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn().mockImplementation((sql, cb) => cb(null, [])),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    const dbConfig = { envName: 'UAT' };
    
    const result = await migrator.migrateFunctions(mockConnection, dbConfig, 'NEW');
    
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalled();
    expect(mockFileManager.readFromFile).toHaveBeenCalledWith(
      'map-migrate/DEV-to-UAT/mockdb/functions', 
      'NEW.list', 
      1
    );
    expect(result).toBeGreaterThan(0);
  }, 10000);

  test('migrateProcedures call fileManager correctly', async () => {
    const migrator = createMigrator();
    mockFileManager.readFromFile.mockReturnValue(['proc1']);
    mockFileManager.readFromFile.mockReturnValueOnce('DROP PROCEDURE IF EXISTS `proc1`;');
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE PROCEDURE proc1() BEGIN SELECT 1; END;');
    mockFileManager.readFromFile.mockReturnValueOnce('DROP PROCEDURE IF EXISTS `proc1`;');
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE PROCEDURE proc1() BEGIN SELECT 1; END;');
    
    const mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn().mockImplementation((sql, cb) => cb(null, [])),
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    const dbConfig = { envName: 'UAT' };
    
    const result = await migrator.migrateProcedures(mockConnection, dbConfig, 'NEW');
    
    expect(mockFileManager.makeSureFolderExisted).toHaveBeenCalled();
    expect(mockFileManager.readFromFile).toHaveBeenCalledWith(
      'map-migrate/DEV-to-UAT/mockdb/procedures', 
      'NEW.list', 
      1
    );
    expect(result).toBeGreaterThan(0);
  }, 10000);
}); 