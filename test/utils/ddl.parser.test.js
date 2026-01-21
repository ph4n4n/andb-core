const DDLParser = require('../../src/utils/ddl.parser');

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

describe('DDLParser', () => {
  tests.forEach(testCase => {
    test(testCase.name, () => {
      const result = DDLParser.normalize(testCase.input, testCase.options || { ignoreDefiner: true });

      const normalizeSpace = (s) => s.replace(/\s+/g, ' ').trim();

      if (testCase.options?.ignoreWhitespace) {
        expect(result).toBe(testCase.expected);
      } else {
        expect(normalizeSpace(result)).toBe(normalizeSpace(testCase.expected));
      }
    });
  });
});
