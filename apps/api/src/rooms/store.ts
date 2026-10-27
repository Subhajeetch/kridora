import { randomBytes, randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@kridora/shared";
import type { Redis } from "ioredis";
import { AppError } from "../lib/errors";
import type { StoredRoom } from "./types";

const PREFIX = "kridora:";
/** Rooms (and the "which room is this user in" pointer) expire if nothing touches them for 12h. */
export const ROOM_TTL_SECONDS = 12 * 60 * 60;

export const keys = {
  room: (code: string) => `${PREFIX}room:${code}`,
  userRoom: (userId: string) => `${PREFIX}user-room:${userId}`,
  publicIndex: (slug: string) => `${PREFIX}public-rooms:${slug}`,
  deadlines: `${PREFIX}room-deadlines`,
  lock: (code: string) => `${PREFIX}lock:room:${code}`,
  joinAttempts: (userId: string) => `${PREFIX}join-attempts:${userId}`,
  inviteToken: (token: string) => `${PREFIX}invite:${token}`,
  roomInvite: (code: string) => `${PREFIX}room-invite:${code}`,
};

/** Members of the `room-deadlines` sorted set. The score is the epoch-ms time the deadline fires. */
export const deadline = {
  owner: (code: string) => `owner:${code}`,
  player: (code: string, userId: string) => `player:${code}:${userId}`,
  idle: (code: string) => `idle:${code}`,
};

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
  }
  return code;
}

const RELEASE_IF_EQUALS = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

export type RoomStore = ReturnType<typeof createRoomStore>;

export function createRoomStore(redis: Redis) {
  async function get(code: string): Promise<StoredRoom | null> {
    const raw = await redis.get(keys.room(code));
    return raw ? (JSON.parse(raw) as StoredRoom) : null;
  }

  async function save(room: StoredRoom): Promise<void> {
    const tx = redis.multi();
    tx.set(keys.room(room.code), JSON.stringify(room), "EX", ROOM_TTL_SECONDS);
    for (const p of room.players)
      tx.expire(keys.userRoom(p.userId), ROOM_TTL_SECONDS);
    const results = await tx.exec();
    if (!results || results.some(([err]) => err))
      throw new Error("Failed to save room");
  }

  /** Returns false when the code is already taken. */
  async function create(room: StoredRoom): Promise<boolean> {
    const result = await redis.set(
      keys.room(room.code),
      JSON.stringify(room),
      "EX",
      ROOM_TTL_SECONDS,
      "NX",
    );
    return result === "OK";
  }

  async function remove(
    room: Pick<StoredRoom, "code" | "gameSlug" | "players">,
  ): Promise<void> {
    const token = await redis.get(keys.roomInvite(room.code));
    const tx = redis.multi();
    tx.del(keys.room(room.code));
    tx.del(keys.roomInvite(room.code));
    if (token) tx.del(keys.inviteToken(token));
    tx.zrem(keys.publicIndex(room.gameSlug), room.code);
    tx.zrem(
      keys.deadlines,
      deadline.owner(room.code),
      deadline.idle(room.code),
    );
    for (const p of room.players)
      tx.zrem(keys.deadlines, deadline.player(room.code, p.userId));
    await tx.exec();
  }

  async function getOrCreateInviteToken(
    code: string,
    gameSlug: string,
  ): Promise<string> {
    const existing = await redis.get(keys.roomInvite(code));
    if (existing) return existing;

    const token = randomBytes(24).toString("base64url");
    const payload = JSON.stringify({ code, gameSlug });

    const tx = redis.multi();
    tx.set(keys.inviteToken(token), payload, "EX", ROOM_TTL_SECONDS);
    tx.set(keys.roomInvite(code), token, "EX", ROOM_TTL_SECONDS);
    await tx.exec();
    return token;
  }

  async function getInvite(
    token: string,
  ): Promise<{ code: string; gameSlug: string } | null> {
    const raw = await redis.get(keys.inviteToken(token));
    return raw ? (JSON.parse(raw) as { code: string; gameSlug: string }) : null;
  }

  async function deleteInvite(code: string): Promise<void> {
    const token = await redis.get(keys.roomInvite(code));
    const tx = redis.multi();
    tx.del(keys.roomInvite(code));
    if (token) tx.del(keys.inviteToken(token));
    await tx.exec();
  }

  async function updateInviteGameSlug(
    code: string,
    gameSlug: string,
  ): Promise<void> {
    const token = await redis.get(keys.roomInvite(code));
    if (!token) return;
    const payload = JSON.stringify({ code, gameSlug });
    await redis.set(keys.inviteToken(token), payload, "EX", ROOM_TTL_SECONDS);
  }

  /* ---- "one room per user" pointer ---- */

  const getUserRoomCode = (userId: string) => redis.get(keys.userRoom(userId));

  async function clearUserSlot(userId: string, code: string): Promise<void> {
    await redis.eval(RELEASE_IF_EQUALS, 1, keys.userRoom(userId), code);
  }

  /**
   * Atomically reserves the user's single room slot for `code`.
   * Heals a stale pointer (room expired or user no longer a member) once before giving up.
   */
  async function claimUserSlot(
    userId: string,
    code: string,
  ): Promise<"claimed" | "already"> {
    const key = keys.userRoom(userId);
    for (let attempt = 0; attempt < 2; attempt++) {
      const set = await redis.set(key, code, "EX", ROOM_TTL_SECONDS, "NX");
      if (set === "OK") return "claimed";

      const current = await redis.get(key);
      if (current === code) return "already";
      if (!current) continue; // expired between SET and GET: try again

      const other = await get(current);
      if (other?.players.some((p) => p.userId === userId)) {
        throw new AppError(
          "ALREADY_IN_ROOM",
          "You are already in another room",
          {
            roomCode: current,
            gameSlug: other.gameSlug,
          },
        );
      }
      await clearUserSlot(userId, current); // stale
    }
    throw new AppError("ALREADY_IN_ROOM", "You are already in another room");
  }

  /* ---- public room index (oldest room first) ---- */

  async function setPublic(
    room: Pick<StoredRoom, "code" | "gameSlug" | "createdAt">,
    listed: boolean,
  ): Promise<void> {
    if (listed)
      await redis.zadd(
        keys.publicIndex(room.gameSlug),
        room.createdAt,
        room.code,
      );
    else await redis.zrem(keys.publicIndex(room.gameSlug), room.code);
  }

  const listPublic = (slug: string, limit: number) =>
    redis.zrange(keys.publicIndex(slug), "0", String(limit - 1));

  /* ---- deadlines (owner transfer, lobby disconnect grace, idle room close) ---- */

  async function schedule(
    member: string,
    at: number,
    onlyIfAbsent = false,
  ): Promise<void> {
    if (onlyIfAbsent) await redis.zadd(keys.deadlines, "NX", at, member);
    else await redis.zadd(keys.deadlines, at, member);
  }

  async function unschedule(member: string): Promise<void> {
    await redis.zrem(keys.deadlines, member);
  }

  const due = (now: number, limit: number) =>
    redis.zrangebyscore(keys.deadlines, 0, now, "LIMIT", 0, limit);

  /** Removes a due deadline; true for exactly one caller even with many API instances running. */
  async function claimDeadline(member: string): Promise<boolean> {
    return (await redis.zrem(keys.deadlines, member)) === 1;
  }

  return {
    get,
    save,
    create,
    remove,
    getUserRoomCode,
    clearUserSlot,
    claimUserSlot,
    setPublic,
    listPublic,
    schedule,
    unschedule,
    due,
    claimDeadline,
    getOrCreateInviteToken,
    getInvite,
    deleteInvite,
    updateInviteGameSlug,
  };
}
