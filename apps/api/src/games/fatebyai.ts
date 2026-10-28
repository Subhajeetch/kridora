import { emptySchema } from "@kridora/shared";
import { ApiError } from "../lib/errors";
import type { ServerGameModule } from "./types";

export interface FateByAiServerState {
  round: number;
  phase: "choosing" | "narrating" | "completed";
  players: Array<{
    userId: string;
    name: string;
    image: string | null;
    submittedChoice: boolean;
  }>;
  /** Secret choices kept server-side until all players submit. */
  secretChoices: Record<string, string>;
  storyLog: string[];
  updatedAt: number;
}

export const fateByAiGameModule: ServerGameModule<FateByAiServerState> = {
  slug: "fatebyai",
  eventPrefix: "fatebyai",
  stateEvent: "fatebyai:state",

  createInitialState(players) {
    return {
      round: 1,
      phase: "choosing",
      players: players.map((p) => ({
        userId: p.userId,
        name: p.name,
        image: p.image,
        submittedChoice: false,
      })),
      secretChoices: {},
      storyLog: [],
      updatedAt: Date.now(),
    };
  },

  // Example of hidden-information sanitization: each player only sees their own unrevealed choice
  serializeStateForPlayer(state, userId) {
    return {
      round: state.round,
      phase: state.phase,
      players: state.players,
      myChoice: state.secretChoices[userId] ?? null,
      storyLog: state.storyLog,
      updatedAt: state.updatedAt,
    };
  },

  onPlayerRenamed(state, userId, newName) {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.name = newName;
    state.updatedAt = Date.now();
    return true;
  },

  handleAction(ctx, action, rawPayload) {
    switch (action) {
      case "get-state": {
        emptySchema.parse(rawPayload);
        return this.serializeStateForPlayer
          ? this.serializeStateForPlayer(ctx.state, ctx.user.id)
          : ctx.state;
      }
      default:
        throw new ApiError(
          "VALIDATION_ERROR",
          `Unknown Fate by AI action "${action}".`,
        );
    }
  },
};
