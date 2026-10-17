import type { Database } from "../client";
import { matches, matchPlayers } from "../schema";

export interface CreateMatchInput {
  gameSlug: string;
  roomCode: string;
  /** User ids in seat order (join order in the room). */
  playerIds: readonly string[];
  settings?: Record<string, unknown>;
}

/** Records that a game started. Returns the new match id. */
export async function createMatch(db: Database, input: CreateMatchInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [match] = await tx
      .insert(matches)
      .values({ gameSlug: input.gameSlug, roomCode: input.roomCode, settings: input.settings ?? {} })
      .returning({ id: matches.id });
    if (!match) throw new Error("Failed to create match");

    if (input.playerIds.length > 0) {
      await tx
        .insert(matchPlayers)
        .values(input.playerIds.map((userId, seat) => ({ matchId: match.id, userId, seat })));
    }
    return match.id;
  });
}
