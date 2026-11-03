import type { Context, MiddlewareHandler } from "hono";
import { createAuth, getAllowedOrigins } from "../lib/auth";
import { createScopedDbAccessor, type WaitUntilContext } from "../lib/db";
import { ApiError } from "../lib/errors";
import type { AppContext, AuthSession, AuthSessionUser } from "../types";

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

export function extractSessionToken(headers: Headers): string | null {
  const authHeader = headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookie = headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/,
  );
  if (match && match[1]) {
    const raw = decodeURIComponent(match[1]);
    return raw.split(".")[0] ?? raw;
  }
  return null;
}

interface CachedSession {
  user: AuthSessionUser;
  session: AuthSession;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 45_000; // 45 seconds cache to eliminate repetitive Postgres hits
const MAX_CACHE_ENTRIES = 500;

export function invalidateSessionCache(token?: string): void {
  if (token) {
    sessionCache.delete(token);
  } else {
    sessionCache.clear();
  }
}

export async function resolveSessionFromRequest(
  c: Context<AppContext>,
): Promise<{ user: AuthSessionUser; session: AuthSession } | null> {
  const existingUser = c.get("user");
  const existingSession = c.get("session");
  if (existingUser && existingSession) {
    return { user: existingUser, session: existingSession };
  }

  const token = extractSessionToken(c.req.raw.headers);
  if (token) {
    const cached = sessionCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      c.set("user", cached.user);
      c.set("session", cached.session);
      return { user: cached.user, session: cached.session };
    }
  }

  const cookieHeader = c.req.header("Cookie");
  const authHeader = c.req.header("Authorization");
  if (!cookieHeader && !authHeader) {
    return null;
  }

  try {
    const auth = createAuth(c.get("getDb")(), c.env);
    const result = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (result?.user && result?.session) {
      const user: AuthSessionUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        emailVerified: Boolean(result.user.emailVerified),
        image: result.user.image ?? null,
        isAnonymous: Boolean(
          (result.user as { isAnonymous?: boolean }).isAnonymous,
        ),
        role: (result.user as { role?: string }).role ?? "user",
      };
      const session: AuthSession = {
        id: result.session.id,
        userId: result.session.userId,
        token: result.session.token,
        expiresAt: new Date(result.session.expiresAt),
      };

      c.set("user", user);
      c.set("session", session);

      const cacheKey = token || session.token;
      if (cacheKey) {
        if (sessionCache.size >= MAX_CACHE_ENTRIES) {
          const now = Date.now();
          for (const [k, v] of sessionCache.entries()) {
            if (v.expiresAt <= now) sessionCache.delete(k);
          }
          if (sessionCache.size >= MAX_CACHE_ENTRIES) {
            sessionCache.clear();
          }
        }
        sessionCache.set(cacheKey, {
          user,
          session,
          expiresAt: Math.min(
            Date.now() + SESSION_CACHE_TTL_MS,
            session.expiresAt.getTime(),
          ),
        });
      }
      return { user, session };
    }
  } catch {
    // Unauthenticated or expired session
  }
  return null;
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
  await resolveSessionFromRequest(c);
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
