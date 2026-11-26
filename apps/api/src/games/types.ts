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
  readonly ownerId?: string;
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
  /** Broadcasts an unpersisted compact binary frame to all connected room members. */
  broadcastBinary?: (bytes: Uint8Array) => void;
  /** Sends a binary frame to a specific player. */
  sendBinaryToPlayer?: (userId: string, bytes: Uint8Array) => void;
  /** Atomically marks the match completed in D1 and awards Rings & XP once. */
  completeMatch: (outcome: MatchCompletionOutcome) => Promise<void>;
}

export interface RealtimeTickContext<TState> {
  readonly env: Env;
  readonly roomCode: string;
  readonly ownerId: string;
  readonly matchId: string | null;
  readonly players: readonly RoomPlayer[];
  readonly state: TState;
  setState: (nextState: TState) => void;
  broadcastState: () => void;
  broadcastBinary: (bytes: Uint8Array) => void;
  completeMatch: (outcome: MatchCompletionOutcome) => Promise<void>;
  persistState: () => Promise<void>;
}

export interface ServerGameModule<TState = unknown> {
  readonly slug: GameSlug;
  /** Event namespace before `:`, e.g. `"ludo"` handles `"ludo:roll"`, `"ludo:move"`, etc. */
  readonly eventPrefix: string;
  /** Outbound event name used when syncing game state, e.g. `"ludo:state"`. */
  readonly stateEvent: string;
  /** Optional real-time simulation loop cadence in ms (e.g., 50ms = 20 Hz). */
  readonly tickIntervalMs?: number;
  /** Optional grace window (ms) before returning a solo remaining player to lobby. */
  readonly soloWaitGraceMs?: number;
  /** Creates initial match state when the room owner presses Start. */
  createInitialState: (players: readonly RoomPlayer[]) => TState;
  serializeStateForPlayer?: (state: TState, userId: string) => unknown;
  onPlayerRenamed?: (state: TState, userId: string, newName: string) => boolean;
  onPlayerLeft?: (state: TState, userId: string) => boolean;
  /** Notifies real-time games whenever connected player presence changes mid-match. */
  onRoomPresenceChanged?: (
    state: TState,
    onlineUserIds: readonly string[],
    now: number,
  ) => boolean;
  /** Handles high-frequency unpersisted binary WebSocket frames (e.g. msgpack inputs). */
  handleBinaryFrame?: (
    ctx: GameActionContext<TState>,
    bytes: Uint8Array,
  ) => void;
  /** Authoritative server simulation tick called at `tickIntervalMs` while match is active. */
  onTick?: (
    ctx: RealtimeTickContext<TState>,
    now: number,
    dtSec: number,
  ) => Promise<void> | void;
  /** Cleans up any in-memory runtime associated with a room code. */
  onRoomDestroyed?: (roomCode: string) => void;
  handleAction: (
    ctx: GameActionContext<TState>,
    action: string,
    rawPayload: unknown,
  ) => Promise<unknown> | unknown;
}
