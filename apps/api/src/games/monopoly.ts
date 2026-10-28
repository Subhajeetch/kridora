import { emptySchema } from "@kridora/shared";
import { ApiError } from "../lib/errors";
import type { ServerGameModule } from "./types";

export interface MonopolyServerState {
  players: Array<{
    userId: string;
    name: string;
    image: string | null;
    cash: number;
    position: number;
    bankrupt: boolean;
  }>;
  currentTurnIndex: number;
  updatedAt: number;
}

export const monopolyGameModule: ServerGameModule<MonopolyServerState> = {
  slug: "monopoly",
  eventPrefix: "monopoly",
  stateEvent: "monopoly:state",

  createInitialState(players) {
    return {
      players: players.map((p) => ({
        userId: p.userId,
        name: p.name,
        image: p.image,
        cash: 1500,
        position: 0,
        bankrupt: false,
      })),
      currentTurnIndex: 0,
      updatedAt: Date.now(),
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
        return ctx.state;
      }
      default:
        throw new ApiError(
          "VALIDATION_ERROR",
          `Unknown Monopoly action "${action}".`,
        );
    }
  },
};
