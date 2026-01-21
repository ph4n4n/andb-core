class MigrationEntity {
  constructor(data = {}) {
    this.id = data.id || null;
    this.src_environment = data.src_environment || '';
    this.dest_environment = data.dest_environment || '';
    this.database_name = data.database_name || '';
    this.ddl_type = data.ddl_type || '';
    this.ddl_name = data.ddl_name || '';
    this.operation = data.operation || '';
    this.status = data.status || '';
    this.error_message = data.error_message || '';
    this.executed_at = data.executed_at || null;
    this.executed_by = data.executed_by || '';
  }

  static fromRow(row) {
    if (!row) return null;
    return new MigrationEntity(row);
  }
}

module.exports = MigrationEntity;
