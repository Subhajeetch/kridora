import type { RoomSnapshot } from "@kridora/shared";
import { createContext, useContext } from "react";
import type { AppSocket, SocketConnectionStatus } from "@/lib/socket";

export type ConnectionState = SocketConnectionStatus;

export interface RealtimeContextValue {
  socket: AppSocket;
  connection: ConnectionState;
  activeRoom: RoomSnapshot | null;
  setActiveRoom: (room: RoomSnapshot | null) => void;
  clockOffset: number;
  notice: string | null;
  dismissNotice: () => void;
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used inside <RealtimeProvider>");
  }
  return ctx;
}
