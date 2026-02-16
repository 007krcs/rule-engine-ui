export type QueryRow = Record<string, unknown>;

export interface QueryResult<T extends QueryRow = QueryRow> {
  rows: T[];
  rowCount: number;
}

export interface SqlClient {
  query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  release(): void;
}

export interface SqlPool {
  query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
  connect(): Promise<SqlClient>;
  end(): Promise<void>;
}

type PgLikeQueryResult<T extends QueryRow = QueryRow> = {
  rows: T[];
  rowCount: number | null;
};

type PgLikeClient = {
  query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<PgLikeQueryResult<T>>;
  release(): void;
};

type PgLikePool = {
  query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<PgLikeQueryResult<T>>;
  connect(): Promise<PgLikeClient>;
  end(): Promise<void>;
};

type PgLikeModule = {
  Pool: new (options: { connectionString: string; max?: number; ssl?: unknown }) => PgLikePool;
};

function toResult<T extends QueryRow>(result: PgLikeQueryResult<T>): QueryResult<T> {
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
  };
}

export async function createSqlPoolFromPg(options: {
  connectionString: string;
  max?: number;
  ssl?: unknown;
}): Promise<SqlPool> {
  const moduleName = 'pg';
  let pg: PgLikeModule;
  try {
    pg = (await import(moduleName)) as unknown as PgLikeModule;
  } catch (error) {
    throw new Error(
      `Postgres persistence requires the "pg" package. Install it in the workspace before enabling DATABASE_URL. (${String(error)})`,
    );
  }
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    max: options.max,
    ssl: options.ssl,
  });

  return {
    async query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
      return toResult(await pool.query<T>(sql, params));
    },
    async connect(): Promise<SqlClient> {
      const client = await pool.connect();
      return {
        async query<T extends QueryRow = QueryRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
          return toResult(await client.query<T>(sql, params));
        },
        release(): void {
          client.release();
        },
      };
    },
    async end(): Promise<void> {
      await pool.end();
    },
  };
}
