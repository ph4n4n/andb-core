const DDLRepository = require('../../core/storage/repositories/ddl.repository');
const { createTestDb } = require('../test-utils');

describe('DDLRepository', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = createTestDb();
    if (db) repository = new DDLRepository(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('should save a DDL entry', async () => {
    if (!db) return; // Skip if no DB
    const data = {
      environment: 'DEV',
      database: 'test_db',
      type: 'TABLES',
      name: 'users',
      content: 'CREATE TABLE users (id INT)'
    };

    const result = await repository.save(data);
    expect(result).toBe(true);

    const saved = await repository.findOne('DEV', 'test_db', 'TABLES', 'users');
    expect(saved).toBeDefined();
    expect(saved.ddl_name).toBe('users');
    expect(saved.ddl_content).toBe(data.content);
    expect(saved.checksum).toBeDefined();
  });

  test('should handle ON CONFLICT by updating content', async () => {
    if (!db) return;
    const data1 = {
      environment: 'DEV',
      database: 'test_db',
      type: 'TABLES',
      name: 'users',
      content: 'CREATE TABLE users (id INT)'
    };
    await repository.save(data1);

    const data2 = {
      environment: 'DEV',
      database: 'test_db',
      type: 'TABLES',
      name: 'users',
      content: 'CREATE TABLE users (id INT, name TEXT)'
    };
    await repository.save(data2);

    const saved = await repository.findOne('DEV', 'test_db', 'TABLES', 'users');
    expect(saved.ddl_content).toBe(data2.content);
  });

  test('should list names correctly', async () => {
    if (!db) return;
    const items = [
      { environment: 'DEV', database: 'db1', type: 'TABLES', name: 't1', content: 'c1' },
      { environment: 'DEV', database: 'db1', type: 'TABLES', name: 't2', content: 'c2' },
      { environment: 'DEV', database: 'db2', type: 'TABLES', name: 't3', content: 'c3' }
    ];

    for (const item of items) {
      await repository.save(item);
    }

    const list = await repository.listNames('DEV', 'db1', 'TABLES');
    expect(list).toHaveLength(2);
    expect(list).toContain('t1');
    expect(list).toContain('t2');
  });

  test('should clear connection data', async () => {
    if (!db) return;
    await repository.save({ environment: 'DEV', database: 'db1', type: 'TABLES', name: 't1', content: 'c1' });
    await repository.save({ environment: 'DEV', database: 'db2', type: 'TABLES', name: 't2', content: 'c2' });

    await repository.clearConnectionData('DEV', 'db1');

    expect(await repository.count()).toBe(1);
    const db2Items = await repository.listNames('DEV', 'db2', 'TABLES');
    expect(db2Items).toContain('t2');
  });
});
