-- @andb/core SQLite Schema
-- Maps exactly to folder structure: db/{env}/{database}/{type}/{name}.sql

-- ============================================
-- DDL Exports (maps to db/ folder structure)
-- ============================================

-- Replaces: db/{env}/{database}/{type}/{name}.sql
CREATE TABLE IF NOT EXISTS ddl_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  environment TEXT NOT NULL,           -- DEV, STAGE, UAT, PROD
  database_name TEXT NOT NULL,         -- dev_database, stage_database
  ddl_type TEXT NOT NULL,              -- TABLES, PROCEDURES, FUNCTIONS, TRIGGERS
  ddl_name TEXT NOT NULL,              -- users, orders, sp_get_users
  ddl_content TEXT NOT NULL,           -- Full DDL statement
  checksum TEXT,                       -- MD5 for change detection
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exported_to_file INTEGER DEFAULT 0,  -- 0=pending, 1=exported
  file_path TEXT,                      -- Virtual path: db/{env}/{db}/{type}/{name}.sql
  
  UNIQUE(environment, database_name, ddl_type, ddl_name)
);

-- Use CREATE INDEX IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_ddl_env_db ON ddl_exports(environment, database_name);
CREATE INDEX IF NOT EXISTS idx_ddl_type ON ddl_exports(ddl_type);
CREATE INDEX IF NOT EXISTS idx_ddl_export_pending ON ddl_exports(exported_to_file) WHERE exported_to_file = 0;

-- ============================================
-- DDL Lists (maps to db/{env}/{database}/current-ddl/{type}.list)
-- ============================================

-- This is a VIEW - generated from ddl_exports
-- Replaces: db/{env}/{database}/current-ddl/TABLES.list
CREATE VIEW IF NOT EXISTS ddl_lists AS
SELECT 
  environment,
  database_name,
  ddl_type,
  GROUP_CONCAT(ddl_name, CHAR(10)) as ddl_names,  -- Newline-separated list
  COUNT(*) as count
FROM ddl_exports
GROUP BY environment, database_name, ddl_type;

-- ============================================
-- Comparisons (maps to map-migrate/ folder structure)
-- ============================================

-- Replaces: map-migrate/{src}-to-{dest}/{database}/{type}/new.list
-- Replaces: map-migrate/{src}-to-{dest}/{database}/{type}/updated.list
-- Replaces: map-migrate/{src}-to-{dest}/{database}/{type}/deprecated.list
CREATE TABLE IF NOT EXISTS comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src_environment TEXT NOT NULL,       -- DEV
  dest_environment TEXT NOT NULL,      -- STAGE
  database_name TEXT NOT NULL,         -- dev_database
  ddl_type TEXT NOT NULL,              -- TABLES, PROCEDURES, etc
  ddl_name TEXT NOT NULL,              -- users, orders
  status TEXT NOT NULL,                -- new, updated, deprecated
  
  -- DDL references
  src_ddl_id INTEGER REFERENCES ddl_exports(id),
  dest_ddl_id INTEGER REFERENCES ddl_exports(id),
  
  -- Comparison metadata
  diff_summary TEXT,                   -- Brief description
  alter_statements TEXT,               -- JSON array of ALTER statements
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exported_to_file INTEGER DEFAULT 0,
  file_path TEXT,                      -- map-migrate/{src}-to-{dest}/{db}/{type}/{status}.list
  
  UNIQUE(src_environment, dest_environment, database_name, ddl_type, ddl_name)
);

CREATE INDEX IF NOT EXISTS idx_comp_src_dest ON comparisons(src_environment, dest_environment);
CREATE INDEX IF NOT EXISTS idx_comp_status ON comparisons(status);
CREATE INDEX IF NOT EXISTS idx_comp_export_pending ON comparisons(exported_to_file) WHERE exported_to_file = 0;

-- ============================================
-- Comparison Lists (VIEW)
-- ============================================

-- Generates content for new.list, updated.list, deprecated.list
CREATE VIEW IF NOT EXISTS comparison_lists AS
SELECT 
  src_environment,
  dest_environment,
  database_name,
  ddl_type,
  status,
  GROUP_CONCAT(ddl_name, CHAR(10)) as ddl_names,
  COUNT(*) as count
FROM comparisons
GROUP BY src_environment, dest_environment, database_name, ddl_type, status;

-- ============================================
-- Comparison Details (for ALTER statements)
-- ============================================

-- Replaces: map-migrate/{src}-to-{dest}/{db}/{type}/alter/{table}-columns.sql
CREATE TABLE IF NOT EXISTS alter_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comparison_id INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  alter_type TEXT NOT NULL,            -- columns, indexes, constraints
  statement TEXT NOT NULL,             -- Full ALTER statement
  sequence_order INTEGER NOT NULL,     -- Execution order
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  exported_to_file INTEGER DEFAULT 0,
  file_path TEXT                       -- Virtual path
);

CREATE INDEX IF NOT EXISTS idx_alter_comparison ON alter_statements(comparison_id);

-- ============================================
-- File Export Queue
-- ============================================

CREATE TABLE IF NOT EXISTS export_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,           -- ddl_export, comparison, alter_statement
  entity_id INTEGER NOT NULL,
  priority INTEGER DEFAULT 0,          -- Higher = more urgent
  status TEXT DEFAULT 'pending',       -- pending, processing, completed, failed
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON export_queue(status, priority DESC);

-- ============================================
-- Metadata & Configuration
-- ============================================

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Track last sync with files
INSERT OR IGNORE INTO metadata VALUES ('last_file_export', NULL, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO metadata VALUES ('schema_version', '1.0.1', CURRENT_TIMESTAMP);

-- ============================================
-- Triggers for auto-queue
-- ============================================

-- Auto-queue new DDL exports
CREATE TRIGGER IF NOT EXISTS trg_queue_ddl_export
AFTER INSERT ON ddl_exports
WHEN NEW.exported_to_file = 0
BEGIN
  INSERT INTO export_queue (entity_type, entity_id, priority)
  VALUES ('ddl_export', NEW.id, 10);
END;

-- Auto-queue updated DDL exports
CREATE TRIGGER IF NOT EXISTS trg_queue_ddl_update
AFTER UPDATE ON ddl_exports
WHEN NEW.exported_to_file = 0 AND OLD.exported_to_file = 1
BEGIN
  INSERT INTO export_queue (entity_type, entity_id, priority)
  VALUES ('ddl_export', NEW.id, 10);
END;

-- Auto-queue comparisons
CREATE TRIGGER IF NOT EXISTS trg_queue_comparison
AFTER INSERT ON comparisons
WHEN NEW.exported_to_file = 0
BEGIN
  INSERT INTO export_queue (entity_type, entity_id, priority)
  VALUES ('comparison', NEW.id, 5);
END;

-- Auto-queue updated comparisons
CREATE TRIGGER IF NOT EXISTS trg_queue_comparison_update
AFTER UPDATE ON comparisons
WHEN NEW.exported_to_file = 0 AND OLD.exported_to_file = 1
BEGIN
  INSERT INTO export_queue (entity_type, entity_id, priority)
  VALUES ('comparison', NEW.id, 5);
END;

-- ============================================
-- Helper Functions (Virtual columns)
-- ============================================

-- Virtual file path generation
CREATE TRIGGER IF NOT EXISTS trg_ddl_file_path
AFTER INSERT ON ddl_exports
BEGIN
  UPDATE ddl_exports 
  SET file_path = 'db/' || environment || '/' || database_name || '/' || 
                  LOWER(ddl_type) || '/' || ddl_name || '.sql'
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_comparison_file_path_insert
AFTER INSERT ON comparisons
BEGIN
  UPDATE comparisons
  SET file_path = 'map-migrate/' || src_environment || '-to-' || dest_environment || 
                  '/' || database_name || '/' || LOWER(ddl_type) || '/' || 
                  LOWER(status) || '.list'
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_comparison_file_path_update
AFTER UPDATE OF status ON comparisons
BEGIN
  UPDATE comparisons
  SET file_path = 'map-migrate/' || src_environment || '-to-' || dest_environment || 
                  '/' || database_name || '/' || LOWER(ddl_type) || '/' || 
                  LOWER(status) || '.list'
  WHERE id = NEW.id;
END;

