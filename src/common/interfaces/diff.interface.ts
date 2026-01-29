export interface IDiffOperation {
  type: 'ADD' | 'DROP' | 'MODIFY';
  target: 'TABLE' | 'COLUMN' | 'INDEX' | 'TRIGGER' | 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'EVENT';
  name: string;
  tableName?: string; // For column/index
  definition?: string; // For ADD/MODIFY
  oldDefinition?: string; // For MODIFY (comparison)
}

export interface ITableDiff {
  tableName: string;
  operations: IDiffOperation[];
  hasChanges: boolean;
}

export interface IObjectDiff {
  name: string;
  type: 'VIEW' | 'PROCEDURE' | 'FUNCTION' | 'TRIGGER' | 'EVENT';
  operation: 'CREATE' | 'DROP' | 'REPLACE';
  definition?: string;
}

export interface ISchemaDiff {
  tables: Record<string, ITableDiff>; // tableName -> diff
  droppedTables: string[]; // List of dropped table names
  objects: IObjectDiff[]; // Views, Procedures, etc.
  summary: {
    totalChanges: number;
    tablesChanged: number;
    objectsChanged: number;
  };
}
