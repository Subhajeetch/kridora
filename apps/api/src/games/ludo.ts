import {
  createInitialRollStats,
  createLudoGameState,
  emptySchema,
  getLudoAutoMoveToken,
  getLudoCaptureTargets,
  getLudoMovableTokens,
  getLudoTrackSquare,
  isLudoStarSquare,
  LUDO_HOME_STEP,
  LUDO_YARD_STEP,
  ludoEmoteSchema,
  ludoMoveSchema,
  rollProfessionalLudoDice,
  type LudoGameState,
  type LudoPlayerState,
} from "@kridora/shared";
import { rollSecureDie } from "../lib/crypto";
import { ApiError } from "../lib/errors";
import type { PlayerPlacementReward, ServerGameModule } from "./types";

/** Strips internal server roll-tracking metrics before sending state to clients. */
function toClientState(state: LudoGameState): LudoGameState {
  return {
    players: state.players,
    lastRolls: state.lastRolls,
    currentPlayerIndex: state.currentPlayerIndex,
    dice: state.dice,
    movableTokens: state.movableTokens,
    winnerId: state.winnerId,
    lastAction: state.lastAction,
    updatedAt: state.updatedAt,
  };
}

/** Ensures hydrated Durable Object states from older sessions stay valid. */
function ensureNormalizedState(state: LudoGameState): void {
  if (!state.rollStats || state.rollStats.length !== state.players.length) {
    state.rollStats = createInitialRollStats(state.players.length);
  }
  for (const player of state.players) {
    for (let i = 0; i < player.tokens.length; i++) {
      const step = player.tokens[i];
      if (step !== undefined && step > LUDO_HOME_STEP) {
        player.tokens[i] = LUDO_HOME_STEP;
      }
    }
  }
  if (
    state.players.length > 0 &&
    state.currentPlayerIndex >= state.players.length
  ) {
    state.currentPlayerIndex = state.currentPlayerIndex % state.players.length;
  }
}

function computePlacements(
  players: readonly LudoPlayerState[],
  winnerUserId: string,
): PlayerPlacementReward[] {
  const ranked = [...players].sort((a, b) => {
    if (a.userId === winnerUserId) return -1;
    if (b.userId === winnerUserId) return 1;
    const aHome = a.tokens.filter((t) => t === LUDO_HOME_STEP).length;
    const bHome = b.tokens.filter((t) => t === LUDO_HOME_STEP).length;
    if (bHome !== aHome) return bHome - aHome;
    const aDist = a.tokens.reduce((sum, t) => sum + Math.max(0, t), 0);
    const bDist = b.tokens.reduce((sum, t) => sum + Math.max(0, t), 0);
    return bDist - aDist;
  });

  return ranked.map((p, index) => {
    const placement = index + 1;
    const isWinner = placement === 1;
    return {
      userId: p.userId,
      placement,
      xpReward: isWinner ? 120 : placement === 2 ? 60 : 40,
      ringsReward: isWinner ? 25 : placement === 2 ? 10 : 5,
    };
  });
}

export const ludoGameModule: ServerGameModule<LudoGameState> = {
  slug: "ludo",
  eventPrefix: "ludo",
  stateEvent: "ludo:state",

  createInitialState(players) {
    return createLudoGameState(
      players.map((p) => ({
        userId: p.userId,
        name: p.name,
        image: p.image,
      })),
    );
  },

  serializeStateForPlayer(state) {
    return toClientState(state);
  },

  onPlayerRenamed(state, userId, newName) {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.name = newName;
    state.updatedAt = Date.now();
    return true;
  },

  onPlayerLeft(state, userId) {
    ensureNormalizedState(state);
    const playerIndex = state.players.findIndex((p) => p.userId === userId);
    if (playerIndex === -1) return false;

    const removedPlayer = state.players[playerIndex];
    state.players.splice(playerIndex, 1);
    state.lastRolls.splice(playerIndex, 1);
    state.rollStats?.splice(playerIndex, 1);

    if (state.players.length <= 1) {
      if (state.players.length === 1) {
        const soleWinner = state.players[0]!;
        state.winnerId = soleWinner.userId;
        state.dice = null;
        state.movableTokens = [];
        state.lastAction = `${removedPlayer?.name ?? "Player"} left. ${soleWinner.name} wins the match!`;
      }
      state.updatedAt = Date.now();
      return true;
    }

    if (state.currentPlayerIndex === playerIndex) {
      state.dice = null;
      state.movableTokens = [];
      state.currentPlayerIndex =
        state.currentPlayerIndex % state.players.length;
      const nextPlayer = state.players[state.currentPlayerIndex];
      state.lastAction = `${removedPlayer?.name ?? "Player"} left. ${nextPlayer?.name ?? "Next player"}'s turn.`;
    } else if (state.currentPlayerIndex > playerIndex) {
      state.currentPlayerIndex -= 1;
      state.lastAction = `${removedPlayer?.name ?? "Player"} left the match.`;
    } else {
      state.lastAction = `${removedPlayer?.name ?? "Player"} left the match.`;
    }

    state.updatedAt = Date.now();
    return true;
  },

  async handleAction(ctx, action, rawPayload) {
    const { state, user } = ctx;
    ensureNormalizedState(state);

    switch (action) {
      case "get-state": {
        emptySchema.parse(rawPayload);
        return toClientState(state);
      }

      case "roll": {
        emptySchema.parse(rawPayload);
        if (state.winnerId) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "This match has already ended.",
          );
        }

        const playerIndex = state.currentPlayerIndex;
        const activePlayer = state.players[playerIndex];
        if (!activePlayer || activePlayer.userId !== user.id) {
          throw new ApiError("FORBIDDEN", "It is not your turn to roll.");
        }
        if (state.dice !== null) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "You already rolled. Select a piece to move.",
          );
        }

        // Notify other clients immediately so their 3D die starts tumbling in sync
        ctx.broadcastEvent("ludo:rolling", {
          color: activePlayer.color,
          userId: activePlayer.userId,
        });

        const prevSixStreak =
          state.rollStats?.[playerIndex]?.consecutiveSixes ?? 0;
        const rollOutcome = rollProfessionalLudoDice(state, playerIndex);
        let dice = rollOutcome.dice;

        // Hard-cap streaks at 2 consecutive 6s per turn so a 3rd roll is always 1..5
        if (prevSixStreak >= 2 && dice === 6) {
          dice = rollSecureDie(5);
          const hasValid = getLudoMovableTokens(activePlayer, dice).length > 0;
          const prevStats = state.rollStats?.[playerIndex];
          if (rollOutcome.rollStats[playerIndex] && prevStats) {
            rollOutcome.rollStats[playerIndex] = {
              turnsWithoutSix: prevStats.turnsWithoutSix + 1,
              consecutiveSixes: 0,
              deadTurnStreak: hasValid ? 0 : prevStats.deadTurnStreak + 1,
              recentRolls: [...prevStats.recentRolls.slice(-3), dice],
            };
          }
        }

        state.rollStats = rollOutcome.rollStats;
        state.lastRolls[playerIndex] = dice;
        const movable = getLudoMovableTokens(activePlayer, dice);
        state.dice = dice;
        state.movableTokens = movable;
        state.updatedAt = Date.now();

        if (movable.length === 0) {
          state.lastAction = `${activePlayer.name} rolled a ${dice}. No valid moves.`;
        } else if (getLudoAutoMoveToken(activePlayer, movable) !== null) {
          state.lastAction = `${activePlayer.name} rolled a ${dice}.`;
        } else {
          state.lastAction = `${activePlayer.name} rolled a ${dice}. Select a piece to move.`;
        }

        ctx.setState(state);
        ctx.broadcastState();
        return toClientState(state);
      }

      case "pass": {
        emptySchema.parse(rawPayload);
        if (state.winnerId || state.players.length === 0) {
          return toClientState(state);
        }

        if (state.dice !== null && state.movableTokens.length === 0) {
          const activePlayer = state.players[state.currentPlayerIndex];
          if (!activePlayer) return toClientState(state);

          const isCurrentTurnCaller = activePlayer.userId === user.id;
          const activeRoomMember = ctx.players.find(
            (p) => p.userId === activePlayer.userId,
          );
          const elapsedSinceRoll = Date.now() - state.updatedAt;

          // Prevent duplicate fallback passes from skipping a subsequent player's roll
          if (
            !isCurrentTurnCaller &&
            activeRoomMember?.connected &&
            elapsedSinceRoll < 1500
          ) {
            return toClientState(state);
          }

          const statEntry = state.rollStats?.[state.currentPlayerIndex];
          if (statEntry) {
            statEntry.consecutiveSixes = 0;
          }

          state.dice = null;
          state.movableTokens = [];
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.players.length;
          const nextPlayer = state.players[state.currentPlayerIndex];
          state.lastAction = `${activePlayer.name} had no moves — ${nextPlayer?.name ?? "Next player"}'s turn.`;
          state.updatedAt = Date.now();

          ctx.setState(state);
          ctx.broadcastState();
        }
        return toClientState(state);
      }

      case "move": {
        const { tokenIndex } = ludoMoveSchema.parse(rawPayload);
        if (state.winnerId) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "This match has already ended.",
          );
        }

        const playerIndex = state.currentPlayerIndex;
        const activePlayer = state.players[playerIndex];
        if (!activePlayer || activePlayer.userId !== user.id) {
          throw new ApiError("FORBIDDEN", "It is not your turn.");
        }
        if (state.dice === null) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Roll the dice before moving.",
          );
        }
        if (!state.movableTokens.includes(tokenIndex)) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "That piece cannot be moved with this roll.",
          );
        }

        const dice = state.dice;
        const currentProgress = activePlayer.tokens[tokenIndex];
        if (currentProgress === undefined) {
          throw new ApiError("VALIDATION_ERROR", "Invalid piece selection.");
        }

        const nextProgress =
          currentProgress === LUDO_YARD_STEP ? 0 : currentProgress + dice;
        if (nextProgress > LUDO_HOME_STEP) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Exact roll required to enter Home.",
          );
        }

        activePlayer.tokens[tokenIndex] = nextProgress;

        let capturedCount = 0;
        const landingSquare = getLudoTrackSquare(
          activePlayer.color,
          nextProgress,
        );
        if (landingSquare !== null) {
          const targets = getLudoCaptureTargets(
            state.players,
            playerIndex,
            landingSquare,
          );
          for (const target of targets) {
            const rival = state.players[target.playerIndex];
            if (rival) {
              rival.tokens[target.tokenIndex] = LUDO_YARD_STEP;
              capturedCount += 1;
            }
          }
        }

        state.dice = null;
        state.movableTokens = [];
        state.updatedAt = Date.now();

        const hasWon = activePlayer.tokens.every(
          (progress) => progress === LUDO_HOME_STEP,
        );
        if (hasWon) {
          state.winnerId = activePlayer.userId;
          state.lastAction = `${activePlayer.name} brought all 4 pieces home and won the match!`;
          ctx.setState(state);
          ctx.broadcastState();
          await ctx.completeMatch({
            winnerUserId: activePlayer.userId,
            placements: computePlacements(state.players, activePlayer.userId),
          });
          return toClientState(state);
        }

        const reachedHome = nextProgress === LUDO_HOME_STEP;
        const bonusTurn = dice === 6 || capturedCount > 0 || reachedHome;

        if (bonusTurn) {
          if (capturedCount > 0) {
            state.lastAction = `${activePlayer.name} captured ${capturedCount > 1 ? `${capturedCount} pieces` : "a rival piece"}! Roll again.`;
          } else if (reachedHome) {
            state.lastAction = `${activePlayer.name} brought a piece home! Roll again.`;
          } else {
            state.lastAction = `${activePlayer.name} rolled a 6! Roll again.`;
          }
        } else {
          const statEntry = state.rollStats?.[playerIndex];
          if (statEntry) {
            statEntry.consecutiveSixes = 0;
          }
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.players.length;
          const nextPlayer = state.players[state.currentPlayerIndex];
          const safeNote = isLudoStarSquare(activePlayer.color, nextProgress)
            ? " onto a safe star"
            : "";
          state.lastAction = `${activePlayer.name} moved${safeNote}. ${nextPlayer?.name ?? "Next player"}'s turn.`;
        }

        ctx.setState(state);
        ctx.broadcastState();
        return toClientState(state);
      }

      case "emote": {
        const { emoji } = ludoEmoteSchema.parse(rawPayload);
        const player = state.players.find((p) => p.userId === user.id);
        if (!player) {
          throw new ApiError(
            "FORBIDDEN",
            "Only players in this match can send emotes.",
          );
        }
        ctx.broadcastEvent("ludo:emote", {
          userId: user.id,
          emoji,
        });
        return { ok: true };
      }

      default:
        throw new ApiError(
          "VALIDATION_ERROR",
          `Unknown Ludo action "${action}".`,
        );
    }
  },
};
