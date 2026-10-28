import { createDb, type Database } from "@kridora/db";
import type { Env } from "../types";

/**
 * Structural interface compatible with both Hono's `c.executionCtx`
 * and Cloudflare Workers' `ExecutionContext` / `DurableObjectState`.
 */
export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export function resolveDbUrl(env: Env): string {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }
  return connectionString;
}

/**
 * Creates a lazy per-request DB handle whose pool is only opened if a route
 * actually queries Postgres, and cleanly closed after the response finishes.
 */
export function createScopedDbAccessor(env: Env): {
  getDb: () => Database;
  dispose: (ctx?: WaitUntilContext) => Promise<void>;
} {
  let instance: ReturnType<typeof createDb> | null = null;

  return {
    getDb() {
      if (!instance) {
        instance = createDb(resolveDbUrl(env), { max: 2 });
      }
      return instance.db;
    },
    async dispose(ctx?: WaitUntilContext) {
      if (!instance) return;
      const poolToClose = instance.pool;
      instance = null;
      const closePromise = poolToClose.end().catch(() => undefined);
      if (ctx) {
        ctx.waitUntil(closePromise);
      } else {
        await closePromise;
      }
    },
  };
}

/**
 * Executes a short-lived database task (e.g. inside a Durable Object) and
 * guarantees the connection pool is closed in `finally`.
 */
export async function withDb<T>(
  env: Env,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const { db, pool } = createDb(resolveDbUrl(env), { max: 1 });
  try {
    return await fn(db);
  } finally {
    await pool.end().catch(() => undefined);
  }
}
