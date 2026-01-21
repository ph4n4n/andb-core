const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function createTestDb() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    const schemaPath = path.join(__dirname, '../src/storage/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    return db;
  } catch (e) {
    console.error('Failed to create test DB (better-sqlite3 mismatch):', e.message);
    return null;
  }
}

module.exports = { createTestDb };
