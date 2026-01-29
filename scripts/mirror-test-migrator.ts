
import { ComparatorService } from '../src/modules/comparator/comparator.service';
import { ParserService } from '../src/modules/parser/parser.service';
import { MigratorService } from '../src/modules/migrator/migrator.service';

console.log('🧪 Starting Mirror Test: Migrator Service');

const parser = new ParserService();
const comparator = new ComparatorService(parser);
const migrator = new MigratorService();

// --- Test Case 1: Add Column ---
const ddl1 = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

const ddl2_src = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`age\` int(11) DEFAULT 0,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

console.log('\nCase 1: Generate SQL for ADD COLUMN');
const diff1 = comparator.compareTables(ddl2_src, ddl1); // Src has age, Dest doesn't
const sql1 = migrator.generateAlterSQL(diff1);
console.log('SQL:', sql1);
if (sql1.length > 0 && sql1[0].includes('ADD COLUMN `age` int(11) DEFAULT 0')) {
  console.log('✅ Correct SQL Generated');
} else {
  console.error('❌ Incorrect SQL');
  process.exit(1);
}

// --- Test Case 2: Modify Column ---
const ddl3_src = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- Changed length
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

console.log('\nCase 2: Generate SQL for MODIFY COLUMN');
const diff2 = comparator.compareTables(ddl3_src, ddl1);
const sql2 = migrator.generateAlterSQL(diff2);
console.log('SQL:', sql2);
if (sql2.length > 0 && sql2[0].includes('MODIFY COLUMN `name` varchar(100)')) {
  console.log('✅ Correct SQL Generated');
} else {
  console.error('❌ Incorrect SQL');
  process.exit(1);
}

// --- Test Case 3: Drop Index ---
const ddl4_dest_with_index = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`),
  KEY \`idx_name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

const ddl4_src_no_index = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

console.log('\nCase 3: Generate SQL for DROP INDEX');
const diff3 = comparator.compareTables(ddl4_src_no_index, ddl4_dest_with_index);
const sql3 = migrator.generateAlterSQL(diff3);
console.log('SQL:', sql3);
if (sql3.length > 0 && sql3[0].includes('DROP INDEX `idx_name`')) {
  console.log('✅ Correct SQL Generated');
} else {
  console.error('❌ Incorrect SQL');
  process.exit(1);
}

console.log('\n✨ All Migrator Mirror Tests Passed!');
