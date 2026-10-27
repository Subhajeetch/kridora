import type { RoomNotifier } from "../rooms/types";
import { roomChannel, userChannel, type AppServer } from "./types";

export function createNotifier(io: AppServer): RoomNotifier {
  return {
    attach(userId, code) {
      io.in(userChannel(userId)).socketsJoin(roomChannel(code));
    },
    detach(userId, code) {
      io.in(userChannel(userId)).socketsLeave(roomChannel(code));
    },
    state(room) {
      io.to(roomChannel(room.code)).emit("room:state", room);
    },
    kicked(userId, code) {
      io.to(userChannel(userId)).emit("room:kicked", { code });
    },
    ludoState(code, state) {
      io.to(roomChannel(code)).emit("ludo:state", state);
    },
    closed(code) {
      io.to(roomChannel(code)).emit("room:closed", { code });
      io.in(roomChannel(code)).socketsLeave(roomChannel(code));
    },
    invitationReceived(targetUserId, payload) {
      io.to(userChannel(targetUserId)).emit(
        "room:invitation-received",
        payload,
      );
    },
  };
}
