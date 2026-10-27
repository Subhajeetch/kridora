import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const matchStatus = pgEnum("match_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

/** One row per game that was actually started from a room. Live room state lives in Redis, not here. */
export const matches = pgTable(
  "matches",
  {
    id: uuid().primaryKey().defaultRandom(),
    gameSlug: text().notNull(),
    roomCode: text().notNull(),
    status: matchStatus().notNull().default("in_progress"),
    settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("matches_game_started_idx").on(t.gameSlug, t.startedAt)],
);

export const matchPlayers = pgTable(
  "match_players",
  {
    id: uuid().primaryKey().defaultRandom(),
    matchId: uuid()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    // SET NULL: deleting a (guest) account must not erase the match history of the other players.
    userId: text().references(() => user.id, { onDelete: "set null" }),
    /** Join order in the room (0 = room creator). Games can map this to turn order or colours. */
    seat: integer().notNull(),
    placement: integer(),
    xpEarned: integer().notNull().default(0),
    ringsEarned: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [
    unique("match_players_match_user_unique").on(t.matchId, t.userId),
    index("match_players_user_idx").on(t.userId),
  ],
);

export type Match = typeof matches.$inferSelect;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
