import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = DrizzleD1Database<Schema>;

export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema, casing: "snake_case" });
}
