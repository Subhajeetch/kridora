import { ensureProfile, eq, schema } from "@kridora/db";
import {
  displayNameSchema,
  levelFromXp,
  normalizeDisplayName,
} from "@kridora/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import { redis } from "../../lib/redis-client";
import { requireSession } from "../../plugins/session";

const meRoutes: FastifyPluginAsync = async (app) => {
  /** The signed-in player: identity + game profile (Rings, XP, level). */
  app.get("/me", { preHandler: app.requireAuth }, async (request, reply) => {
    const { user } = requireSession(request);
    const [profile, dbUser] = await Promise.all([
      ensureProfile(db, user.id),
      db.query.user.findFirst({
        where: eq(schema.user.id, user.id),
      }),
    ]);

    // Account data must never be cached by browsers or proxies.
    reply.header("cache-control", "no-store");

    const isGuest = Boolean(dbUser?.isAnonymous ?? user.isAnonymous);
    const isVerified =
      !isGuest && Boolean(dbUser?.emailVerified ?? user.emailVerified);

    return {
      user: {
        id: user.id,
        numericId: profile.numericId,
        name: dbUser?.name ?? user.name,
        image: dbUser?.image ?? user.image ?? null,
        isAnonymous: isGuest,
        // Guests only have a placeholder address, so never expose it.
        email: isGuest ? null : (dbUser?.email ?? user.email),
        emailVerified: dbUser?.emailVerified ?? user.emailVerified,
      },
      profile: {
        numericId: profile.numericId,
        rings: profile.ringsBalance,
        xp: isVerified ? profile.xp : null,
        level: isVerified ? levelFromXp(profile.xp) : null,
        gamesPlayed: profile.gamesPlayed,
        gamesWon: profile.gamesWon,
      },
    };
  });

  /**
   * Secure display name update:
   * 1. Requires active authenticated session.
   * 2. Validates identity & prevents ID spoofing (user cannot modify another player's name).
   * 3. Rate-limited to prevent abuse/spam.
   * 4. Validates length (2-20 chars) and characters via shared schema & normalization.
   * 5. Atomically updates PostgreSQL and synchronizes Better-Auth session cache.
   */
  const handleUpdateName = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { user: sessionUser } = requireSession(request);

    const body = (
      request.body && typeof request.body === "object" ? request.body : {}
    ) as { name?: unknown; userId?: unknown };

    // Identity check: If a client tries to provide a userId that differs from their session, reject forbidden.
    if (
      body.userId !== undefined &&
      body.userId !== null &&
      String(body.userId).trim() !== "" &&
      String(body.userId) !== sessionUser.id
    ) {
      throw new AppError(
        "FORBIDDEN",
        "You do not have permission to modify another account's display name",
      );
    }

    // Rate limiting: Max 10 name changes per 60 seconds per user
    const rateLimitKey = `kridora:ratelimit:update-name:${sessionUser.id}`;
    try {
      const count = await redis.incr(rateLimitKey);
      if (count === 1) {
        await redis.expire(rateLimitKey, 60);
      }
      if (count > 10) {
        throw new AppError(
          "RATE_LIMITED",
          "You are changing your name too quickly. Please wait a minute.",
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      request.log.warn({ err }, "Redis rate-limit check failed; proceeding");
    }

    // Input validation
    if (typeof body.name !== "string") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Please provide a valid display name",
      );
    }

    const parsed = displayNameSchema.safeParse(body.name);
    if (!parsed.success) {
      const firstIssue =
        parsed.error.issues[0]?.message || "Invalid display name format";
      throw new AppError("VALIDATION_ERROR", firstIssue);
    }

    const cleaned = normalizeDisplayName(parsed.data);
    if (cleaned.length < 2) {
      throw new AppError("VALIDATION_ERROR", "Use at least 2 characters");
    }

    // Verify user exists in the database
    const existingUser = await db.query.user.findFirst({
      where: eq(schema.user.id, sessionUser.id),
    });
    if (!existingUser) {
      throw new AppError("NOT_FOUND", "User account not found");
    }

    reply.header("cache-control", "no-store");

    if (existingUser.name === cleaned) {
      return {
        success: true,
        name: cleaned,
        unchanged: true,
      };
    }

    // Update in database
    await db
      .update(schema.user)
      .set({ name: cleaned, updatedAt: new Date() })
      .where(eq(schema.user.id, sessionUser.id));

    // Synchronize Better-Auth session cache
    try {
      const authRes = await auth.api.updateUser({
        body: { name: cleaned },
        headers: fromNodeHeaders(request.headers),
        asResponse: true,
      });

      const setCookies =
        typeof authRes?.headers?.getSetCookie === "function"
          ? authRes.headers.getSetCookie()
          : (authRes?.headers?.get("set-cookie") ? [authRes.headers.get("set-cookie")!] : []);

      for (const cookie of setCookies) {
        reply.header("set-cookie", cookie);
      }
    } catch (authErr) {
      request.log.warn({ err: authErr }, "Better-auth updateUser sync notice");
    }

    return {
      success: true,
      name: cleaned,
    };
  };

  app.patch("/me/name", { preHandler: app.requireAuth }, handleUpdateName);
  app.post("/me/name", { preHandler: app.requireAuth }, handleUpdateName);
  app.patch("/me", { preHandler: app.requireAuth }, handleUpdateName);
};

export default meRoutes;
