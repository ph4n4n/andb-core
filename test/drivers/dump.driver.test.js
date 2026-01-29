/**
 * DumpDriver Parser Tests
 * Tests for _parseDump(), _processStatement(), _extractName() methods
 *
 * Test Priority: Unit test > Vite test > E2E
 */

const DumpDriver = require('../../src/drivers/mysql/DumpDriver');
const { TABLES, VIEWS, PROCEDURES, FUNCTIONS, TRIGGERS, EVENTS } = require('../../src/configs/constants').DDL;

// Mock logger to avoid console noise
global.logger = {
  info: () => { },
  warn: () => { },
  error: () => { },
};

describe('DumpDriver Parser', () => {
  let driver;

  beforeEach(() => {
    driver = new DumpDriver({ dumpPath: '/fake/path.sql' });
    // Initialize data structure manually since we won't call connect()
    driver.data = {
      [TABLES]: new Map(),
      [VIEWS]: new Map(),
      [PROCEDURES]: new Map(),
      [FUNCTIONS]: new Map(),
      [TRIGGERS]: new Map(),
      [EVENTS]: new Map(),
    };
  });

  describe('_extractName()', () => {
    // _extractName is designed to clean up a raw name captured from regex,
    // NOT to parse full SQL statements. It removes quotes and extracts
    // the final name from qualified names like `db`.`table`.
    const testCases = [
      {
        name: 'simple unquoted name',
        rawName: 'users',
        expected: 'users',
      },
      {
        name: 'backtick quoted name',
        rawName: '`user-profile`',
        expected: 'user-profile',
      },
      {
        name: 'qualified name (db.table)',
        rawName: '`mydb`.`users`',
        expected: 'users',
      },
      {
        name: 'simple backtick quoted',
        rawName: '`orders`',
        expected: 'orders',
      },
      {
        name: 'procedure name with backticks',
        rawName: '`sp_get_user`',
        expected: 'sp_get_user',
      },
      {
        name: 'view name with backticks',
        rawName: '`v_active_users`',
        expected: 'v_active_users',
      },
      {
        name: 'function name with backticks',
        rawName: '`fn_calc`',
        expected: 'fn_calc',
      },
      {
        name: 'trigger name with backticks',
        rawName: '`tr_before_insert`',
        expected: 'tr_before_insert',
      },
      {
        name: 'double-quoted name',
        rawName: '"my_table"',
        expected: 'my_table',
      },
      {
        name: 'null input',
        rawName: null,
        expected: null,
      },
    ];

    testCases.forEach(({ name, rawName, expected }) => {
      test(name, () => {
        const result = driver._extractName(rawName);
        expect(result).toBe(expected);
      });
    });
  });

  describe('_processStatement()', () => {
    test('parses CREATE TABLE correctly', () => {
      driver._processStatement('CREATE TABLE `users` (id INT PRIMARY KEY)');
      expect(driver.data[TABLES].has('users')).toBe(true);
      expect(driver.data[TABLES].get('users')).toContain('CREATE TABLE');
    });

    test('parses CREATE VIEW correctly', () => {
      driver._processStatement('CREATE VIEW `v_users` AS SELECT * FROM users');
      expect(driver.data[VIEWS].has('v_users')).toBe(true);
    });

    test('parses CREATE PROCEDURE with DEFINER', () => {
      driver._processStatement(
        'CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_test`() BEGIN SELECT 1; END'
      );
      expect(driver.data[PROCEDURES].has('sp_test')).toBe(true);
    });

    test('parses CREATE FUNCTION with SQL SECURITY', () => {
      driver._processStatement(
        'CREATE DEFINER=`root`@`localhost` FUNCTION `fn_add`(a INT) RETURNS INT SQL SECURITY INVOKER RETURN a + 1'
      );
      expect(driver.data[FUNCTIONS].has('fn_add')).toBe(true);
    });

    test('parses CREATE TRIGGER', () => {
      driver._processStatement(
        'CREATE TRIGGER `tr_audit` AFTER INSERT ON users FOR EACH ROW INSERT INTO audit_log (action) VALUES ("insert")'
      );
      expect(driver.data[TRIGGERS].has('tr_audit')).toBe(true);
    });

    test('skips non-CREATE statements', () => {
      driver._processStatement('INSERT INTO users VALUES (1, "test")');
      driver._processStatement('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
      driver._processStatement('DROP TABLE IF EXISTS temp');

      // All maps should be empty
      expect(driver.data[TABLES].size).toBe(0);
      expect(driver.data[PROCEDURES].size).toBe(0);
    });
  });

  describe('_parseDump()', () => {
    test('parses simple dump with semicolon delimiter', () => {
      const content = `
CREATE TABLE \`users\` (id INT PRIMARY KEY);
CREATE TABLE \`orders\` (id INT, user_id INT);
      `;
      driver._parseDump(content);

      expect(driver.data[TABLES].size).toBe(2);
      expect(driver.data[TABLES].has('users')).toBe(true);
      expect(driver.data[TABLES].has('orders')).toBe(true);
    });

    test('handles DELIMITER for stored procedures', () => {
      const content = `
DELIMITER ;;
CREATE PROCEDURE \`sp_get_users\`()
BEGIN
  SELECT * FROM users;
END;;
DELIMITER ;
      `;
      driver._parseDump(content);

      expect(driver.data[PROCEDURES].has('sp_get_users')).toBe(true);
    });

    test('handles multiple DELIMITER changes', () => {
      const content = `
DELIMITER //
CREATE PROCEDURE \`sp_one\`()
BEGIN
  SELECT 1;
END//

CREATE PROCEDURE \`sp_two\`()
BEGIN
  SELECT 2;
END//
DELIMITER ;

CREATE TABLE \`simple\` (id INT);
      `;
      driver._parseDump(content);

      expect(driver.data[PROCEDURES].has('sp_one')).toBe(true);
      expect(driver.data[PROCEDURES].has('sp_two')).toBe(true);
      expect(driver.data[TABLES].has('simple')).toBe(true);
    });

    test('handles BEGIN...END without DELIMITER (fallback)', () => {
      const content = `
CREATE PROCEDURE \`sp_inline\`()
BEGIN
  SELECT 'inline';
END;
      `;
      driver._parseDump(content);

      expect(driver.data[PROCEDURES].has('sp_inline')).toBe(true);
    });

    test('ignores SQL comments', () => {
      const content = `
-- This is a comment
# This is also a comment
/* Multi-line
   comment */
CREATE TABLE \`test\` (id INT);
      `;
      driver._parseDump(content);

      expect(driver.data[TABLES].has('test')).toBe(true);
    });

    test('parses views with OR REPLACE and ALGORITHM', () => {
      const content = `
CREATE OR REPLACE ALGORITHM=UNDEFINED DEFINER=\`root\`@\`localhost\` SQL SECURITY DEFINER VIEW \`v_active\` AS SELECT * FROM users WHERE active = 1;
      `;
      driver._parseDump(content);

      expect(driver.data[VIEWS].has('v_active')).toBe(true);
    });

    test('handles complex trigger with DELIMITER', () => {
      const content = `
DELIMITER $$
CREATE TRIGGER \`tr_log\` AFTER UPDATE ON \`users\`
FOR EACH ROW
BEGIN
  IF OLD.email <> NEW.email THEN
    INSERT INTO email_log (user_id, old_email, new_email) VALUES (NEW.id, OLD.email, NEW.email);
  END IF;
END$$
DELIMITER ;
      `;
      driver._parseDump(content);

      expect(driver.data[TRIGGERS].has('tr_log')).toBe(true);
    });

    test('handles UTF-8 special chars in names', () => {
      const content = `
CREATE TABLE \`bảng_người_dùng\` (id INT);
CREATE PROCEDURE \`thủ_tục_kiểm_tra\`() BEGIN SELECT 1; END;
      `;
      driver._parseDump(content);

      expect(driver.data[TABLES].has('bảng_người_dùng')).toBe(true);
      expect(driver.data[PROCEDURES].has('thủ_tục_kiểm_tra')).toBe(true);
    });

    test('handles nested IF in procedure without crash', () => {
      const content = `
DELIMITER //
CREATE PROCEDURE \`sp_complex\`(IN mode INT)
BEGIN
  IF mode = 1 THEN
    SELECT 'mode 1';
  ELSEIF mode = 2 THEN
    BEGIN
      SELECT 'nested begin';
    END;
  ELSE
    SELECT 'default';
  END IF;
END//
DELIMITER ;
      `;
      driver._parseDump(content);

      expect(driver.data[PROCEDURES].has('sp_complex')).toBe(true);
    });
  });
});
