import type { MiddlewareHandler } from "hono";
import { createAuth, getAllowedOrigins } from "../lib/auth";
import { createScopedDbAccessor, type WaitUntilContext } from "../lib/db";
import { ApiError } from "../lib/errors";
import type { AppContext } from "../types";

function getWaitUntilCtx(c: {
  executionCtx: WaitUntilContext;
}): WaitUntilContext | undefined {
  try {
    const ctx = c.executionCtx;
    return typeof ctx?.waitUntil === "function" ? ctx : undefined;
  } catch {
    return undefined;
  }
}

export const contextMiddleware: MiddlewareHandler<AppContext> = async (
  c,
  next,
) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);

  const dbScope = createScopedDbAccessor(c.env);
  c.set("getDb", dbScope.getDb);
  c.set("user", null);
  c.set("session", null);

  try {
    await next();
  } finally {
    await dbScope.dispose(getWaitUntilCtx(c));
  }
};

export const originGuardMiddleware: MiddlewareHandler<AppContext> = async (
  c,
  next,
) => {
  const method = c.req.method.toUpperCase();
  const origin = c.req.header("Origin");
  const isUpgrade = c.req.header("Upgrade")?.toLowerCase() === "websocket";

  if (
    isUpgrade ||
    (method !== "GET" && method !== "HEAD" && method !== "OPTIONS")
  ) {
    if (origin) {
      const allowed = getAllowedOrigins(c.env);
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (!allowed.includes(normalizedOrigin)) {
        throw new ApiError(
          "FORBIDDEN",
          "Cross-origin request rejected by security policy.",
        );
      }
    } else if (isUpgrade && c.env.NODE_ENV === "production") {
      throw new ApiError(
        "FORBIDDEN",
        "WebSocket upgrade requires a valid Origin header.",
      );
    }
  }
  await next();
};

export const sessionMiddleware: MiddlewareHandler<AppContext> = async (
  c,
  next,
) => {
  const cookieHeader = c.req.header("Cookie");
  const authHeader = c.req.header("Authorization");

  // Skip DB lookup completely when the request carries no credentials
  if (cookieHeader || authHeader) {
    try {
      const auth = createAuth(c.get("getDb")(), c.env);
      const result = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      if (result?.user && result?.session) {
        c.set("user", {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          emailVerified: Boolean(result.user.emailVerified),
          image: result.user.image ?? null,
          isAnonymous: Boolean(
            (result.user as { isAnonymous?: boolean }).isAnonymous,
          ),
          role: (result.user as { role?: string }).role ?? "user",
        });
        c.set("session", {
          id: result.session.id,
          userId: result.session.userId,
          token: result.session.token,
          expiresAt: new Date(result.session.expiresAt),
        });
      }
    } catch {
      // Unauthenticated or expired session; requireAuth enforces access downstream
    }
  }
  await next();
};

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  if (!c.get("user")) {
    throw new ApiError(
      "UNAUTHENTICATED",
      "Please sign in or start a guest session to continue.",
    );
  }
  await next();
};
