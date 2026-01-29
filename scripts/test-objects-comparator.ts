
import { ComparatorService } from '../src/modules/comparator/comparator.service';
import { ParserService } from '../src/modules/parser/parser.service';
import { MysqlMigrator } from '../src/modules/migrator/mysql/mysql.migrator';

console.log('🧪 Starting Object Comparator Tests: Views & Triggers');

const parser = new ParserService();
const comparator = new ComparatorService(parser);
const migrator = new MysqlMigrator();

// --- Test Case 1: Identical Views ---
const view1 = 'CREATE VIEW `v_users` AS SELECT `id`, `name` FROM `users`';
console.log('\nCase 1: Identical Views');
const result1 = comparator.compareGenericDDL('VIEW', 'v_users', view1, view1);
if (result1) {
  console.error('❌ Expected no changes, but found:', result1);
  process.exit(1);
} else {
  console.log('✅ Passed (No changes detected)');
}

// --- Test Case 2: New View ---
console.log('\nCase 2: New View');
const result2 = comparator.compareGenericDDL('VIEW', 'v_users', view1, '');
if (result2 && result2.operation === 'CREATE') {
  console.log('✅ Detected CREATE VIEW');
  const sql = migrator.generateObjectSQL(result2);
  console.log('   SQL:', sql.join('\n'));
} else {
  console.error('❌ Failed to detect CREATE VIEW');
  process.exit(1);
}

// --- Test Case 3: Updated View ---
const view3_updated = 'CREATE VIEW `v_users` AS SELECT `id`, `name`, `age` FROM `users`';
console.log('\nCase 3: Updated View');
const result3 = comparator.compareGenericDDL('VIEW', 'v_users', view3_updated, view1);
if (result3 && result3.operation === 'REPLACE') {
  console.log('✅ Detected REPLACE VIEW (Updated)');
  const sql = migrator.generateObjectSQL(result3);
  console.log('   SQL:', sql.join('\n'));
} else {
  console.error('❌ Failed to detect REPLACE VIEW');
  process.exit(1);
}

// --- Test Case 4: Triggers ---
const trigger1 = 'CREATE TRIGGER `trg_users_ai` AFTER INSERT ON `users` FOR EACH ROW BEGIN INSERT INTO `logs` VALUES (NEW.id); END';
const trigger2 = 'CREATE TRIGGER `trg_users_ai` AFTER INSERT ON `users` FOR EACH ROW BEGIN INSERT INTO `logs` VALUES (NEW.id, NOW()); END';

console.log('\nCase 4: Update Trigger');
const result4 = comparator.compareTriggers('trg_users_ai', trigger2, trigger1);
if (result4 && result4.operation === 'REPLACE') {
  console.log('✅ Detected REPLACE TRIGGER');
  const sql = migrator.generateObjectSQL(result4);
  console.log('   SQL:', sql.join('\n'));
} else {
  console.error('❌ Failed to detect REPLACE TRIGGER');
  process.exit(1);
}


// --- Test Case 5: Procedures ---
const proc1 = 'CREATE PROCEDURE `p_add`(IN a INT, IN b INT) BEGIN SELECT a + b; END';
console.log('\nCase 5: Identical Procedures');
const result5 = comparator.compareGenericDDL('PROCEDURE', 'p_add', proc1, proc1);
if (result5) {
  console.error('❌ Expected no changes for procedure');
  process.exit(1);
} else {
  console.log('✅ Passed (No changes detected)');
}

console.log('\n✨ All Object Comparator Tests Passed!');
