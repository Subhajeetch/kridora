import { Hono } from "hono";
import { createAuth } from "../../lib/auth";
import type { AppContext } from "../../types";

export const authRoutes = new Hono<AppContext>();

authRoutes.on(["GET", "POST"], "/auth/*", async (c) => {
  const auth = createAuth(c.get("getDb")(), c.env);
  return auth.handler(c.req.raw);
});
