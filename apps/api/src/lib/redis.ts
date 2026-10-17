import { Redis } from "ioredis";

export function createRedis(url: string, name: string): Redis {
  const client = new Redis(url, {
    connectionName: `kridora:${name}`,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on("error", (err) => {
    console.error(`[redis:${name}]`, err.message);
  });
  return client;
}
