import { env } from "../env";
import { createRedis } from "./redis";

/** Shared command connection (rooms, locks, rate limits, auth secondary storage). */
export const redis = createRedis(env.REDIS_URL, "main");
