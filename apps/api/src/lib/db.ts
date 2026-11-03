import { createDb, type Database } from "@kridora/db";
import type { Env } from "../types";

export interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void;
}

export function getDatabase(env: Env): Database {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding (DB) is required. Ensure 'DB' is configured in wrangler.jsonc.",
    );
  }
  return createDb(env.DB);
}

/**
 * Provides a database accessor for request contexts.
 * D1 runs natively in the Cloudflare Worker runtime without TCP connection overhead.
 */
export function createScopedDbAccessor(env: Env): {
  getDb: () => Database;
  dispose: (ctx?: WaitUntilContext) => Promise<void>;
} {
  let instance: Database | null = null;

  return {
    getDb() {
      if (!instance) {
        instance = getDatabase(env);
      }
      return instance;
    },
    async dispose() {
      // D1 is managed by Cloudflare runtime, no sockets or pools to close.
    },
  };
}

/**
 * Executes a database task (e.g. inside a Durable Object) using the native D1 binding.
 */
export async function withDb<T>(
  env: Env,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return fn(getDatabase(env));
}
