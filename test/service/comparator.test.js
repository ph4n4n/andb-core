// Mock logger globally
global.logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), dev: jest.fn() };

const ComparatorService = require('../../src/service/comparator');
const { DDL } = require('../../src/configs/constants');

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

const mockParser = {
  parseTable: jest.fn(content => ({ tableName: 'test' })),
  parseTrigger: jest.fn(content => ({ triggerName: 'test_trigger' })),
  normalize: jest.fn(content => content),
};

const mockGenerator = {
  generateTableAlter: jest.fn(() => ({ columns: 'ALTER...', indexes: null })),
};

const mockDriver = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  getDDLParser: jest.fn(() => mockParser),
  getDDLGenerator: jest.fn(() => mockGenerator),
};

function createComparator() {
  const comparator = new ComparatorService({
    fileManager: mockFileManager,
    appendReport: mockAppendReport,
    report2html: mockReport2Html,
    report2console: mockReport2Console,
    vimDiffToHtml: mockVimDiffToHtml,
    getSourceEnv: mockGetSourceEnv,
    getDBName: mockGetDBName,
    getDBDestination: jest.fn(env => ({ database: 'mock' })),
    driver: jest.fn(async () => {
      await mockDriver.connect();
      return mockDriver;
    }),
  });
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

  test('compareTriggers detects differences', () => {
    const comparator = createComparator();
    const srcTrigger = { timing: 'BEFORE', event: 'INSERT', tableName: 't1', definition: 'D1' };
    const destTrigger = { timing: 'AFTER', event: 'INSERT', tableName: 't1', definition: 'D1' };

    const result = comparator.compareTriggers(srcTrigger, destTrigger);

    expect(result.hasChanges).toBe(true);
    expect(result.differences[0]).toContain('Timing changed');
  });

  test('checkDiffAndGenAlter uses parser and generator', async () => {
    const comparator = createComparator();
    mockFileManager.readFromFile.mockReturnValue('CREATE TABLE...'); // for both src and dest

    const result = await comparator.checkDiffAndGenAlter('test_table', 'UAT');

    expect(mockParser.parseTable).toHaveBeenCalledTimes(2);
    expect(mockGenerator.generateTableAlter).toHaveBeenCalled();
    expect(result.columns).toBe('ALTER...');
  });

  test('markNewDDL identifies new items', async () => {
    const comparator = createComparator();
    const srcLines = ['item1', 'item2'];
    const destLines = ['item1'];

    const result = await comparator.markNewDDL('folder', srcLines, destLines, DDL.TABLES, 'DEV', 'UAT');

    expect(result[`${DDL.TABLES}_new`]).toBe(1);
    expect(mockFileManager.saveToFile).toHaveBeenCalledWith('folder', 'new.list', 'item2');
  });

  test('compare returns function', () => {
    const comparator = createComparator();
    const fn = comparator.compare(DDL.TABLES);
    expect(typeof fn).toBe('function');
  });
});