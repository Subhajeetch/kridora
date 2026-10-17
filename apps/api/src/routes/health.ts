import type { FastifyPluginAsync } from "fastify";
import { pool } from "../lib/db";
import { redis } from "../lib/redis-client";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  /** Liveness: the process is up. */
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  /** Readiness: dependencies are reachable. Use this for load balancer / orchestrator checks. */
  fastify.get("/ready", async (_request, reply) => {
    try {
      await Promise.all([pool.query("select 1"), redis.ping()]);
      return { status: "ready" };
    } catch (err) {
      fastify.log.error({ err }, "readiness check failed");
      return reply.code(503).send({ status: "unavailable" });
    }
  });
};

export default healthRoute;
