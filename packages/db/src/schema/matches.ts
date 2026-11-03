import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const MATCH_STATUSES = [
  "in_progress",
  "completed",
  "abandoned",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** One row per game that was actually started from a room. Live room state lives in Redis/Durable Objects, not here. */
export const matches = sqliteTable(
  "matches",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameSlug: text("game_slug").notNull(),
    roomCode: text("room_code").notNull(),
    status: text("status")
      .$type<MatchStatus>()
      .notNull()
      .default("in_progress"),
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    endedAt: integer("ended_at", { mode: "timestamp" }),
  },
  (t) => [index("matches_game_started_idx").on(t.gameSlug, t.startedAt)],
);

export const matchPlayers = sqliteTable(
  "match_players",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    // SET NULL: deleting a (guest) account must not erase the match history of the other players.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Join order in the room (0 = room creator). Games can map this to turn order or colours. */
    seat: integer("seat").notNull(),
    placement: integer("placement"),
    xpEarned: integer("xp_earned").notNull().default(0),
    ringsEarned: integer("rings_earned").notNull().default(0),
  },
  (t) => [
    unique("match_players_match_user_unique").on(t.matchId, t.userId),
    index("match_players_user_idx").on(t.userId),
  ],
);

export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
