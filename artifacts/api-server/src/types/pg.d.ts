declare module "pg" {
  export interface QueryResultRow { [column: string]: any; }
  export interface QueryResult<R extends QueryResultRow = any> {
    rows: R[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: any[];
  }
  export class PoolClient {
    query<R extends QueryResultRow = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
    release(err?: Error | boolean): void;
  }
  export interface PoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    ssl?: any;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R extends QueryResultRow = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
  export class Client {
    constructor(config?: PoolConfig);
    connect(): Promise<void>;
    query<R extends QueryResultRow = any>(sql: string, values?: any[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }
}
