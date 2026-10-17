import type { GameDefinition, StartContext } from "./types";

export type UnmetRequirementCode =
  | "MIN_PLAYERS"
  | "NOT_ALL_READY"
  | "PLAYER_OFFLINE"
  | "GAME_SPECIFIC";

export interface UnmetRequirement {
  code: UnmetRequirementCode;
  message: string;
}

export interface StartCheck {
  canStart: boolean;
  unmet: UnmetRequirement[];
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length - 3;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/**
 * Single source of truth for "can this room start?".
 * The web app uses it to disable the Start button; the API runs it again before starting.
 */
export function evaluateStartRequirements(def: GameDefinition, ctx: StartContext): StartCheck {
  const unmet: UnmetRequirement[] = [];
  const total = ctx.players.length;

  if (total < def.minPlayers) {
    unmet.push({
      code: "MIN_PLAYERS",
      message: `Needs at least ${def.minPlayers} players (${total}/${def.minPlayers})`,
    });
  }

  if (def.requirements.allPlayersReady) {
    const waiting = ctx.players.filter((p) => p.userId !== ctx.ownerId && !p.isReady);
    if (waiting.length > 0) {
      unmet.push({
        code: "NOT_ALL_READY",
        message: `Waiting for ${listNames(waiting.map((p) => p.name))} to get ready`,
      });
    }
  }

  if (def.requirements.allPlayersConnected) {
    const offline = ctx.players.filter((p) => !p.connected);
    if (offline.length > 0) {
      unmet.push({
        code: "PLAYER_OFFLINE",
        message: `${listNames(offline.map((p) => p.name))} ${offline.length === 1 ? "is" : "are"} offline`,
      });
    }
  }

  if (def.extraRequirements) {
    unmet.push(...def.extraRequirements(ctx));
  }

  return { canStart: unmet.length === 0, unmet };
}
