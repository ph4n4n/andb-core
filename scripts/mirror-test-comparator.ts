
import { ComparatorService } from '../src/modules/comparator/comparator.service';
import { ParserService } from '../src/modules/parser/parser.service';
import * as assert from 'assert';

console.log('🧪 Starting Mirror Test: Comparator Service');

const parser = new ParserService();
const comparator = new ComparatorService(parser);

// --- Test Case 1: Identical Tables ---
const ddl1 = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

console.log('\nCase 1: Identical Tables');
const result1 = comparator.compareTables(ddl1, ddl1);
if (result1.hasChanges) {
  console.error('❌ Expected no changes, but found changes:', result1.operations);
  process.exit(1);
} else {
  console.log('✅ Passed (No changes detected)');
}

// --- Test Case 2: Add Column ---
const ddl2_src = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`age\` int(11) DEFAULT 0,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

console.log('\nCase 2: Add Column');
const result2 = comparator.compareTables(ddl2_src, ddl1); // Src has age, Dest (ddl1) doesn't
// Expect ADD COLUMN age
const ageOp = result2.operations.find(op => op.type === 'ADD' && op.target === 'COLUMN' && op.name === 'age');
if (ageOp) {
  console.log('✅ Detected ADD COLUMN age');
} else {
  console.error('❌ Failed to detect ADD COLUMN age');
  process.exit(1);
}

// --- Test Case 3: Modify Column ---
const ddl3_src = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- Changed length
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

console.log('\nCase 3: Modify Column');
const result3 = comparator.compareTables(ddl3_src, ddl1); // Src 100, Dest 255
const modOp = result3.operations.find(op => op.type === 'MODIFY' && op.target === 'COLUMN' && op.name === 'name');
if (modOp) {
  console.log('✅ Detected MODIFY COLUMN name');
} else {
  console.error('❌ Failed to detect MODIFY COLUMN name');
  process.exit(1);
}

// --- Test Case 4: Drop Index ---
const ddl4_dest_with_index = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`),
  KEY \`idx_name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

const ddl4_src_no_index = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

console.log('\nCase 4: Drop Index');
const result4 = comparator.compareTables(ddl4_src_no_index, ddl4_dest_with_index);
const dropIdxOp = result4.operations.find(op => op.type === 'DROP' && op.target === 'INDEX' && op.name === 'idx_name');
if (dropIdxOp) {
  console.log('✅ Detected DROP INDEX idx_name');
} else {
  console.error('❌ Failed to detect DROP INDEX idx_name');
  process.exit(1);
}

console.log('\n✨ All Comparator Mirror Tests Passed!');
