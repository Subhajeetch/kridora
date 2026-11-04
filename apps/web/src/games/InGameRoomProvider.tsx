import type { GameDefinition, RoomPlayer, RoomSnapshot } from "@kridora/shared";
import { useMemo, type ReactNode } from "react";
import {
  InGameRoomContext,
  type InGameRoomContextValue,
} from "./in-game-context";

export interface InGameRoomProviderProps {
  room: RoomSnapshot;
  userId: string;
  game: GameDefinition;
  secondsLeft: number | null;
  owner: RoomPlayer | undefined;
  successor: RoomPlayer | undefined;
  onBackToRoom: () => void;
  onLeaveRoom: () => void;
  isLeaving?: boolean;
  children: ReactNode;
}

export function InGameRoomProvider({
  room,
  userId,
  game,
  secondsLeft,
  owner,
  successor,
  onBackToRoom,
  onLeaveRoom,
  isLeaving = false,
  children,
}: InGameRoomProviderProps) {
  const value = useMemo<InGameRoomContextValue>(
    () => ({
      room,
      userId,
      game,
      roomCode: room.code,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      onBackToRoom,
      onLeaveRoom,
      isLeaving,
      secondsLeft,
      owner,
      successor,
    }),
    [
      room,
      userId,
      game,
      onBackToRoom,
      onLeaveRoom,
      isLeaving,
      secondsLeft,
      owner,
      successor,
    ],
  );

  return (
    <InGameRoomContext.Provider value={value}>
      {children}
    </InGameRoomContext.Provider>
  );
}
