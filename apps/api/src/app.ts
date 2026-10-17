import autoload from "@fastify/autoload";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import path from "node:path";
import { env } from "./env";
import { httpStatusFor, toErrorPayload } from "./lib/errors";
import { redis } from "./lib/redis-client";
import sessionPlugin from "./plugins/session";

//building the app
export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Never write credentials or cookies to logs.
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
    },
    // Only trust X-Forwarded-* headers when we are really behind our own proxy.
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 100 * 1024,
  });

  app.register(helmet);
  app.register(cors, { origin: [env.APP_URL], credentials: true });
  app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    redis,
    nameSpace: "kridora:rl:",
  });
  app.register(sessionPlugin);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.setErrorHandler((err, request, reply) => {
    const error = err as { statusCode?: number; validation?: unknown };
    // Fastify's own 4xx errors (bad JSON, payload too large, rate limit...) keep their status.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      const rateLimited = error.statusCode === 429;
      return reply.code(error.statusCode).send({
        error: {
          code: rateLimited ? "RATE_LIMITED" : "VALIDATION_ERROR",
          message: rateLimited ? "Too many requests. Slow down." : "Invalid request",
        },
      });
    }
    const { payload, unexpected } = toErrorPayload(err);
    if (unexpected) request.log.error({ err }, "unhandled error");
    return reply.code(httpStatusFor(payload.code)).send({ error: payload });
  });

  app.register(autoload, {
    dir: path.join(import.meta.dirname, "routes"),
  });

  return app;
}
