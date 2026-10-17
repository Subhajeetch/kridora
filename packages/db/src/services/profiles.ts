import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { playerProfiles, type PlayerProfile } from "../schema";

/** Returns the user's profile, creating it on first access. Safe to call concurrently. */
export async function ensureProfile(db: Database, userId: string): Promise<PlayerProfile> {
  await db.insert(playerProfiles).values({ userId }).onConflictDoNothing();
  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1);
  if (!profile) throw new Error(`Profile for user ${userId} could not be created`);
  return profile;
}
