# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Features

- MySQL database support
- DDL export (Tables, Functions, Procedures, Triggers)
- Environment comparison with detailed diff
- Migration tracking with history
- Storage abstraction layer
- Domain normalization support
- Comprehensive error handling
- Detailed logging

### Architecture

- Service-oriented design
- Dependency injection via Container
- Pluggable storage strategies
- Clean separation of concerns
- Reusable core for CLI and UI

### Documentation

- API documentation
- Integration guides (EN/VI)
- CLI documentation (EN/VI)
- Generator documentation (EN/VI)
- Example projects

## [Unreleased]

### Planned

- PostgreSQL support
- Migration rollback
- Schema versioning
- Enhanced reporting
- Performance optimizations

---

[1.0.0-beta.1]: https://github.com/ph4n4n/andb-core/releases/tag/v1.0.0-beta.1
