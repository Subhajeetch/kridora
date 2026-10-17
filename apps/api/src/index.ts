// Must stay the first import: it validates the environment and exits early with a clear message.
import { env } from "./env";
import { buildApp } from "./app";
import { deleteStaleGuests } from "./jobs/cleanup";
import { pool } from "./lib/db";
import { redis } from "./lib/redis-client";
import { createRealtime } from "./realtime/server";

const GUEST_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function main() {
  const app = buildApp();
  await app.ready();

  const realtime = createRealtime(app);

  const cleanupTimer = setInterval(() => {
    deleteStaleGuests()
      .then((count) => {
        if (count > 0) app.log.info({ count }, "removed stale guest accounts");
      })
      .catch((err) => app.log.error({ err }, "guest cleanup failed"));
  }, GUEST_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    clearInterval(cleanupTimer);
    try {
      await realtime.close();
      await app.close();
      await redis.quit();
      await pool.end();
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exitCode = 1;
    }
    process.exit();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
