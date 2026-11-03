import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export interface PlayerSettings {
  musicVolume?: number;
  sfxVolume?: number;
  muted?: boolean;
}

/**
 * One row per user (guests included). Holds the game wallet (Rings) and progression.
 *
 * `rings_balance` is a cache of the ledger in `ring_transactions` so reads are O(1).
 * It must ONLY be changed through `applyRingTransaction` (services/rings.ts), which
 * writes the ledger entry and updates the balance in a single database transaction.
 */
export const playerProfiles = sqliteTable(
  "player_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    numericId: text("numeric_id").unique(),
    ringsBalance: integer("rings_balance").notNull().default(0),
    lifetimeRingsEarned: integer("lifetime_rings_earned").notNull().default(0),
    lifetimeRingsSpent: integer("lifetime_rings_spent").notNull().default(0),
    xp: integer("xp").notNull().default(0),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    settings: text("settings", { mode: "json" })
      .$type<PlayerSettings>()
      .notNull()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "player_profiles_rings_balance_non_negative",
      sql`${t.ringsBalance} >= 0`,
    ),
    check("player_profiles_xp_non_negative", sql`${t.xp} >= 0`),
  ],
);

export type PlayerProfile = typeof playerProfiles.$inferSelect;
