
// We used to assume core/src/utils/ddl.parser.js existed, but the file uses module.exports = DDLParser;
// The legacy DDLParser is:
const LegacyDDLParser = require('../../core/src/utils/ddl.parser.js'); // Adjust path as needed

import { ParserService } from '../src/modules/parser/parser.service';
import * as assert from 'assert';

console.log('🧪 Starting Mirror Test: Parser Service');

const parserService = new ParserService();

const testCases = [
  // Basic cleaning
  {
    input: "CREATE DEFINER=`root`@`localhost` PROCEDURE `test`...",
    name: "Clean Definer (Procedure)"
  },
  // Whitespace normalization
  {
    input: "CREATE   TABLE   `test`  ( `id` int )",
    name: "Normalize Whitespace",
    options: { ignoreWhitespace: true }
  },
  // Keyword Uppercase
  {
    input: "create table test ( id int )",
    name: "Uppercase Keywords",
    checkUppercase: true
  }
];

let failed = false;

testCases.forEach((test, index) => {
  console.log(`\nCase ${index + 1}: ${test.name}`);

  try {
    let legacyOutput: string = "";
    let nestOutput: string = "";

    if (test.checkUppercase) {
      // Uppercase Logic
      legacyOutput = LegacyDDLParser.uppercaseKeywords(test.input);
      nestOutput = parserService.uppercaseKeywords(test.input);
    } else {
      // Normalization Logic
      legacyOutput = LegacyDDLParser.normalize(test.input, test.options || { ignoreDefiner: true });
      nestOutput = parserService.normalize(test.input, test.options || { ignoreDefiner: true });
    }

    if (legacyOutput !== nestOutput) {
      console.error(`❌ Mismatch!`);
      console.error(`Legacy: [${legacyOutput}]`);
      console.error(`NestJS: [${nestOutput}]`);
      failed = true;
    } else {
      console.log(`✅ Match: [${nestOutput.substring(0, 50)}...]`);
    }

  } catch (err: unknown) { // Explicitly typed as unknown
    console.error(`❌ Error in test case:`, err);
    failed = true;
  }
});

if (failed) {
  console.error('\n💥 Mirror Tests Failed!');
  process.exit(1);
} else {
  console.log('\n✨ All Mirror Tests Passed!');
  process.exit(0);
}
