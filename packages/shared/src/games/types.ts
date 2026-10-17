import type { RoomPlayer } from "../room";
import type { UnmetRequirement } from "./requirements";

export interface StartContext {
  ownerId: string;
  players: readonly RoomPlayer[];
}

/**
 * Everything the platform needs to know about a game. The lobby, the "Start game" button,
 * the server-side validation and the Browse Games page are all driven by this object.
 */
export interface GameDefinition {
  /** URL segment: yourdomain.com/<slug>. Lowercase letters, numbers and dashes only. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Any CSS colour; used for the game card and lobby accents. */
  accent: string;
  /** Free text shown on the card, e.g. "60-120 min". */
  playTime: string;
  minPlayers: number;
  maxPlayers: number;
  requirements: {
    /** Every player except the owner must press "Ready" before the owner can start. */
    allPlayersReady: boolean;
    /** Nobody may be offline when the owner presses start. */
    allPlayersConnected: boolean;
  };
  /** Optional game-specific rules (team balance, chosen map, ...). Runs on both client and server. */
  extraRequirements?: (ctx: StartContext) => UnmetRequirement[];
}
