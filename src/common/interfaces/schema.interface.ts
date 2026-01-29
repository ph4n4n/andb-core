export interface ITableDefinition {
  name: string;
  schema?: string; // e.g. 'public' in PG, or db name in MySQL
  columns: IColumnDefinition[];
  indexes: IIndexDefinition[];
  foreignKeys: IForeignKeyDefinition[];
  options?: ITableOptions; // engine, charset, collation
  ddl?: string; // The raw CREATE TABLE statement
}

export interface IColumnDefinition {
  name: string;
  type: string; // e.g. 'VARCHAR(255)'
  isNullable: boolean; // boolean
  isPrimaryKey: boolean;
  defaultValue?: string | null;
  comment?: string;
  autoIncrement?: boolean;
  charset?: string;
  collation?: string;
  extra?: string; // e.g. 'ON UPDATE CURRENT_TIMESTAMP'
}

export interface IIndexDefinition {
  name: string;
  columns: string[]; // column names
  isUnique: boolean;
  type?: string; // BTREE, FULLTEXT, etc.
  algorythm?: string;
  comment?: string;
}

export interface IForeignKeyDefinition {
  constraintName: string;
  columnName: string;
  referencedSchema?: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate?: string; // CASCADE, RESTRICT, SET NULL, NO ACTION
  onDelete?: string;
}

export interface ITableOptions {
  engine?: string;
  charset?: string;
  collation?: string;
  rowFormat?: string;
  autoIncrement?: number;
  comment?: string;
}

export interface IViewDefinition {
  name: string;
  schema?: string;
  ddl: string;
  algorithm?: string; // UNDEFINED, MERGE, TEMPTABLE
  definer?: string;
  securityType?: string; // DEFINER, INVOKER
  checkOption?: string; // CASCADED, LOCAL
}

export interface IRoutineDefinition {
  name: string;
  schema?: string;
  type: 'PROCEDURE' | 'FUNCTION';
  ddl: string;
  definer?: string;
  deterministic?: boolean;
  dataAccess?: 'CONTAINS SQL' | 'NO SQL' | 'READS SQL DATA' | 'MODIFIES SQL DATA';
  securityType?: string;
  comment?: string;
  params?: string; // Raw parameter string for now
  returns?: string; // Return type for functions
}

export interface ITriggerDefinition {
  name: string;
  schema?: string;
  ddl: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE';
  timing: 'BEFORE' | 'AFTER';
  table: string;
}

export interface IEventDefinition {
  name: string;
  schema?: string;
  ddl: string;
  definer?: string;
  schedule?: string;
  status?: 'ENABLE' | 'DISABLE' | 'SLAVESIDE_DISABLED';
  onCompletion?: 'PRESERVE' | 'NOT PRESERVE';
}
