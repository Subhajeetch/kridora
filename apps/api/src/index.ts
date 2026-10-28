import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { getAllowedOrigins } from "./lib/auth";
import { handleHttpError } from "./lib/errors";
import {
  contextMiddleware,
  originGuardMiddleware,
} from "./middleware/security";
import { RealtimeHub } from "./realtime/RealtimeHub";
import { routes } from "./routes";
import type { AppContext } from "./types";

const app = new Hono<AppContext>();

app.use(
  "*",
  secureHeaders({
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

app.use("*", async (c, next) => {
  const allowedOrigins = getAllowedOrigins(c.env);
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0] ?? "";
      const clean = origin.replace(/\/+$/, "");
      return allowedOrigins.includes(clean) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposeHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 86400,
  });
  return corsMiddleware(c, next);
});

app.use("*", contextMiddleware);
app.use("*", originGuardMiddleware);

app.route("/", routes);

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found.`,
      },
    },
    404,
  );
});

app.onError((err, c) => handleHttpError(err, c));

export { RealtimeHub };
export default app;
