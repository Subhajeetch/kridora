import type { RoomSnapshot } from "@kridora/shared";
import { createContext, useContext } from "react";
import type { AppSocket } from "@/lib/socket";

export type ConnectionState =
  "idle" | "connecting" | "connected" | "disconnected";

export interface RealtimeValue {
  socket: AppSocket;
  connection: ConnectionState;
  /** The room the signed-in player is currently in (null when they are in none). */
  activeRoom: RoomSnapshot | null;
  /** Server clock minus client clock (ms) measured when activeRoom last changed; keeps countdowns accurate. */
  clockOffset: number;
  setActiveRoom: (room: RoomSnapshot | null) => void;
  /** One-off message such as "You were removed from the room". */
  notice: string | null;
  dismissNotice: () => void;
}

export const RealtimeContext = createContext<RealtimeValue | null>(null);

export function useRealtime(): RealtimeValue {
  const value = useContext(RealtimeContext);
  if (!value)
    throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return value;
}
