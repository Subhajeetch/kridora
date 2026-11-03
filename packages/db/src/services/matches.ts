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
export async function createMatch(
  db: Database,
  input: CreateMatchInput,
): Promise<string> {
  const matchId = crypto.randomUUID();
  const insertMatch = db.insert(matches).values({
    id: matchId,
    gameSlug: input.gameSlug,
    roomCode: input.roomCode,
    settings: input.settings ?? {},
  });

  if (input.playerIds.length > 0) {
    const insertPlayers = db.insert(matchPlayers).values(
      input.playerIds.map((userId, seat) => ({
        matchId,
        userId,
        seat,
      })),
    );
    await db.batch([insertMatch, insertPlayers]);
  } else {
    await insertMatch;
  }

  return matchId;
}
