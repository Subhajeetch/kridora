import { ensureProfile } from "@kridora/db";
import { levelFromXp } from "@kridora/shared";
import type { FastifyPluginAsync } from "fastify";
import { db } from "../../lib/db";
import { requireSession } from "../../plugins/session";

const meRoutes: FastifyPluginAsync = async (app) => {
  /** The signed-in player: identity + game profile (Rings, XP, level). */
  app.get("/me", { preHandler: app.requireAuth }, async (request, reply) => {
    const { user } = requireSession(request);
    const profile = await ensureProfile(db, user.id);

    // Account data must never be cached by browsers or proxies.
    reply.header("cache-control", "no-store");

    return {
      user: {
        id: user.id,
        name: user.name,
        image: user.image ?? null,
        isAnonymous: Boolean(user.isAnonymous),
        // Guests only have a placeholder address, so never expose it.
        email: user.isAnonymous ? null : user.email,
        emailVerified: user.emailVerified,
      },
      profile: {
        rings: profile.ringsBalance,
        xp: profile.xp,
        level: levelFromXp(profile.xp),
        gamesPlayed: profile.gamesPlayed,
        gamesWon: profile.gamesWon,
      },
    };
  });
};

export default meRoutes;
