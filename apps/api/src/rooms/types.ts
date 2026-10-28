import type {
  GameSlug,
  RoomPlayer,
  RoomStatus,
  RoomVisibility,
} from "@kridora/shared";

export interface InternalRoom {
  code: string;
  inviteToken: string;
  gameSlug: GameSlug;
  ownerId: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  players: RoomPlayer[];
  bannedUserIds: string[];
  createdAt: number;
  ownerTransferAt: number | null;
  emptyCloseAt: number | null;
  disconnectDeadlines: Record<string, number>;
  matchId: string | null;
  matchCompleted: boolean;
  gameState: unknown;
}
