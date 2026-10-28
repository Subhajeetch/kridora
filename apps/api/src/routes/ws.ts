import type { SocketUser } from "@kridora/shared";
import { Hono } from "hono";
import {
  generateSecureToken,
  hashClientIp,
  signWsTicket,
  verifyWsTicket,
} from "../lib/crypto";
import { ApiError } from "../lib/errors";
import { requireAuth, sessionMiddleware } from "../middleware/security";
import {
  consumeWsTicketNonce,
  upgradeWebSocketInHub,
} from "../realtime/hub-client";
import type { AppContext } from "../types";

export const wsRoutes = new Hono<AppContext>();

function normalizeIp(ip: string): string {
  const clean = ip.trim().toLowerCase();
  if (
    clean === "::1" ||
    clean === "127.0.0.1" ||
    clean === "localhost" ||
    clean.startsWith("::ffff:127.0.0.1")
  ) {
    return "127.0.0.1";
  }
  return clean;
}

function extractClientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  return normalizeIp(
    c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "local",
  );
}

wsRoutes.post("/api/ws-ticket", sessionMiddleware, requireAuth, async (c) => {
  const user = c.get("user")!;
  const ipHash = await hashClientIp(
    extractClientIp(c),
    c.env.BETTER_AUTH_SECRET,
  );

  const ticket = await signWsTicket(
    {
      sub: user.id,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      ipHash,
      nonce: generateSecureToken(12),
      exp: Date.now() + 30_000,
    },
    c.env.BETTER_AUTH_SECRET,
  );

  return c.json({ ticket });
});

wsRoutes.get("/ws", sessionMiddleware, async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    throw new ApiError(
      "VALIDATION_ERROR",
      "Expected a WebSocket Upgrade request.",
    );
  }

  let socketUser: SocketUser | null = null;
  const ticketParam = c.req.query("ticket");

  // 1. Primary: Verify single-use HMAC ticket bound to client IP hash
  if (ticketParam) {
    const claims = await verifyWsTicket(ticketParam, c.env.BETTER_AUTH_SECRET);
    if (claims) {
      const currentIpHash = await hashClientIp(
        extractClientIp(c),
        c.env.BETTER_AUTH_SECRET,
      );
      const isDev = c.env.NODE_ENV === "development";
      if (claims.ipHash === currentIpHash || isDev) {
        const consumed = await consumeWsTicketNonce(
          c.env,
          claims.nonce,
          claims.exp,
        );
        if (consumed) {
          socketUser = {
            id: claims.sub,
            name: claims.name,
            image: claims.image,
            isAnonymous: claims.isAnonymous,
          };
        }
      }
    }
  }

  // 2. Fallback: Verified Better Auth session cookie
  if (!socketUser) {
    const sessionUser = c.get("user");
    if (sessionUser) {
      socketUser = {
        id: sessionUser.id,
        name: sessionUser.name,
        image: sessionUser.image,
        isAnonymous: sessionUser.isAnonymous,
      };
    }
  }

  if (!socketUser) {
    throw new ApiError(
      "UNAUTHENTICATED",
      "WebSocket authentication failed. Please sign in again.",
    );
  }

  return upgradeWebSocketInHub(c.env, c.req.raw, socketUser);
});
