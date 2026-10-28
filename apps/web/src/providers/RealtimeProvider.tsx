import type { RoomSnapshot } from "@kridora/shared";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { getSocketStatus, socket, subscribeSocketStatus } from "@/lib/socket";
import {
  RealtimeContext,
  type ConnectionState,
} from "@/providers/realtime-context";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { data: rawSession } = authClient.useSession();
  const userId =
    rawSession &&
    typeof rawSession === "object" &&
    "user" in rawSession &&
    rawSession.user
      ? rawSession.user.id
      : null;

  const rawSocketStatus = useSyncExternalStore(
    subscribeSocketStatus,
    getSocketStatus,
    () => "idle" as const,
  );

  const connection: ConnectionState = userId ? rawSocketStatus : "idle";

  const [roomState, setRoomState] = useState<RoomSnapshot | null>(null);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  // When user is not authenticated, activeRoom is cleanly null during render without needing synchronous setState in effects
  const activeRoom = userId ? roomState : null;

  const setActiveRoom = useCallback((room: RoomSnapshot | null) => {
    setRoomState(room);
    if (room) {
      setClockOffset(room.serverTime - Date.now());
    }
  }, []);

  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  useEffect(() => {
    if (!userId) {
      socket.disconnect();
      return;
    }

    function onRoomState(room: RoomSnapshot) {
      setActiveRoom(room);
    }

    function onRoomClosed(payload: { code: string }) {
      setActiveRoom(null);
      setNotice(`Room ${payload.code} was closed because everyone left.`);
    }

    function onRoomKicked(payload: { code: string }) {
      setActiveRoom(null);
      setNotice(`You were removed from room ${payload.code} by the host.`);
    }

    socket.on("room:state", onRoomState);
    socket.on("room:closed", onRoomClosed);
    socket.on("room:kicked", onRoomKicked);
    socket.connect();

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("room:closed", onRoomClosed);
      socket.off("room:kicked", onRoomKicked);
      socket.disconnect();
    };
  }, [userId, setActiveRoom]);

  const contextValue = useMemo(
    () => ({
      socket,
      connection,
      activeRoom,
      setActiveRoom,
      clockOffset,
      notice,
      dismissNotice,
    }),
    [connection, activeRoom, setActiveRoom, clockOffset, notice, dismissNotice],
  );

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}
