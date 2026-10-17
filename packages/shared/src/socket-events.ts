import { z } from "zod";
import type { AckFn } from "./errors";
import type { RoomSnapshot } from "./room";
import { roomCodeSchema } from "./validation";

export const createRoomSchema = z.object({
  gameSlug: z.string().min(1).max(40),
  visibility: z.enum(["private", "public"]).default("private"),
});

export const joinRoomSchema = z.object({ code: roomCodeSchema });
export const joinPublicSchema = z.object({
  gameSlug: z.string().min(1).max(40),
});
export const emptySchema = z.object({});
export const setVisibilitySchema = z.object({
  visibility: z.enum(["private", "public"]),
});
export const setReadySchema = z.object({ ready: z.boolean() });
export const targetPlayerSchema = z.object({
  userId: z.string().min(1).max(128),
});

export type CreateRoomPayload = z.input<typeof createRoomSchema>;
export type JoinRoomPayload = z.input<typeof joinRoomSchema>;
export type JoinPublicPayload = z.input<typeof joinPublicSchema>;
export type SetVisibilityPayload = z.input<typeof setVisibilitySchema>;
export type SetReadyPayload = z.input<typeof setReadySchema>;
export type TargetPlayerPayload = z.input<typeof targetPlayerSchema>;
export type EmptyPayload = z.input<typeof emptySchema>;

export interface ClientToServerEvents {
  "room:create": (payload: CreateRoomPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:join": (payload: JoinRoomPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:join-public": (
    payload: JoinPublicPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:leave": (payload: EmptyPayload, ack: AckFn<null>) => void;
  "room:set-visibility": (
    payload: SetVisibilityPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:set-ready": (
    payload: SetReadyPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:transfer-owner": (
    payload: TargetPlayerPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:kick": (payload: TargetPlayerPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:start": (payload: EmptyPayload, ack: AckFn<RoomSnapshot>) => void;
}

export type ClientToServerEventName = keyof ClientToServerEvents;

export interface ServerToClientEvents {
  /** Full room state. Sent after every change and when a socket (re)connects while the user is in a room. */
  "room:state": (room: RoomSnapshot) => void;
  /** The room no longer exists (everyone was offline for too long). */
  "room:closed": (payload: { code: string }) => void;
  /** The owner removed you from the room. */
  "room:kicked": (payload: { code: string }) => void;
}

export type InterServerEvents = Record<never, never>;

export interface SocketUser {
  id: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
}

export interface SocketData {
  user: SocketUser;
}
