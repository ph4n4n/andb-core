const fs = require('fs');
const path = require('path');
jest.mock('fs');
jest.mock('andb-logger', () => ({ error: jest.fn() }));
const FileManager = require('../core/utils/file.helper');

describe('FileManager', () => {
  const testBaseDir = '/test/base/dir';
  let fileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    fileManager = new FileManager(testBaseDir);
  });

  test('constructor sets baseDir', () => {
    expect(fileManager.baseDir).toBe(testBaseDir);
  });

  test('getInstance returns singleton per baseDir', () => {
    const inst1 = FileManager.getInstance(testBaseDir);
    const inst2 = FileManager.getInstance(testBaseDir);
    expect(inst1).toBe(inst2);
    const inst3 = FileManager.getInstance('/other/dir');
    expect(inst3).not.toBe(inst1);
  });

  test('readFromFile returns file content', () => {
    const folder = 'f'; const file = 'a.txt';
    const content = 'abc';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(content);
    const result = fileManager.readFromFile(folder, file);
    expect(result).toBe(content);
  });

  test('readFromFile returns empty string if not exist', () => {
    fs.existsSync.mockReturnValue(false);
    const result = fileManager.readFromFile('f', 'a.txt');
    expect(result).toBe('');
  });

  test('readFromFile returns array if returnArray', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('a\nb\nc\n');
    const result = fileManager.readFromFile('f', 'a.txt', true);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  test('saveToFile writes file and creates folder if needed', () => {
    fs.existsSync.mockReturnValue(false);
    const mockInstance = { makeSureFolderExisted: jest.fn() };
    jest.spyOn(FileManager, 'getInstance').mockReturnValue(mockInstance);
    fileManager.saveToFile('f', 'a.txt', 'abc');
    expect(FileManager.getInstance).toHaveBeenCalledWith(testBaseDir);
    expect(mockInstance.makeSureFolderExisted).toHaveBeenCalledWith('f');
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(testBaseDir, 'f', 'a.txt'), 'abc');
  });

  test('saveToFile throws if content is not string', () => {
    expect(() => fileManager.saveToFile('f', 'a.txt', 123)).toThrow();
  });

  test('makeSureFolderExisted creates nested folders', () => {
    fs.existsSync.mockReturnValue(false);
    fileManager.makeSureFolderExisted('a/b/c');
    expect(fs.mkdirSync).toHaveBeenCalledTimes(3);
  });

  test('makeSureFolderExisted does not create if exists', () => {
    fs.existsSync.mockReturnValue(true);
    fileManager.makeSureFolderExisted('a');
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  test('emptyDirectory removes all files', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['1.txt', '2.txt']);
    fileManager.emptyDirectory('f');
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
  });

  test('emptyDirectory does nothing if not exist', () => {
    fs.existsSync.mockReturnValue(false);
    expect(() => fileManager.emptyDirectory('f')).not.toThrow();
  });

  test('removeFile calls unlinkSync', () => {
    fileManager.removeFile('f', 'a.txt');
    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  test('copyFile copies content', () => {
    fs.readFileSync.mockReturnValue('abc');
    fileManager.copyFile('/src.txt', '/dst.txt');
    expect(fs.readFileSync).toHaveBeenCalledWith('/src.txt', 'utf8');
    expect(fs.writeFileSync).toHaveBeenCalledWith('/dst.txt', 'abc');
  });

  test('copyFile ignores ENOENT', () => {
    fs.readFileSync.mockImplementation(() => { const e = new Error('x'); e.code = 'ENOENT'; throw e; });
    expect(() => fileManager.copyFile('/src.txt', '/dst.txt')).not.toThrow();
  });
}); 