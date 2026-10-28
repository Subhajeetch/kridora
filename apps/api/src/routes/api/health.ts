import { Hono } from "hono";
import type { AppContext } from "../../types";

export const healthRoutes = new Hono<AppContext>();

healthRoutes.get("/health", (c) => {
  return c.json({
    ok: true,
    service: "kridora-api",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/config", (c) => {
  const googleEnabled = Boolean(
    c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET,
  );
  return c.json({ googleEnabled });
});
