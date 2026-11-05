import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  account,
  matchPlayers,
  playerProfiles,
  ringTransactions,
  session,
  user,
  type PlayerProfile,
} from "../schema";

function generateNumericId(): string {
  // Generates 6 digits between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Returns the user's profile, creating it on first access. Automatically generates a unique numeric User ID. */
export async function ensureProfile(
  db: Database,
  userId: string,
): Promise<PlayerProfile> {
  const existing = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId))
    .limit(1);
  let profile = existing[0];

  if (!profile) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateNumericId();
      try {
        await db
          .insert(playerProfiles)
          .values({ userId, numericId: candidate })
          .onConflictDoNothing();
        const created = await db
          .select()
          .from(playerProfiles)
          .where(eq(playerProfiles.userId, userId))
          .limit(1);
        if (created[0]) {
          profile = created[0];
          break;
        }
      } catch {
        // Retry on unique constraint collision
      }
    }
  }

  // Backfill numericId if an existing row lacked it
  if (profile && !profile.numericId) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateNumericId();
      try {
        const [updated] = await db
          .update(playerProfiles)
          .set({ numericId: candidate })
          .where(
            and(
              eq(playerProfiles.userId, userId),
              sql`${playerProfiles.numericId} IS NULL`,
            ),
          )
          .returning();
        if (updated) {
          profile = updated;
          break;
        }
      } catch {
        // Retry on collision
      }
    }
  }

  if (!profile)
    throw new Error(`Profile for user ${userId} could not be created`);
  return profile;
}

/** Look up a player by their numeric User ID. */
export async function findUserByNumericId(
  db: Database,
  numericId: string,
): Promise<{
  userId: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  numericId: string;
} | null> {
  const cleanId = numericId.trim();
  if (!cleanId || !/^[0-9]{4,10}$/.test(cleanId)) return null;

  const [row] = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      numericId: playerProfiles.numericId,
    })
    .from(playerProfiles)
    .innerJoin(user, eq(playerProfiles.userId, user.id))
    .where(eq(playerProfiles.numericId, cleanId))
    .limit(1);

  if (!row || !row.numericId) return null;
  return {
    userId: row.userId,
    name: row.name,
    image: row.image,
    isAnonymous: Boolean(row.isAnonymous),
    numericId: row.numericId,
  };
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
    .select({
      isAnonymous: user.isAnonymous,
      emailVerified: user.emailVerified,
    })
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

/**
 * Merges a guest user's profile, numericId, ring transactions, and match history
 * into a newly created permanent user account.
 * Atomically removes the temporary guest user row and its sessions.
 */
export async function mergeGuestProfileIntoUser(
  db: Database,
  guestUserId: string,
  newUserId: string,
): Promise<void> {
  if (!guestUserId || !newUserId || guestUserId === newUserId) return;

  // 1. Fetch guest profile
  const [guestProfile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, guestUserId))
    .limit(1);

  if (guestProfile) {
    const guestNumericId = guestProfile.numericId;

    // Free the numericId from guestProfile first to prevent unique constraint conflict
    if (guestNumericId) {
      await db
        .update(playerProfiles)
        .set({ numericId: null })
        .where(eq(playerProfiles.userId, guestUserId));
    }

    // Check if new user profile already exists
    const [newProfile] = await db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, newUserId))
      .limit(1);

    if (newProfile) {
      // Update new user's profile: inherit guest numericId, add rings balance & stats
      await db
        .update(playerProfiles)
        .set({
          numericId: guestNumericId ?? newProfile.numericId,
          ringsBalance: sql`${playerProfiles.ringsBalance} + ${guestProfile.ringsBalance}`,
          lifetimeRingsEarned: sql`${playerProfiles.lifetimeRingsEarned} + ${guestProfile.lifetimeRingsEarned}`,
          lifetimeRingsSpent: sql`${playerProfiles.lifetimeRingsSpent} + ${guestProfile.lifetimeRingsSpent}`,
          xp: sql`${playerProfiles.xp} + ${guestProfile.xp}`,
          gamesPlayed: sql`${playerProfiles.gamesPlayed} + ${guestProfile.gamesPlayed}`,
          gamesWon: sql`${playerProfiles.gamesWon} + ${guestProfile.gamesWon}`,
          settings: {
            ...guestProfile.settings,
            ...newProfile.settings,
          },
        })
        .where(eq(playerProfiles.userId, newUserId));
    } else {
      // Insert new profile with merged values
      await db.insert(playerProfiles).values({
        userId: newUserId,
        numericId: guestNumericId,
        ringsBalance: guestProfile.ringsBalance,
        lifetimeRingsEarned: guestProfile.lifetimeRingsEarned,
        lifetimeRingsSpent: guestProfile.lifetimeRingsSpent,
        xp: guestProfile.xp,
        gamesPlayed: guestProfile.gamesPlayed,
        gamesWon: guestProfile.gamesWon,
        settings: guestProfile.settings,
      });
    }
  }

  // 2. Transfer ring transactions & match history, and clean up guest user atomically in a single batch
  await db.batch([
    db
      .update(ringTransactions)
      .set({ userId: newUserId })
      .where(eq(ringTransactions.userId, guestUserId)),
    db
      .update(matchPlayers)
      .set({ userId: newUserId })
      .where(eq(matchPlayers.userId, guestUserId)),
    db.delete(playerProfiles).where(eq(playerProfiles.userId, guestUserId)),
    db.delete(account).where(eq(account.userId, guestUserId)),
    db.delete(session).where(eq(session.userId, guestUserId)),
    db.delete(user).where(eq(user.id, guestUserId)),
  ]);
}

/**
 * Safely discards an anonymous guest account when a user logs into an existing account or signs out.
 * Completely clears profile, ring transactions, match associations, account credentials, sessions, and the user row.
 */
export async function discardGuestAccount(
  db: Database,
  guestUserId: string,
): Promise<void> {
  if (!guestUserId) return;

  await db.batch([
    // Delete ephemeral guest ring transactions so onDelete: restrict doesn't block deletion
    db.delete(ringTransactions).where(eq(ringTransactions.userId, guestUserId)),
    // Dissociate match_players
    db
      .update(matchPlayers)
      .set({ userId: null })
      .where(eq(matchPlayers.userId, guestUserId)),
    // Delete player profile
    db.delete(playerProfiles).where(eq(playerProfiles.userId, guestUserId)),
    // Delete guest accounts (if any)
    db.delete(account).where(eq(account.userId, guestUserId)),
    // Delete guest user sessions
    db.delete(session).where(eq(session.userId, guestUserId)),
    // Delete guest user
    db.delete(user).where(eq(user.id, guestUserId)),
  ]);
}
