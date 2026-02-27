declare module "pg" {
  export interface QueryResult<R = unknown> {
    rows: R[];
  }

  export class Pool {
    constructor(options?: { connectionString?: string });
    query<R = unknown>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
  }
}
