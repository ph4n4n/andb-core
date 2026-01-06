class DDLEntity {
  constructor(data = {}) {
    this.id = data.id || null;
    this.environment = data.environment || '';
    this.database_name = data.database_name || '';
    this.ddl_type = data.ddl_type || '';
    this.ddl_name = data.ddl_name || '';
    this.ddl_content = data.ddl_content || '';
    this.checksum = data.checksum || '';
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.exported_to_file = data.exported_to_file || 0;
    this.file_path = data.file_path || '';

    // Compatibility getters
    Object.defineProperty(this, 'name', { get: () => this.ddl_name, enumerable: true });
    Object.defineProperty(this, 'ddl', { get: () => this.ddl_content, enumerable: true });
    Object.defineProperty(this, 'content', { get: () => this.ddl_content, enumerable: true });
  }

  static fromRow(row) {
    if (!row) return null;
    return new DDLEntity(row);
  }

  toJSON() {
    return { ...this };
  }
}

module.exports = DDLEntity;
