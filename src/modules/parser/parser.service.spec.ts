import { Test, TestingModule } from '@nestjs/testing';
import { ParserService } from './parser.service';

describe('ParserService', () => {
  let service: ParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParserService],
    }).compile();

    service = module.get<ParserService>(ParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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

  tests.forEach(testCase => {
    it(testCase.name, () => {
      const result = service.normalize(testCase.input, testCase.options || { ignoreDefiner: true });

      const normalizeSpace = (s: string) => s.replace(/\s+/g, ' ').trim();

      if (testCase.options?.ignoreWhitespace) {
        expect(result).toBe(testCase.expected);
      } else {
        expect(normalizeSpace(result)).toBe(normalizeSpace(testCase.expected));
      }
    });
  });
});
