import type { GameSlug, RoomPlayer, SocketUser } from "@kridora/shared";
import type { Env } from "../types";

export interface PlayerPlacementReward {
  userId: string;
  placement: number;
  xpReward: number;
  ringsReward: number;
}

export interface MatchCompletionOutcome {
  winnerUserId: string | null;
  placements?: readonly PlayerPlacementReward[];
}

export interface GameActionContext<TState> {
  readonly env: Env;
  readonly user: SocketUser;
  readonly roomCode: string;
  readonly matchId: string | null;
  readonly players: readonly RoomPlayer[];
  readonly state: TState;
  /** Updates the room's persisted game state. */
  setState: (nextState: TState) => void;
  /** Broadcasts the current state to all room members (using serializeStateForPlayer if defined). */
  broadcastState: () => void;
  /** Broadcasts a custom game event to all room members. */
  broadcastEvent: (event: string, payload: unknown) => void;
  /** Sends a private game event to a specific player (for secret cards/prompts). */
  sendToPlayer: (userId: string, event: string, payload: unknown) => void;
  /** Atomically marks the match completed in Postgres and awards Rings & XP once. */
  completeMatch: (outcome: MatchCompletionOutcome) => Promise<void>;
}

export interface ServerGameModule<TState = unknown> {
  readonly slug: GameSlug;
  /** Event namespace before `:`, e.g. `"ludo"` handles `"ludo:roll"`, `"ludo:move"`, etc. */
  readonly eventPrefix: string;
  /** Outbound event name used when syncing game state, e.g. `"ludo:state"`. */
  readonly stateEvent: string;
  /** Creates initial match state when the room owner presses Start. */
  createInitialState: (players: readonly RoomPlayer[]) => TState;
  /**
   * Optional per-player state sanitizer for hidden-information games
   * (e.g. hiding other players' cards/choices before reveal). Defaults to full state.
   */
  serializeStateForPlayer?: (state: TState, userId: string) => unknown;
  /** Updates in-memory player display names if a player edits their name mid-match. */
  onPlayerRenamed?: (state: TState, userId: string, newName: string) => boolean;
  /** Handles any `<eventPrefix>:<action>` client request and returns the Ack payload. */
  handleAction: (
    ctx: GameActionContext<TState>,
    action: string,
    rawPayload: unknown,
  ) => Promise<unknown> | unknown;
}
