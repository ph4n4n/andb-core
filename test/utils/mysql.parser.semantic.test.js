const MySQLParser = require('../../src/drivers/mysql/MySQLParser');

describe('MySQLParser Semantic Normalization', () => {
  let parser;

  beforeEach(() => {
    parser = new MySQLParser();
  });

  test('should normalize integer display widths', () => {
    const ddl1 = 'CREATE TABLE t1 (id INT(11), age TINYINT(3));';
    const ddl2 = 'CREATE TABLE t1 (id INT, age TINYINT);';

    expect(parser.normalize(ddl1)).toBe(parser.normalize(ddl2));
  });

  test('should strip MySQL version comments', () => {
    const ddl1 = '/*!50003 CREATE */ /*!50017 TRIGGER */ `test`';
    const ddl2 = 'CREATE TRIGGER `test`';

    expect(parser.normalize(ddl1)).toBe(parser.normalize(ddl2));
  });

  test('should handle different CHARACTER SET and CHARSET syntax', () => {
    const ddl1 = 'VARCHAR(50) CHARACTER SET utf8mb4';
    const ddl2 = 'VARCHAR(50) CHARSET=utf8mb4';

    expect(parser.normalize(ddl1)).toBe(parser.normalize(ddl2));
  });

  test('should collapse multiple spaces', () => {
    const ddl1 = 'CREATE   TABLE    `test`   (id INT)';
    const ddl2 = 'CREATE TABLE `test` (id INT)';

    expect(parser.normalize(ddl1)).toBe(parser.normalize(ddl2));
  });

  test('should be case insensitive for keywords after normalization', () => {
    const ddl1 = 'create table `test` (id int)';
    const ddl2 = 'CREATE TABLE `test` (id INT)';

    expect(parser.normalize(ddl1)).toBe(parser.normalize(ddl2));
  });
});
