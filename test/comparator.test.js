// Mock alog globally
global.alog = { error: jest.fn(), warning: jest.fn(), info: jest.fn(), dev: jest.fn() };
const ComparatorService = require('../service/comparator');

const mockFileManager = {
  makeSureFolderExisted: jest.fn(),
  readFromFile: jest.fn(() => ''),
  saveToFile: jest.fn(),
  emptyDirectory: jest.fn(),
};
const mockAppendReport = jest.fn();
const mockReport2Html = jest.fn();
const mockReport2Console = jest.fn();
const mockVimDiffToHtml = jest.fn();
const mockGetSourceEnv = jest.fn(env => 'DEV');
const mockGetDBName = jest.fn(env => 'mockdb');

function createComparator() {
  const comparator = new ComparatorService({
    fileManager: mockFileManager,
    appendReport: mockAppendReport,
    report2html: mockReport2Html,
    report2console: mockReport2Console,
    vimDiffToHtml: mockVimDiffToHtml,
    getSourceEnv: mockGetSourceEnv,
    getDBName: mockGetDBName,
  });
  // Override methods that are not in dependencies
  comparator.getSourceEnv = mockGetSourceEnv;
  comparator.getDBName = mockGetDBName;
  // Mock alog
  comparator.alog = { error: jest.fn(), warning: jest.fn(), info: jest.fn(), dev: jest.fn() };
  return comparator;
}

describe('ComparatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('constructor assigns dependencies', () => {
    const comparator = createComparator();
    expect(comparator.fileManager).toBe(mockFileManager);
    expect(comparator.appendReport).toBe(mockAppendReport);
  });

  test('parseTableDefinition parses table SQL correctly', () => {
    const comparator = createComparator();
    const tableSQL = `
      CREATE TABLE \`test_table\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    const result = comparator.parseTableDefinition(tableSQL);
    
    expect(result.tableName).toBe('test_table');
    expect(result.columns.id).toContain('int(11)');
    expect(result.columns.name).toContain('varchar(255)');
    expect(result.primaryKey).toContain('id');
    expect(result.indexes.idx_name).toContain('KEY');
  });

  test('parseTriggerDefinition parses trigger SQL correctly', () => {
    const comparator = createComparator();
    const triggerSQL = `CREATE TRIGGER \`test_trigger\` BEFORE INSERT ON \`test_table\` FOR EACH ROW BEGIN SET NEW.created_at = NOW(); END;`;
    
    const result = comparator.parseTriggerDefinition(triggerSQL);
    
    expect(result.triggerName).toBe('test_trigger');
    expect(result.timing).toBe('BEFORE');
    expect(result.event).toBe('INSERT');
    expect(result.tableName).toBe('test_table');
  });

  test('generateAlter generates correct ALTER SQL', () => {
    const comparator = createComparator();
    const tableName = 'test_table';
    const alters = ['ADD COLUMN name varchar(255)', 'DROP COLUMN old_column'];
    
    const result = comparator.generateAlter(tableName, alters);
    
    expect(result).toContain('ALTER TABLE `test_table`');
    expect(result).toContain('ADD COLUMN name varchar(255)');
    expect(result).toContain('DROP COLUMN old_column');
  });

  test('compare trả về function', () => {
    const comparator = createComparator();
    const fn = comparator.compare('TABLES');
    expect(typeof fn).toBe('function');
  });

  test('compareColumns compares table columns correctly', () => {
    const comparator = createComparator();
    const srcTable = {
      tableName: 'test',
      columns: {
        id: '`id` int(11) NOT NULL',
        name: '`name` varchar(255) NOT NULL',
        email: '`email` varchar(255) NOT NULL'
      }
    };
    const destTable = {
      tableName: 'test',
      columns: {
        id: '`id` int(11) NOT NULL',
        name: '`name` varchar(255) NOT NULL'
      }
    };
    
    const result = comparator.compareColumns(srcTable, destTable);
    
    expect(result.alterColumns.length).toBeGreaterThan(0);
  });

  test('compareIndexes compares table indexes correctly', () => {
    const comparator = createComparator();
    const srcTable = {
      indexes: {
        idx_name: 'KEY `idx_name` (`name`) USING BTREE',
        idx_email: 'KEY `idx_email` (`email`) USING BTREE'
      }
    };
    const destTable = {
      indexes: {
        idx_name: 'KEY `idx_name` (`name`) USING BTREE'
      }
    };
    
    const result = comparator.compareIndexes(srcTable, destTable);
    
    expect(result.length).toBeGreaterThan(0);
  });
}); 