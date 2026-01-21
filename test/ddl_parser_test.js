const DDLParser = require('../core/utils/ddl.parser');

const tests = [
  {
    name: "Remove DEFINER simple",
    input: "CREATE DEFINER=`root`@`localhost` PROCEDURE `test`() BEGIN SELECT 1; END",
    expected: "CREATE PROCEDURE `test`() BEGIN SELECT 1; END"
  },
  {
    name: "Remove DEFINER complex user",
    input: "CREATE DEFINER=`some-user`@`%.example.com` FUNCTION `func`() RETURNS INT BEGIN RETURN 1; END",
    expected: "CREATE FUNCTION `func`() RETURNS INT BEGIN RETURN 1; END"
  },
  {
    name: "Ignore Whitespace",
    input: "CREATE   PROCEDURE    `test`()\nBEGIN\n  SELECT 1;\nEND",
    expected: "CREATE PROCEDURE `test`() BEGIN SELECT 1; END",
    options: { ignoreWhitespace: true }
  },
  {
    name: "Full cleanup (Definer + Whitespace)",
    input: "CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_test`()\nBEGIN\n  SELECT * FROM users;\nEND",
    expected: "CREATE PROCEDURE `sp_test`() BEGIN SELECT * FROM users; END",
    options: { ignoreDefiner: true, ignoreWhitespace: true }
  },
  {
    name: "Preserve body spacing if not ignoring whitespace (only header clean)",
    input: "CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_test`()\nBEGIN\n  SELECT internal;\nEND",
    expected: "CREATE PROCEDURE `sp_test`()\nBEGIN\n  SELECT internal;\nEND",
    options: { ignoreDefiner: true, ignoreWhitespace: false }
  }
];

let failed = 0;

console.log("Running DDLParser Tests...\n");

tests.forEach(test => {
  const result = DDLParser.normalize(test.input, test.options || { ignoreDefiner: true });

  // Simple normalization for comparison in test
  const normalizeSpace = (s) => s.replace(/\s+/g, ' ').trim();

  const passed = test.options?.ignoreWhitespace
    ? result === test.expected
    : normalizeSpace(result) === normalizeSpace(test.expected);

  if (passed) {
    console.log(`✅ ${test.name}`);
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: "${test.expected}"`);
    console.log(`   Actual:   "${result}"`);
    failed++;
  }
});

if (failed > 0) {
  console.log(`\n${failed} tests failed.`);
  process.exit(1);
} else {
  console.log("\nAll tests passed!");
}
