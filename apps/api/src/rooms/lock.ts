import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import { AppError } from "../lib/errors";
import { keys } from "./store";

const LOCK_TTL_MS = 10_000;
const LOCK_WAIT_MS = 3_000;

const RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Per-room distributed mutex. Every read-modify-write of a room happens inside it, so two players
 * joining at the same moment (or a disconnect racing a kick) can never overwrite each other.
 */
export function createRoomLock(redis: Redis) {
  return async function withRoomLock<T>(
    code: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = keys.lock(code);
    const token = randomUUID();
    const giveUpAt = Date.now() + LOCK_WAIT_MS;

    for (;;) {
      const acquired = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
      if (acquired === "OK") break;
      if (Date.now() > giveUpAt)
        throw new AppError(
          "ROOM_BUSY",
          "The room is busy. Try again in a moment.",
        );
      await sleep(25 + Math.floor(Math.random() * 25));
    }

    try {
      return await fn();
    } finally {
      await redis.eval(RELEASE, 1, key, token).catch(() => undefined);
    }
  };
}
