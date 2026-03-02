declare module "pg" {
  export interface QueryResult<R = unknown> {
    rows: R[];
  }

  export interface PoolClient {
    query<R = unknown>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }

  export class Pool {
    constructor(options?: { connectionString?: string; ssl?: unknown });
    query<R = unknown>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
  }
}
