const ComparisonRepository = require('../../../src/storage/repositories/comparison.repository');
const { createTestDb } = require('../../test-utils');

describe('ComparisonRepository', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = createTestDb();
    if (db) repository = new ComparisonRepository(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('should save a comparison entry (camelCase input)', async () => {
    if (!db) return;
    const data = {
      srcEnv: 'DEV',
      destEnv: 'STAGE',
      database: 'test_db',
      type: 'TABLES',
      name: 'users',
      status: 'modified',
      diffSummary: 'Column added',
      alterStatements: ['ALTER TABLE users ADD COLUMN name TEXT']
    };

    const result = await repository.save(data);
    expect(result).toBe(true);

    const found = await repository.find('DEV', 'STAGE', 'test_db', 'TABLES');
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('users');
    expect(found[0].status).toBe('modified');
    expect(found[0].diffSummary).toBe('Column added');
    expect(found[0].alterStatements).toEqual(data.alterStatements);
  });

  test('should save a comparison entry (snake_case input)', async () => {
    if (!db) return;
    const data = {
      src_environment: 'DEV',
      dest_environment: 'STAGE',
      database_name: 'test_db',
      ddl_type: 'TABLES',
      ddl_name: 'orders',
      status: 'new',
      diff_summary: 'Brand new table',
      alter_statements: '["CREATE TABLE orders"]'
    };

    await repository.save(data);

    const found = await repository.find('DEV', 'STAGE', 'test_db', 'TABLES');
    expect(found[0].name).toBe('orders');
    expect(found[0].status).toBe('new');
  });

  test('should update existing entry on conflict', async () => {
    if (!db) return;
    const data = {
      srcEnv: 'DEV',
      destEnv: 'STAGE',
      database: 'test_db',
      type: 'TABLES',
      name: 'users',
      status: 'new'
    };
    await repository.save(data);

    const updatedData = { ...data, status: 'modified', diffSummary: 'Update' };
    await repository.save(updatedData);

    const found = await repository.find('DEV', 'STAGE', 'test_db', 'TABLES');
    expect(found).toHaveLength(1);
    expect(found[0].status).toBe('modified');
    expect(found[0].diffSummary).toBe('Update');
  });

  test('should filter by status', async () => {
    if (!db) return;
    await repository.save({ srcEnv: 'A', destEnv: 'B', database: 'DB', type: 'T', name: 'n1', status: 'new' });
    await repository.save({ srcEnv: 'A', destEnv: 'B', database: 'DB', type: 'T', name: 'n2', status: 'modified' });

    const news = await repository.findByStatus('A', 'B', 'DB', 'T', 'new');
    expect(news).toHaveLength(1);
    expect(news[0].name).toBe('n1');
  });
});
