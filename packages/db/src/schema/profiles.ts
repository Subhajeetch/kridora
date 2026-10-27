import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
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
 * It must ONLY be changed through `applyRingTransaction` (services/rings.ts), which locks the row,
 * writes the ledger entry and updates the balance in a single database transaction.
 */
export const playerProfiles = pgTable(
  "player_profiles",
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    numericId: text().unique(),
    ringsBalance: bigint({ mode: "number" }).notNull().default(0),
    lifetimeRingsEarned: bigint({ mode: "number" }).notNull().default(0),
    lifetimeRingsSpent: bigint({ mode: "number" }).notNull().default(0),
    xp: bigint({ mode: "number" }).notNull().default(0),
    gamesPlayed: integer().notNull().default(0),
    gamesWon: integer().notNull().default(0),
    settings: jsonb().$type<PlayerSettings>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
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
