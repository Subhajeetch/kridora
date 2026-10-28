import { and, eq, grantRings, grantXp, schema, sql } from "@kridora/db";
import type { GameSlug, RoomPlayer } from "@kridora/shared";
import { withDb } from "../lib/db";
import type { Env } from "../types";
import type { MatchCompletionOutcome } from "./types";

export async function recordMatchRewards(
  env: Env,
  params: {
    matchId: string;
    gameSlug: GameSlug;
    players: readonly RoomPlayer[];
    outcome: MatchCompletionOutcome;
  },
): Promise<void> {
  const { matchId, gameSlug, players, outcome } = params;

  await withDb(env, async (db) => {
    await db
      .update(schema.matches)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(schema.matches.id, matchId));

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (!player) continue;

      const custom = outcome.placements?.find(
        (p) => p.userId === player.userId,
      );
      const isWinner =
        outcome.winnerUserId !== null && player.userId === outcome.winnerUserId;

      const placement = custom?.placement ?? (isWinner ? 1 : 2);
      const xpReward = custom?.xpReward ?? (isWinner ? 120 : 40);
      const ringsReward = custom?.ringsReward ?? (isWinner ? 25 : 5);

      await db
        .update(schema.playerProfiles)
        .set({
          gamesPlayed: sql`${schema.playerProfiles.gamesPlayed} + 1`,
          ...(isWinner
            ? { gamesWon: sql`${schema.playerProfiles.gamesWon} + 1` }
            : {}),
        })
        .where(eq(schema.playerProfiles.userId, player.userId));

      const xpRes = await grantXp(db, player.userId, xpReward);

      if (ringsReward > 0) {
        await grantRings(db, {
          userId: player.userId,
          amount: ringsReward,
          type: "game_reward",
          reason: isWinner
            ? `Won ${gameSlug} match`
            : `Completed ${gameSlug} match`,
          referenceType: "match",
          referenceId: matchId,
          idempotencyKey: `match:${matchId}:user:${player.userId}`,
        });
      }

      await db
        .update(schema.matchPlayers)
        .set({
          placement,
          xpEarned: xpRes.awarded ? xpReward : 0,
          ringsEarned: ringsReward,
        })
        .where(
          and(
            eq(schema.matchPlayers.matchId, matchId),
            eq(schema.matchPlayers.userId, player.userId),
          ),
        );
    }
  });
}
