import { createDb } from "@kridora/db";
import { env } from "../env";

export const { db, pool } = createDb(env.DATABASE_URL);
