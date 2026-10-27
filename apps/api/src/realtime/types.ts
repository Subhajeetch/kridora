import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@kridora/shared";
import type { Server, Socket } from "socket.io";

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** Every socket joins this channel on connect; used to reach all tabs/devices of one user. */
export const userChannel = (userId: string) => `user:${userId}`;
/** Everyone in a room (sockets are attached/detached by the room service). */
export const roomChannel = (code: string) => `room:${code}`;
