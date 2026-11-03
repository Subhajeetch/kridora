import { discardGuestAccount } from "@kridora/db";
import { Hono } from "hono";
import { createAuth } from "../../lib/auth";
import { invalidateSessionCache } from "../../middleware/security";
import { evictUserFromHub } from "../../realtime/hub-client";
import type { AppContext } from "../../types";

export const authRoutes = new Hono<AppContext>();

// Intercept sign-out to perform thorough guest account cleanup & realtime eviction
authRoutes.post("/auth/sign-out", async (c) => {
  const db = c.get("getDb")();
  const auth = createAuth(db, c.env);

  // 1. Resolve current session before sign-out consumes/deletes it
  let currentUserId: string | null = null;
  let isGuest = false;

  try {
    const sessionRes = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (sessionRes?.user) {
      currentUserId = sessionRes.user.id;
      isGuest = Boolean(
        (sessionRes.user as { isAnonymous?: boolean }).isAnonymous,
      );
    }
  } catch {
    // Unauthenticated or already expired
  }

  // 2. Perform Better Auth sign out (clears cookies, session row, etc.)
  const response = await auth.handler(c.req.raw);

  // 3. Invalidate API in-memory session cache
  invalidateSessionCache();

  // 4. Terminate any active WebSocket sessions & leave rooms
  if (currentUserId) {
    try {
      await evictUserFromHub(c.env, currentUserId);
    } catch (err) {
      console.error("[auth] Failed to evict user from hub on sign-out:", err);
    }

    // 5. If this was an anonymous guest account, completely purge all guest data
    if (isGuest) {
      try {
        await discardGuestAccount(db, currentUserId);
      } catch (err) {
        console.error("[auth] Failed to discard guest account on sign-out:", err);
      }
    }
  }

  return response;
});

authRoutes.on(["GET", "POST"], "/auth/*", async (c) => {
  const auth = createAuth(c.get("getDb")(), c.env);
  return auth.handler(c.req.raw);
});
