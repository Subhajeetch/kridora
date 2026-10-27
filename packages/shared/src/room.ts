import type { GameSlug } from "./games/registry";
import type { StartCheck } from "./games/requirements";

export type RoomVisibility = "private" | "public";
/** `lobby` = waiting for the owner to start, `in_progress` = a game is running. */
export type RoomStatus = "lobby" | "in_progress";

export interface RoomPlayer {
  userId: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  /** Epoch ms. Players are always stored in join order - this order decides who becomes owner next. */
  joinedAt: number;
  isReady: boolean;
  connected: boolean;
}

export interface RoomPreviewPlayer {
  name: string;
  image: string | null;
  isOwner: boolean;
}

export interface RoomPreview {
  code: string;
  inviteToken?: string;
  gameSlug: GameSlug;
  gameName: string;
  owner: {
    name: string;
    image: string | null;
  };
  status: RoomStatus;
  visibility: RoomVisibility;
  playerCount: number;
  minPlayers: number;
  maxPlayers: number;
  isFull: boolean;
  players: RoomPreviewPlayer[];
}

/** What every client receives. Never contains secrets (no email addresses, no ban lists). */
export interface RoomSnapshot {
  code: string;
  gameSlug: GameSlug;
  ownerId: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  /** In join order (the room creator is first). */
  players: RoomPlayer[];
  minPlayers: number;
  maxPlayers: number;
  createdAt: number;
  /** Epoch ms at which ownership moves to the next player; null when the owner is online. */
  ownerTransferAt: number | null;
  matchId: string | null;
  start: StartCheck;
  /** Server clock at send time; clients use it to correct for clock drift in countdowns. */
  serverTime: number;
}
