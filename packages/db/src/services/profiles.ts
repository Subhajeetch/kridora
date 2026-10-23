import { eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { playerProfiles, user, type PlayerProfile } from "../schema";

/** Returns the user's profile, creating it on first access. Safe to call concurrently. */
export async function ensureProfile(db: Database, userId: string): Promise<PlayerProfile> {
  await db.insert(playerProfiles).values({ userId }).onConflictDoNothing();
  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1);
  if (!profile) throw new Error(`Profile for user ${userId} could not be created`);
  return profile;
}

/**
 * Grants XP to a player profile.
 * Only verified accounts (with an email) receive XP and level progression.
 * Guest accounts and unverified accounts are skipped.
 */
export async function grantXp(
  db: Database,
  userId: string,
  amount: number,
): Promise<{ awarded: boolean; newXp: number }> {
  if (amount <= 0) return { awarded: false, newXp: 0 };

  const [u] = await db
    .select({ isAnonymous: user.isAnonymous, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!u || u.isAnonymous || !u.emailVerified) {
    const profile = await ensureProfile(db, userId);
    return { awarded: false, newXp: profile.xp };
  }

  const [updated] = await db
    .update(playerProfiles)
    .set({
      xp: sql`${playerProfiles.xp} + ${amount}`,
    })
    .where(eq(playerProfiles.userId, userId))
    .returning({ xp: playerProfiles.xp });

  return { awarded: true, newXp: updated ? updated.xp : 0 };
}
