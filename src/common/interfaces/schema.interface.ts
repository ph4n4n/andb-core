export interface ITableDefinition {
  name: string;
  schema?: string;
  columns: IColumnDefinition[];
  indexes: IIndexDefinition[];
  foreignKeys: IForeignKeyDefinition[];
  options?: ITableOptions;
  ddl?: string;
}

export interface IColumnDefinition {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string | null;
  comment?: string;
  autoIncrement?: boolean;
  charset?: string;
  collation?: string;
  extra?: string;
}

export interface IIndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
  type?: string;
  algorythm?: string;
  comment?: string;
}

export interface IForeignKeyDefinition {
  constraintName: string;
  columnName: string;
  referencedSchema?: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate?: string;
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
  algorithm?: string;
  definer?: string;
  securityType?: string;
  checkOption?: string;
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
  params?: string;
  returns?: string;
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

// Diff related
export interface IDiffOperation {
  type: 'ADD' | 'DROP' | 'MODIFY' | 'CHANGE';
  target: 'TABLE' | 'COLUMN' | 'INDEX' | 'FOREIGN_KEY' | 'OPTION' | 'TRIGGER' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'EVENT';
  name: string;
  tableName?: string;
  definition?: string;
  oldDefinition?: string;
}

export interface ITableDiff {
  tableName: string;
  operations: IDiffOperation[];
  hasChanges: boolean;
}

export interface IObjectDiff {
  type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'EVENT' | 'TRIGGER';
  name: string;
  operation: 'CREATE' | 'DROP' | 'REPLACE';
  definition?: string;
}

export interface ISchemaDiff {
  tables: Record<string, ITableDiff>;
  droppedTables: string[];
  objects: IObjectDiff[];
  summary: {
    totalChanges: number;
    tablesChanged: number;
    objectsChanged: number;
  };
}
