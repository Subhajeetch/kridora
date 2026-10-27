import type { RoomSnapshot } from "@kridora/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { socket } from "@/lib/socket";
import {
  RealtimeContext,
  type ConnectionState,
  type RealtimeValue,
} from "./realtime-context";

interface RoomState {
  room: RoomSnapshot;
  offset: number;
}

/**
 * Owns the socket connection and the single source of truth for "which room am I in".
 * The server pushes `room:state` after every change, so components just read `activeRoom`.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: rawSession } = authClient.useSession();
  const session =
    rawSession &&
    typeof rawSession === "object" &&
    "user" in rawSession &&
    rawSession.user
      ? rawSession
      : null;
  const userId = session?.user.id ?? null;

  const [socketState, setSocketState] =
    useState<Exclude<ConnectionState, "idle">>("connecting");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setActiveRoom = useCallback((room: RoomSnapshot | null) => {
    setRoomState(room ? { room, offset: room.serverTime - Date.now() } : null);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const onConnect = () => setSocketState("connected");
    const onDisconnect = () => setSocketState("disconnected");
    const onState = (room: RoomSnapshot) => setActiveRoom(room);
    const onClosed = () => {
      setActiveRoom(null);
      setNotice("The room was closed because everyone left.");
    };
    const onKicked = () => {
      setActiveRoom(null);
      setNotice("The room owner removed you from the room.");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("room:state", onState);
    socket.on("room:closed", onClosed);
    socket.on("room:kicked", onKicked);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("room:state", onState);
      socket.off("room:closed", onClosed);
      socket.off("room:kicked", onKicked);
      socket.disconnect();
      setSocketState("connecting");
      setRoomState(null);
    };
  }, [userId, setActiveRoom]);

  const connection: ConnectionState = userId ? socketState : "idle";

  const value = useMemo<RealtimeValue>(
    () => ({
      socket,
      connection,
      activeRoom: userId ? (roomState?.room ?? null) : null,
      clockOffset: roomState?.offset ?? 0,
      setActiveRoom,
      notice,
      dismissNotice: () => setNotice(null),
    }),
    [connection, userId, roomState, notice, setActiveRoom],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
