// Mock logger globally
global.logger = {
  error: jest.fn(),
  warn: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  dev: jest.fn(),
  success: jest.fn()
};

const MigratorService = require('../../src/service/migrator');
const { DDL } = require('../../src/configs/constants');

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

const mockIntrospection = {
  getTableDDL: jest.fn(),
  getProcedureDDL: jest.fn(),
  getFunctionDDL: jest.fn(),
  listTables: jest.fn(),
};

const mockGenerator = {
  dropTable: jest.fn(name => `DROP TABLE IF EXISTS \`${name}\``),
  dropProcedure: jest.fn(name => `DROP PROCEDURE IF EXISTS \`${name}\``),
  dropFunction: jest.fn(name => `DROP FUNCTION IF EXISTS \`${name}\``),
  drop: jest.fn((type, name) => {
    const cleanType = type.toLowerCase().replace(/s$/, '');
    const methodName = `drop${cleanType.charAt(0).toUpperCase()}${cleanType.slice(1)}`;
    return mockGenerator[methodName](name);
  })
};

const mockDriver = {
  config: { database: 'mockdb' },
  query: jest.fn().mockResolvedValue([]),
  disconnect: jest.fn().mockResolvedValue(),
  getIntrospectionService: jest.fn(() => mockIntrospection),
  getDDLGenerator: jest.fn(() => mockGenerator),
};

function createMigrator() {
  const migrator = new MigratorService({
    fileManager: mockFileManager,
    getSourceEnv: mockGetSourceEnv,
    getDBName: mockGetDBName,
    getDBDestination: mockGetDBDestination,
    replaceWithEnv: mockReplaceWithEnv,
    driver: jest.fn().mockResolvedValue(mockDriver),
  });
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
    const fn = migrator.migrate(DDL.FUNCTIONS, 'NEW');
    expect(typeof fn).toBe('function');
  });

  test('migrateFunctions calls generic migration correctly', async () => {
    const migrator = createMigrator();
    // Setup for readComparisonList
    mockFileManager.readFromFile.mockReturnValueOnce(['func1']);
    // Setup for readDDL
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE FUNCTION func1...');

    const dbConfig = { envName: 'UAT' };
    const result = await migrator.migrateFunctions(mockDriver, dbConfig, 'NEW');

    expect(mockDriver.query).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS `func1`');
    expect(mockDriver.query).toHaveBeenCalledWith('CREATE FUNCTION func1...');
    expect(result).toBe(1);
  });

  test('migrateProcedures calls generic migration correctly', async () => {
    const migrator = createMigrator();
    mockFileManager.readFromFile.mockReturnValueOnce(['proc1']);
    mockFileManager.readFromFile.mockReturnValueOnce('CREATE PROCEDURE proc1...');

    const dbConfig = { envName: 'UAT' };
    const result = await migrator.migrateProcedures(mockDriver, dbConfig, 'NEW');

    expect(mockDriver.query).toHaveBeenCalledWith('DROP PROCEDURE IF EXISTS `proc1`');
    expect(mockDriver.query).toHaveBeenCalledWith('CREATE PROCEDURE proc1...');
    expect(result).toBe(1);
  });

  test('deprecateFunctions calls generic deprecation correctly', async () => {
    const migrator = createMigrator();
    mockFileManager.readFromFile.mockReturnValueOnce(['old_func']);

    const dbConfig = { envName: 'UAT' };
    const result = await migrator.deprecateFunctions(mockDriver, dbConfig, 'deprecated.list');

    expect(mockDriver.query).toHaveBeenCalledWith('DROP FUNCTION IF EXISTS `old_func`');
    expect(mockFileManager.removeFile).toHaveBeenCalledWith('db/UAT/mockdb/functions', 'old_func.sql');
    expect(result).toBe(1);
  });
});