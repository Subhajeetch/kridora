import { ensureProfile, eq, schema } from "@kridora/db";
import { displayNameSchema, levelFromXp } from "@kridora/shared";
import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "../../lib/errors";
import {
  invalidateSessionCache,
  requireAuth,
  sessionMiddleware,
} from "../../middleware/security";
import { checkNameRateLimitAndSyncHub } from "../../realtime/hub-client";
import type { AppContext } from "../../types";

export const meRoutes = new Hono<AppContext>();

meRoutes.use("/me/*", sessionMiddleware);
meRoutes.use("/me", sessionMiddleware);

meRoutes.get("/me", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = c.get("getDb")();
  const profile = await ensureProfile(db, user.id);

  const isVerifiedAccount = !user.isAnonymous && user.emailVerified;
  const xp = isVerifiedAccount ? profile.xp : null;
  const level = isVerifiedAccount ? levelFromXp(profile.xp) : null;

  return c.json({
    user: {
      id: user.id,
      numericId: profile.numericId,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      email: user.isAnonymous ? null : user.email,
      emailVerified: user.emailVerified,
    },
    profile: {
      numericId: profile.numericId,
      rings: profile.ringsBalance,
      xp,
      level,
      gamesPlayed: profile.gamesPlayed,
      gamesWon: profile.gamesWon,
    },
  });
});

const updateNameSchema = z.object({
  userId: z.string().optional(),
  name: displayNameSchema,
});

meRoutes.patch("/me/name", requireAuth, async (c) => {
  const user = c.get("user")!;
  const rawBody = await c.req.json().catch(() => null);
  const parsed = updateNameSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid display name.",
    );
  }

  if (parsed.data.userId && parsed.data.userId !== user.id) {
    throw new ApiError(
      "FORBIDDEN",
      "You do not have permission to modify another player's profile.",
    );
  }

  const rateCheck = await checkNameRateLimitAndSyncHub(
    c.env,
    user.id,
    parsed.data.name,
  );
  if (!rateCheck.allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      "You are changing your name too quickly. Please wait a few seconds.",
    );
  }

  const db = c.get("getDb")();
  await db
    .update(schema.user)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(schema.user.id, user.id));

  invalidateSessionCache();

  return c.json({ ok: true, name: parsed.data.name });
});
