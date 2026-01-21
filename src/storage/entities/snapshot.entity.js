class SnapshotEntity {
  constructor(data = {}) {
    this.id = data.id || null;
    this.environment = data.environment || '';
    this.database_name = data.database_name || '';
    this.ddl_type = data.ddl_type || '';
    this.ddl_name = data.ddl_name || '';
    this.ddl_content = data.ddl_content || '';
    this.checksum = data.checksum || '';
    this.version_tag = data.version_tag || '';
    this.created_at = data.created_at || null;
  }

  static fromRow(row) {
    if (!row) return null;
    return new SnapshotEntity(row);
  }
}

module.exports = SnapshotEntity;
