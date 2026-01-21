# The Andb Core 🚀

**The Premium Database Orchestration Engine** — Intelligent Schema Management, Seamless Synchronization, and High-Fidelity Reporting.

---

## 🌟 Overview

**The Andb Core** is the heart of the Andb Orchestrator ecosystem. It provides a robust, driver-agnostic engine to manage database schemas across multiple environments (DEV, STAGE, PROD) with absolute precision.

Built for modern DevOps workflows, it transforms database synchronization from a manual chore into an automated, predictable, and visually insightful process.

## ✨ Features

- 💎 **Premium Intelligence**: Advanced comparison engine for Tables, Views, Procedures, Functions, Triggers, and Events.
- 📊 **High-Fidelity Reporting**: Industry-leading HTML reports with dark-mode aesthetics and dynamic data visualization.
- 🏗️ **"Zero to Hero" Architecture**: Clean dependency injection and pluggable storage strategies (Git-friendly or UI-optimized).
- 🛡️ **Session Hygiene**: Automatic handling of foreign key checks and session modes for safe migrations.
- 🔌 **Extensible**: Designed to support MySQL/MariaDB out of the box, with a clear roadmap for PostgreSQL.

## 🚀 Quick Start

### Installation

```bash
npm install @the-andb/core
```

### Basic CLI Usage

Initialize your project and generate a clean workflow:

```bash
npx andb init
npx andb generate
```

### Programmatic Integration

```javascript
const { Container } = require("@the-andb/core");

const container = new Container(config);
const { exporter, comparator } = container.getServices();

await exporter("TABLES")("users");
```

## 📊 High-Fidelity Reports

The Andb Core generates premium reports that provide deep insights into your schema evolution.

> **Tip**: Check out our interactive demo!
>
> ```bash
> node test/reports/report.demo.js
> ```

## 📁 Project Structure

```text
the-andb-core/
├── src/           # Core engine logic
│   ├── service/   # Business services (Migrator, Comparator, etc.)
│   ├── drivers/   # Database-specific drivers
│   ├── utils/     # Highly efficient utility modules
│   └── reports/   # Premium HTML templates
├── docs/          # Comprehensive documentation
├── test/          # Full test suite & high-fidelity demos
└── index.js       # Entry point
```

## 📜 Documentation

- 📖 [CLI Usage Guide](docs/CLI_EN.md)
- 📖 [Integration Manual](docs/INTEGRATION_EN.md)
- 📖 [Script Generator](docs/GENERATOR_EN.md)

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contribution Guidelines](CONTRIBUTING.md) to get started.

## 📄 License

This project is licensed under the **MIT License** — providing maximum flexibility for both personal and commercial use.

---

**Keep Going. Keep Syncing.**  
Made with ❤️ by [The Andb Team](https://github.com/The-Andb)
