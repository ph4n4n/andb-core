# Database Structure Diagram

This diagram shows the SQLite database schema used for centralized storage in ANDB.

```mermaid
erDiagram
    ddl_exports ||--o{ comparisons : "source/target reference"
    comparisons ||--o{ alter_statements : "has"
    ddl_exports ||--o{ ddl_snapshots : "historical versions"

    ddl_exports {
        integer id PK
        string environment "UPPERCASE (DEV, PROD...)"
        string database_name
        string ddl_type "UPPERCASE (TABLES, PROCEDURES, FUNCTIONS, TRIGGERS, EVENTS, VIEWS)"
        string ddl_name
        string ddl_content
        string checksum
        datetime created_at
        datetime updated_at
        integer exported_to_file
    }

    comparisons {
        integer id PK
        string src_environment
        string dest_environment
        string database_name
        string ddl_type
        string ddl_name
        string status "NEW, UPDATED, DEPRECATED, EQUAL"
        integer src_ddl_id FK
        integer dest_ddl_id FK
        string diff_summary
        string alter_statements "JSON Array"
        datetime created_at
        datetime updated_at
    }

    alter_statements {
        integer id PK
        integer comparison_id FK
        string alter_type "columns, indexes"
        string statement
        integer sequence_order
    }

    ddl_snapshots {
        integer id PK
        string environment
        string database_name
        string ddl_type
        string ddl_name
        string ddl_content
        string checksum
        string version_tag
        datetime created_at
    }

    migration_history {
        integer id PK
        string src_environment
        string dest_environment
        string database_name
        string ddl_type
        string ddl_name
        string operation "CREATE, ALTER, DROP"
        string status "SUCCESS, FAILED"
        string error_message
        datetime executed_at
    }

    storage_actions {
        integer id PK
        string action_type "EXPORT, COMPARE, MIGRATE"
        string status
        string details
        datetime created_at
    }

    metadata {
        string key PK
        string value
        datetime updated_at
    }
```

## Layered Architecture

The storage system follows a 3-layer architecture:

1.  **Entity Layer**: Plain JavaScript classes defined in `core/storage/entities/` representing database rows.
2.  **Repository Layer**: Data access logic defined in `core/storage/repositories/`, handling SQL queries and returning Entity instances.
3.  **Service Layer**: `SQLiteStorage` in `core/utils/storage.strategy.js` acts as a facade, coordinating various repositories to provide a unified API.
