const MigrationRepository = require('../../core/storage/repositories/migration.repository');
const { createTestDb } = require('../test-utils');

describe('MigrationRepository', () => {
  let db;
  let repository;

  beforeEach(() => {
    db = createTestDb();
    if (db) repository = new MigrationRepository(db);
  });

  afterEach(() => {
    if (db) db.close();
  });

  test('should save a migration record', async () => {
    if (!db) return;
    const data = {
      src_environment: 'DEV',
      dest_environment: 'STAGE',
      database_name: 'test_db',
      ddl_type: 'TABLES',
      ddl_name: 'users',
      operation: 'ALTER',
      status: 'SUCCESS',
      executed_by: 'test-user'
    };

    await repository.save(data);

    const history = await repository.list(10);
    expect(history).toHaveLength(1);
    expect(history[0].ddl_name).toBe('users');
    expect(history[0].status).toBe('SUCCESS');
  });

  test('should handle optional fields', async () => {
    if (!db) return;
    const data = {
      src_environment: 'DEV',
      dest_environment: 'STAGE',
      database_name: 'test_db',
      ddl_type: 'TABLES',
      ddl_name: 'users',
      operation: 'CREATE',
      status: 'FAILED',
      error_message: 'Table already exists'
    };

    await repository.save(data);

    const history = await repository.list(1);
    expect(history[0].error_message).toBe('Table already exists');
  });
});
