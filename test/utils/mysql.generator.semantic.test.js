const MySQLDDLGenerator = require('../../src/drivers/mysql/MySQLGenerator');

describe('MySQLDDLGenerator Semantic Comparison', () => {
  let generator;

  beforeEach(() => {
    generator = new MySQLDDLGenerator();
  });

  test('compareColumns: should ignore integer display width differences', () => {
    const srcTable = {
      tableName: 't1',
      columns: {
        'id': '`id` INT(11) NOT NULL'
      }
    };
    const destTable = {
      tableName: 't1',
      columns: {
        'id': '`id` INT(10) NOT NULL'
      }
    };

    const result = generator.generateTableAlter(srcTable, destTable);
    expect(result.columns).toBeNull();
  });

  test('compareColumns: should detect real changes', () => {
    const srcTable = {
      tableName: 't1',
      columns: {
        'id': '`id` BIGINT NOT NULL'
      }
    };
    const destTable = {
      tableName: 't1',
      columns: {
        'id': '`id` INT NOT NULL'
      }
    };

    const result = generator.generateTableAlter(srcTable, destTable);
    expect(result.columns).not.toBeNull();
    expect(result.columns).toContain('MODIFY COLUMN `id` BIGINT NOT NULL');
  });

  test('compareIndexes: should ignore whitespace and casing in index definitions', () => {
    const srcTable = {
      tableName: 't1',
      indexes: {
        'idx_name': 'KEY `idx_name` (`name`)'
      }
    };
    const destTable = {
      tableName: 't1',
      indexes: {
        'idx_name': '  key `idx_name`  (`name`) '
      }
    };

    const result = generator.generateTableAlter(srcTable, destTable);
    expect(result.indexes).toBeNull();
  });
});
