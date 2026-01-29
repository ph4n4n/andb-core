export interface IDatabaseConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  socketPath?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface IDatabaseDriver {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Execute a raw query
   * @param sql SQL query string
   * @param params Query parameters
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(sql: string, params?: any[]): Promise<T>;

  /**
   * Get the Introspection Service for this driver
   */
  getIntrospectionService(): IIntrospectionService;

  /**
   * Get the Monitoring Service for this driver
   */
  getMonitoringService(): IMonitoringService;

  /**
   * Get the session context (sql_mode, time_zone, etc.)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionContext(): Promise<any>;

  /**
   * Enable or disable foreign key checks for the current session
   * @param enabled
   */
  setForeignKeyChecks(enabled: boolean): Promise<void>;
}

export interface IIntrospectionService {
  listTables(dbName: string): Promise<string[]>;
  listViews(dbName: string): Promise<string[]>;
  listProcedures(dbName: string): Promise<string[]>;
  listFunctions(dbName: string): Promise<string[]>;
  listTriggers(dbName: string): Promise<string[]>;
  listEvents(dbName: string): Promise<string[]>;

  getTableDDL(dbName: string, tableName: string): Promise<string>;
  getViewDDL(dbName: string, viewName: string): Promise<string>;
  getProcedureDDL(dbName: string, procName: string): Promise<string>;
  getFunctionDDL(dbName: string, funcName: string): Promise<string>;
  getTriggerDDL(dbName: string, triggerName: string): Promise<string>;
  getEventDDL(dbName: string, eventName: string): Promise<string>;

  getChecksums(dbName: string): Promise<Record<string, string>>;
}

export interface IMonitoringService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProcessList(): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getStatus(): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVariables(): Promise<any>;
  getVersion(): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConnections(): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTransactions(): Promise<any>;
}
