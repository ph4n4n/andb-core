# Changelog

All notable changes to the **NestJS rewrite** of The Andb Core will be documented in this file.

---

## [4.0.0-alpha.1] - 2026-01-29

### Added (The NestJS Rewrite)

- **Architectural Foundation**: Complete project initialization with NestJS and TypeScript.
- **Twin Engine Strategy**: Implemented modules side-by-side with legacy logic to ensure parity.
- **Improved Driver System**:
  - `MysqlDriver`: Refined connection handling and introspection.
  - `DumpDriver`: Advanced SQL dump parsing for offline comparison.
- **Logic Engines**:
  - `ParserService`: Ported and improved DDL parsing/normalization.
  - `ComparatorService`: Deep-diffing for Tables, Views, Procedures, Functions, and Triggers.
  - `MigratorService`: Intelligent SQL generation for migrations.
- **Modern CLI**:
  - Ported `generate` command for automated npm script creation.
  - Ported `helper` command for usage and configuration display.
- **Dev Experience**:
  - Standardized ESLint and Prettier configuration.
  - Comprehensive "Mirror Tests" to verify parity with legacy logic.

### Fixed

- Fixed various linting issues related to unused variables and console logging in CLI tools.
- Resolved type safety issues in introspection and migration logic.

---

_Note: For historical changes prior to the NestJS rewrite, please refer to the legacy `@the-andb/core` repository._
