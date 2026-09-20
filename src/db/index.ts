import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool {
  const match = databaseUrl!.match(
    /^postgresql?:\/\/([^:]+):([^@]*)@(.+):(\d+)\/(.+)$/,
  );
  if (match) {
    return new Pool({
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
      ssl: { rejectUnauthorized: false },
    });
  }
  return new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
}

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
