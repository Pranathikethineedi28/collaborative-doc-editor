import path from "node:path";
import fs from "node:fs";
import { SCHEMA_SQL, seed } from "./schema";

/**
 * Minimal database adapter. Both backends speak the same Postgres dialect and
 * `$1` placeholders, so the rest of the app writes plain SQL once.
 *
 *  - DATABASE_URL set  -> node-postgres Pool (hosted Postgres, e.g. Neon)
 *  - DATABASE_URL unset -> PGlite (embedded WASM Postgres) persisted to ./.data
 *  - tests              -> in-memory PGlite via createMemoryDb()
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run fn inside a transaction. */
  tx<R>(fn: (db: Db) => Promise<R>): Promise<R>;
}

type PGliteLike = {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<R>(fn: (tx: { query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> }) => Promise<R>): Promise<R>;
};

function wrapPglite(pg: PGliteLike): Db {
  return {
    async query(sql, params = []) {
      return (await pg.query(sql, params)).rows as never;
    },
    tx(fn) {
      return pg.transaction((t) =>
        fn({
          query: async (sql, params = []) => (await t.query(sql, params)).rows as never,
          tx: () => {
            throw new Error("Nested transactions are not supported");
          },
        }),
      );
    },
  };
}

async function createPgDb(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const needsSsl = !/localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  const db: Db = {
    async query(sql, params = []) {
      return (await pool.query(sql, params)).rows;
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async (sql, params = []) => (await client.query(sql, params)).rows,
          tx: () => {
            throw new Error("Nested transactions are not supported");
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
  await pool.query(SCHEMA_SQL);
  return db;
}

async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.exec(SCHEMA_SQL);
  return wrapPglite(pg as unknown as PGliteLike);
}

/** Fresh, seeded, in-memory database. Used by tests. */
export async function createMemoryDb({ withSeed = true } = {}): Promise<Db> {
  const db = await createPgliteDb();
  if (withSeed) await seed(db);
  return db;
}

// Cache on globalThis so Next.js dev hot-reloads don't open a new DB each time.
const g = globalThis as unknown as { __ajaiaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__ajaiaDb) {
    g.__ajaiaDb = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url && process.env.VERCEL) {
        // Serverless file systems are read-only/ephemeral: fail loudly instead of losing data.
        throw new Error("DATABASE_URL must be set when deployed (see README > Deploy).");
      }
      const db = url
        ? await createPgDb(url)
        : await createPgliteDb(process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"));
      await seed(db);
      return db;
    })().catch((err) => {
      g.__ajaiaDb = undefined; // allow retry on next request
      throw err;
    });
  }
  return g.__ajaiaDb;
}

/** Test hook: point the app at a specific database. */
export function setDbForTests(db: Db) {
  g.__ajaiaDb = Promise.resolve(db);
}
