import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export interface CreateDbOptions {
  /** Maximum pooled connections (default 10). */
  max?: number;
}

export function createDb(
  connectionString: string,
  options: CreateDbOptions = {},
) {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // An error on an idle pooled client would otherwise crash the process.
  pool.on("error", (err: unknown, client?: unknown) => {
    const error = err as (Error & { code?: string }) | undefined;
    const clientState = client as
      { _ending?: boolean; _ended?: boolean } | undefined;

    // Suppress benign socket closure notifications triggered by intentional teardown
    // or standard Cloudflare Workers / serverless socket disconnects.
    if (
      clientState?._ending ||
      clientState?._ended ||
      error?.message?.includes("This socket has been closed") ||
      error?.message?.includes("socket has been closed") ||
      error?.code === "ECONNRESET" ||
      error?.code === "EPIPE"
    ) {
      return;
    }

    console.error("[db] unexpected error on idle client", err);
  });

  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>["db"];
