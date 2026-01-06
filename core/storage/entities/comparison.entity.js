class ComparisonEntity {
  constructor(data = {}) {
    this.id = data.id || null;
    this.src_environment = data.src_environment || '';
    this.dest_environment = data.dest_environment || '';
    this.database_name = data.database_name || '';
    this.ddl_type = data.ddl_type || '';
    this.ddl_name = data.ddl_name || '';
    this.status = data.status || '';
    this.src_ddl_id = data.src_ddl_id || null;
    this.dest_ddl_id = data.dest_ddl_id || null;
    this.diff_summary = data.diff_summary || '';
    this.alter_statements = this._parseAlterStatements(data.alter_statements);
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.exported_to_file = data.exported_to_file || 0;
    this.file_path = data.file_path || '';

    // Compatibility getters for the UI
    Object.defineProperty(this, 'name', { get: () => this.ddl_name, enumerable: true });
    Object.defineProperty(this, 'type', { get: () => this.ddl_type, enumerable: true });
    Object.defineProperty(this, 'ddl', { get: () => this.alter_statements, enumerable: true });
    Object.defineProperty(this, 'alterStatements', { get: () => this.alter_statements, enumerable: true });
  }

  _parseAlterStatements(val) {
    if (!val) return null;
    if (typeof val === 'string') {
      try {
        if (val.startsWith('[') || val.startsWith('{')) {
          return JSON.parse(val);
        }
        return val;
      } catch (e) {
        return val;
      }
    }
    return val;
  }

  static fromRow(row) {
    if (!row) return null;
    return new ComparisonEntity(row);
  }

  /**
   * Standardized UI object for comparison results.
   * This is what AndbBuilder and the Vue frontend will consume.
   */
  toUI() {
    return {
      name: this.ddl_name,
      status: this.status,
      type: this.ddl_type,
      ddl: this.alter_statements, // Unified as 'ddl' to match DDLEntity and frontend expectation
      alterStatements: this.alter_statements, // Keep for backward compatibility
      diffSummary: this.diff_summary,
      updatedAt: this.updated_at
    };
  }
}

module.exports = ComparisonEntity;
