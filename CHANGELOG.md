# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.3] - 2026-01-28

### Fixed

- **Unit Test Suite**: Fixed `_extractName()` test cases that were incorrectly passing full SQL statements instead of raw name values. All 90 tests now pass.
- **Clean Test Output**: Silenced `better-sqlite3` mismatch console errors in test output. Tests gracefully skip SQLite-dependent scenarios in mixed Node.js environments without noisy logs.
- **Publish Readiness**: Ensured `npm publish` workflow is clean with all tests passing and proper package configuration.

### Improved

- **DumpDriver Parsing**: Enhanced documentation for internal `_extractName()` method clarifying its role in processing regex-captured names.
- **Test Coverage**: Added additional edge case tests including null input handling and double-quoted name support.

---

## [3.0.0] - 2026-01-21

### Added

- **Premium Reporting Engine**: Revamped HTML reports with dark-mode primary aesthetics, Highcharts integration via CDN, and high-fidelity data visualization.
- **Unified DDL Support**: Expanded support for Views, Procedures, Functions, Triggers, and Events in both comparison and migration engines.
- **Direct Database Driver Access**: Added `setForeignKeyChecks` and other session hygiene methods to `IDatabaseDriver` for better abstraction.
- **Dynamic Charting**: Reports now automatically generate charts based on the actual distribution of database objects.
- **High-Fidelity Demo**: Added a premium demo script at `test/reports/report.demo.js` to showcase report capabilities.

### Improved

- **Core Abstraction Layer**: Transitioned to a "Zero to Hero" architectural strategy focusing on driver-agnostic commands and centralized DDL generation.
- **Recursive Directory Management**: Better handling of nested DDL structures and backup management.
- **Brand Identity**: Rebranded as **The Andb Orchestrator** - a premium database orchestration tool.
- **NPM Package Health**: Cleaned up `files` list and fixed `index.js` path references.

### Fixed

- Chart rendering issues due to local library dependency (now uses reliable CDNs).
- Incorrect file path references in `MigratorService` for Percona Toolkit tables.
- Compatibility issues with `better-sqlite3` and `mysql2` in specific environments.

## [2.1.0] - 2026-01-12

### Added

- **Crypt Utility**: Core security logic for handling AES-256-CBC encrypted credentials.
- **Standardized IPC Outputs**: Unified response structure (success/data/error/message) for seamless UI integration.

### Improved

- **Comparator Engine**: Enhanced deep-diffing for complex database objects (Triggers, Multi-line Views).
- **Migrator Stability**: Refined dry-run execution and SQL preview generation.
- **Storage Resilience**: Improved `SQLiteStorage` handling for large DDL snapshots.

### Fixed

- Dependency alignment for `better-sqlite3` across different Node.js environments.
- Circular dependency handling in SQL export scripts.

## [1.0.0-beta.1] - 2025-12-26

### Added

- Initial beta release
- Core library for database migration and comparison
- Container service with dependency injection
- ExporterService for DDL export
- ComparatorService for environment comparison
- MigratorService for database migrations
- MonitorService for database monitoring
- Pluggable StorageStrategy interface
- FileStorage implementation (Git-friendly)
- SQLiteStorage implementation (UI-optimized)
- CLI builder for command-line integration
- Script generator for npm scripts
- Helper utilities

[3.0.3]: https://github.com/The-Andb/andb-core/releases/tag/v3.0.3
[3.0.0]: https://github.com/The-Andb/andb-core/releases/tag/v3.0.0
[2.1.0]: https://github.com/The-Andb/andb-core/releases/tag/v2.1.0
[1.0.0-beta.1]: https://github.com/The-Andb/andb-core/releases/tag/v1.0.0-beta.1
