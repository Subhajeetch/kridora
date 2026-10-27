import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client";

// In local development, load repo-root .env if present.
// In production (Render/CI), environment variables in process.env are used directly.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const { db, pool } = createDb(url, { max: 1 });

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  console.log("Migrations applied");
} catch (err) {
  console.error("Migration failed", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
