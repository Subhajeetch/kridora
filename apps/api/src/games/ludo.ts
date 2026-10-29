import {
  createLudoGameState,
  emptySchema,
  getLudoCaptureTargets,
  getLudoMovableTokens,
  getLudoTrackSquare,
  ludoEmoteSchema,
  ludoMoveSchema,
  type LudoGameState,
} from "@kridora/shared";
import { rollSecureDie } from "../lib/crypto";
import { ApiError } from "../lib/errors";
import type { ServerGameModule } from "./types";

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

  onPlayerRenamed(state, userId, newName) {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.name = newName;
    state.updatedAt = Date.now();
    return true;
  },

  onPlayerLeft(state, userId) {
    const playerIndex = state.players.findIndex((p) => p.userId === userId);
    if (playerIndex === -1) return false;
    const removedPlayer = state.players[playerIndex]!;
    state.players.splice(playerIndex, 1);
    state.lastRolls.splice(playerIndex, 1);

    if (state.players.length <= 1) {
      if (state.players.length === 1) {
        const soleWinner = state.players[0]!;
        state.winnerId = soleWinner.userId;
        state.lastAction = `${removedPlayer.name} left. ${soleWinner.name} wins the match!`;
      }
      state.updatedAt = Date.now();
      return true;
    }

    if (state.currentPlayerIndex === playerIndex) {
      state.dice = null;
      state.movableTokens = [];
      state.currentPlayerIndex = state.currentPlayerIndex % state.players.length;
      const nextPlayer = state.players[state.currentPlayerIndex];
      state.lastAction = `${removedPlayer.name} left. ${nextPlayer?.name ?? "Next player"}'s turn.`;
    } else if (state.currentPlayerIndex > playerIndex) {
      state.currentPlayerIndex -= 1;
      state.lastAction = `${removedPlayer.name} left the match.`;
    } else {
      state.lastAction = `${removedPlayer.name} left the match.`;
    }
    state.updatedAt = Date.now();
    return true;
  },

  async handleAction(ctx, action, rawPayload) {
    const { state, user } = ctx;

    switch (action) {
      case "get-state": {
        emptySchema.parse(rawPayload);
        return state;
      }

      case "roll": {
        emptySchema.parse(rawPayload);
        if (state.winnerId) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "This match has already ended.",
          );
        }
        const activePlayer = state.players[state.currentPlayerIndex];
        if (!activePlayer || activePlayer.userId !== user.id) {
          throw new ApiError("FORBIDDEN", "It is not your turn to roll.");
        }
        if (state.dice !== null) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "You already rolled. Select a piece to move.",
          );
        }

        // Broadcast to all players that this player's dice pod is rolling
        ctx.broadcastEvent("ludo:rolling", {
          color: activePlayer.color,
          userId: activePlayer.userId,
        });

        const dice = rollSecureDie(6);
        state.lastRolls[state.currentPlayerIndex] = dice;
        const movable = getLudoMovableTokens(activePlayer, dice);
        state.updatedAt = Date.now();
        state.dice = dice;
        state.movableTokens = movable;

        if (movable.length === 0) {
          state.lastAction = `${activePlayer.name} rolled a ${dice}. No valid moves.`;
        } else {
          state.lastAction = `${activePlayer.name} rolled a ${dice}. Select a piece to move.`;
        }

        ctx.setState(state);
        ctx.broadcastState();
        return state;
      }

      case "pass": {
        emptySchema.parse(rawPayload);
        if (state.winnerId) return state;
        if (state.dice !== null && state.movableTokens.length === 0) {
          const activePlayer = state.players[state.currentPlayerIndex];
          state.dice = null;
          state.movableTokens = [];
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.players.length;
          const nextPlayer = state.players[state.currentPlayerIndex];
          state.lastAction = `${activePlayer?.name ?? "Player"} had no moves — ${nextPlayer?.name ?? "Next player"}'s turn.`;
          state.updatedAt = Date.now();
          ctx.setState(state);
          ctx.broadcastState();
        }
        return state;
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
          currentProgress === -1 ? 0 : currentProgress + dice;
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
          for (const t of targets) {
            const rival = state.players[t.playerIndex];
            if (rival) {
              rival.tokens[t.tokenIndex] = -1;
              capturedCount += 1;
            }
          }
        }

        state.dice = null;
        state.movableTokens = [];
        state.updatedAt = Date.now();

        const hasWon = activePlayer.tokens.every((progress) => progress === 57);
        if (hasWon) {
          state.winnerId = activePlayer.userId;
          state.lastAction = `${activePlayer.name} brought all pieces home and won the match!`;
          ctx.setState(state);
          ctx.broadcastState();
          await ctx.completeMatch({ winnerUserId: activePlayer.userId });
          return state;
        }

        const reachedHome = nextProgress === 57;
        const bonusTurn = dice === 6 || capturedCount > 0 || reachedHome;

        if (bonusTurn) {
          if (capturedCount > 0) {
            state.lastAction = `${activePlayer.name} sent a rival piece back to the yard! Roll again.`;
          } else if (reachedHome) {
            state.lastAction = `${activePlayer.name} brought a piece home! Roll again.`;
          } else {
            state.lastAction = `${activePlayer.name} moved on a 6! Roll again.`;
          }
        } else {
          state.currentPlayerIndex =
            (state.currentPlayerIndex + 1) % state.players.length;
          const nextPlayer = state.players[state.currentPlayerIndex];
          state.lastAction = `${activePlayer.name} moved a piece. ${nextPlayer?.name ?? "Next player"}'s turn.`;
        }

        ctx.setState(state);
        ctx.broadcastState();
        return state;
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
