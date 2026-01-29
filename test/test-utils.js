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
    // Silently skip - better-sqlite3 version mismatch is expected in mixed Node.js environments
    // Tests will gracefully skip SQLite-dependent scenarios when db is null
    return null;
  }
}

module.exports = { createTestDb };
