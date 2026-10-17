import type { GameSlug, RoomPlayer, RoomSnapshot, RoomStatus, RoomVisibility, SocketUser } from "@kridora/shared";

/** What we persist in Redis for a room. Same as the public snapshot plus server-only fields. */
export interface StoredRoom {
  code: string;
  gameSlug: GameSlug;
  ownerId: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  /** Always in join order; the creator is first. Ownership succession follows this order. */
  players: RoomPlayer[];
  /** Users removed by the owner. They cannot rejoin this room. */
  bannedUserIds: string[];
  createdAt: number;
  ownerTransferAt: number | null;
  matchId: string | null;
}

export type SessionUser = SocketUser;

/** How the room service talks to connected sockets without knowing about Socket.IO. */
export interface RoomNotifier {
  /** Subscribe every socket of this user to the room's broadcast channel. */
  attach(userId: string, code: string): void;
  detach(userId: string, code: string): void;
  /** Push the full room state to everyone in the room. */
  state(room: RoomSnapshot): void;
  kicked(userId: string, code: string): void;
  closed(code: string): void;
}
