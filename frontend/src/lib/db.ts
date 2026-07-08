import { Pool, type QueryResultRow } from "pg";

// Server-only (real TCP connections via `pg`) — call only from Server
// Components/Route Handlers, same rule as lib/covers.ts.

declare global {
  var __gamexsPgPool: Pool | undefined;
}

// Cached on globalThis so Turbopack's dev-mode module reloads reuse the same
// pool instead of opening a fresh one on every hot reload.
const pool = globalThis.__gamexsPgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalThis.__gamexsPgPool = pool;
}

export function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}
