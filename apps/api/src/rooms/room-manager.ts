import { createMatch, findUserByNumericId } from "@kridora/db";
import {
  EMPTY_ROOM_CLOSE_DELAY_MS,
  evaluateStartRequirements,
  getGameDefinition,
  isGameEnabled,
  OWNER_TRANSFER_DELAY_MS,
  PLAYER_DISCONNECT_GRACE_MS,
  type AppEnvironment,
  type RoomPreview,
  type RoomSnapshot,
  type RoomVisibility,
  type SocketUser,
} from "@kridora/shared";
import { getServerGameModule } from "../games/registry";
import { generateSecureRoomCode, generateSecureToken } from "../lib/crypto";
import { withDb } from "../lib/db";
import { ApiError } from "../lib/errors";
import type { Env } from "../types";
import type { InternalRoom } from "./types";

export interface RoomBroadcaster {
  broadcastToRoom: (room: InternalRoom, event: string, data: unknown) => void;
  broadcastGameState: (room: InternalRoom) => void;
  sendToUser: (userId: string, event: string, data: unknown) => void;
  isUserOnline: (userId: string) => boolean;
}

export class RoomManager {
  readonly rooms = new Map<string, InternalRoom>();
  readonly userToRoom = new Map<string, string>();
  readonly inviteToRoom = new Map<string, string>();

  constructor(
    private readonly env: Env,
    private readonly broadcaster: RoomBroadcaster,
  ) {}

  get appEnv(): AppEnvironment {
    return this.env.NODE_ENV === "production" ? "production" : "development";
  }

  hydrate(
    savedRooms: Record<string, InternalRoom> | undefined,
    activeUserIds: ReadonlySet<string>,
  ): void {
    this.rooms.clear();
    this.userToRoom.clear();
    this.inviteToRoom.clear();
    if (!savedRooms) return;

    for (const [code, room] of Object.entries(savedRooms)) {
      for (const p of room.players) {
        p.connected = activeUserIds.has(p.userId);
        this.userToRoom.set(p.userId, code);
      }
      this.rooms.set(code, room);
      this.inviteToRoom.set(room.inviteToken, code);
    }
  }

  serialize(): Record<string, InternalRoom> {
    const out: Record<string, InternalRoom> = {};
    for (const [code, room] of this.rooms.entries()) {
      out[code] = room;
    }
    return out;
  }

  getNextAlarmTimestamp(): number | null {
    let earliest: number | null = null;
    const consider = (ts: number | null | undefined) => {
      if (typeof ts === "number" && (earliest === null || ts < earliest)) {
        earliest = ts;
      }
    };

    for (const room of this.rooms.values()) {
      consider(room.ownerTransferAt);
      consider(room.emptyCloseAt);
      for (const deadline of Object.values(room.disconnectDeadlines)) {
        consider(deadline);
      }
    }
    return earliest;
  }

  processAlarms(now: number): boolean {
    let dirty = false;

    for (const room of Array.from(this.rooms.values())) {
      let roomChanged = false;

      if (room.emptyCloseAt !== null && now >= room.emptyCloseAt) {
        this.destroyRoom(room, true);
        dirty = true;
        continue;
      }

      if (room.status === "lobby") {
        for (const [uid, deadline] of Object.entries(
          room.disconnectDeadlines,
        )) {
          if (now >= deadline && uid !== room.ownerId) {
            const target = room.players.find((p) => p.userId === uid);
            if (target && !target.connected) {
              room.players = room.players.filter((p) => p.userId !== uid);
              delete room.disconnectDeadlines[uid];
              this.userToRoom.delete(uid);
              roomChanged = true;
            }
          }
        }
      } else if (room.status === "in_progress") {
        for (const [uid, deadline] of Object.entries(
          room.disconnectDeadlines,
        )) {
          if (now >= deadline) {
            const target = room.players.find((p) => p.userId === uid);
            if (target && !target.connected) {
              room.players = room.players.filter((p) => p.userId !== uid);
              delete room.disconnectDeadlines[uid];
              this.userToRoom.delete(uid);

              if (room.gameState !== null) {
                const gameModule = getServerGameModule(room.gameSlug);
                gameModule.onPlayerLeft?.(room.gameState, uid);
              }

              if (room.players.length < 2) {
                room.status = "lobby";
                room.gameState = null;
                room.matchId = null;
                for (const p of room.players) {
                  p.isReady = p.userId === room.ownerId;
                }
              } else {
                this.broadcaster.broadcastGameState(room);
              }
              roomChanged = true;
            }
          }
        }
      }

      if (room.ownerTransferAt !== null && now >= room.ownerTransferAt) {
        const successor = room.players.find(
          (p) => p.userId !== room.ownerId && p.connected,
        );
        if (successor) {
          room.ownerId = successor.userId;
          successor.isReady = true;
        }
        room.ownerTransferAt = null;
        roomChanged = true;
      }

      if (room.players.length === 0) {
        this.destroyRoom(room, true);
        dirty = true;
      } else if (roomChanged) {
        this.broadcastRoomState(room);
        dirty = true;
      }
    }

    return dirty;
  }

  onUserConnected(user: SocketUser): InternalRoom | null {
    const code = this.userToRoom.get(user.id);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) {
      this.userToRoom.delete(user.id);
      return null;
    }

    const player = room.players.find((p) => p.userId === user.id);
    if (!player) {
      this.userToRoom.delete(user.id);
      return null;
    }

    player.connected = true;
    player.name = user.name;
    player.image = user.image;
    player.isAnonymous = user.isAnonymous;
    delete room.disconnectDeadlines[user.id];
    room.emptyCloseAt = null;

    if (room.ownerId === user.id) {
      room.ownerTransferAt = null;
    }

    this.broadcastRoomState(room);
    return room;
  }

  onUserLastSocketDisconnected(userId: string): boolean {
    const code = this.userToRoom.get(userId);
    if (!code) return false;

    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return false;

    const now = Date.now();
    player.connected = false;

    if (room.ownerId === userId) {
      room.ownerTransferAt = now + OWNER_TRANSFER_DELAY_MS;
    }
    if (room.status === "lobby") {
      room.disconnectDeadlines[userId] = now + PLAYER_DISCONNECT_GRACE_MS;
    } else if (room.status === "in_progress") {
      // 5-minute offline grace period during match
      room.disconnectDeadlines[userId] = now + 5 * 60 * 1000;
    }

    if (!room.players.some((p) => p.connected)) {
      room.emptyCloseAt = now + EMPTY_ROOM_CLOSE_DELAY_MS;
    }

    this.broadcastRoomState(room);
    return true;
  }

  syncPlayerName(userId: string, newName: string): boolean {
    const code = this.userToRoom.get(userId);
    if (!code) return false;
    const room = this.rooms.get(code);
    if (!room) return false;

    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      player.name = newName;
    }

    if (room.status === "in_progress" && room.gameState !== null) {
      const gameModule = getServerGameModule(room.gameSlug);
      const changed = gameModule.onPlayerRenamed?.(
        room.gameState,
        userId,
        newName,
      );
      if (changed) {
        this.broadcaster.broadcastGameState(room);
      }
    }

    this.broadcastRoomState(room);
    return true;
  }

  getInvitePreview(token: string): RoomPreview | null {
    const clean = token.trim();
    const upper = clean.toUpperCase();
    const code =
      this.inviteToRoom.get(clean) ?? (this.rooms.has(upper) ? upper : null);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    const def = getGameDefinition(room.gameSlug);
    const owner =
      room.players.find((p) => p.userId === room.ownerId) ?? room.players[0];

    return {
      code: room.code,
      inviteToken: room.inviteToken,
      gameSlug: room.gameSlug,
      gameName: def.name,
      owner: {
        name: owner?.name ?? "Host",
        image: owner?.image ?? null,
      },
      status: room.status,
      visibility: room.visibility,
      playerCount: room.players.length,
      minPlayers: def.minPlayers,
      maxPlayers: def.maxPlayers,
      isFull: room.players.length >= def.maxPlayers,
      players: room.players.map((p) => ({
        name: p.name,
        image: p.image,
        isOwner: p.userId === room.ownerId,
      })),
    };
  }

  getRequiredRoomForUser(userId: string): InternalRoom {
    const code = this.userToRoom.get(userId);
    if (!code) {
      throw new ApiError("NOT_IN_ROOM", "You are not currently in a room.");
    }
    const room = this.rooms.get(code);
    if (!room) {
      this.userToRoom.delete(userId);
      throw new ApiError("ROOM_NOT_FOUND", "Your room no longer exists.");
    }
    return room;
  }

  private assertNotInAnotherRoom(
    userId: string,
    targetRoomCode?: string,
  ): void {
    const currentCode = this.userToRoom.get(userId);
    if (!currentCode) return;
    const currentRoom = this.rooms.get(currentCode);
    if (!currentRoom) {
      this.userToRoom.delete(userId);
      return;
    }
    if (targetRoomCode && currentCode === targetRoomCode) return;

    throw new ApiError(
      "ALREADY_IN_ROOM",
      `You are already in room ${currentRoom.code}. Leave it before joining another.`,
      {
        roomCode: currentRoom.code,
        gameSlug: currentRoom.gameSlug,
      },
    );
  }

  createRoom(
    user: SocketUser,
    slug: string,
    visibility: RoomVisibility,
  ): RoomSnapshot {
    if (!isGameEnabled(this.appEnv, slug)) {
      throw new ApiError("GAME_NOT_FOUND", "This game is not available.");
    }
    this.assertNotInAnotherRoom(user.id);

    let code = "";
    for (let i = 0; i < 30; i++) {
      const candidate = generateSecureRoomCode();
      if (!this.rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new ApiError(
        "INTERNAL_ERROR",
        "Could not allocate a room code. Please try again.",
      );
    }

    const inviteToken = generateSecureToken(18);
    const now = Date.now();
    const room: InternalRoom = {
      code,
      inviteToken,
      gameSlug: slug,
      ownerId: user.id,
      visibility,
      status: "lobby",
      players: [
        {
          userId: user.id,
          name: user.name,
          image: user.image,
          isAnonymous: user.isAnonymous,
          joinedAt: now,
          isReady: true,
          connected: true,
        },
      ],
      bannedUserIds: [],
      createdAt: now,
      ownerTransferAt: null,
      emptyCloseAt: null,
      disconnectDeadlines: {},
      matchId: null,
      matchCompleted: false,
      gameState: null,
    };

    this.rooms.set(code, room);
    this.userToRoom.set(user.id, code);
    this.inviteToRoom.set(inviteToken, code);

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  joinRoom(user: SocketUser, rawCode: string): RoomSnapshot {
    const code = rawCode.trim().toUpperCase();
    this.assertNotInAnotherRoom(user.id, code);

    const room = this.rooms.get(code);
    if (!room) {
      throw new ApiError(
        "ROOM_NOT_FOUND",
        `Room "${code}" does not exist or has closed.`,
      );
    }
    if (room.bannedUserIds.includes(user.id)) {
      throw new ApiError(
        "BANNED_FROM_ROOM",
        "You were removed from this room by the owner.",
      );
    }

    const existingPlayer = room.players.find((p) => p.userId === user.id);
    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.name = user.name;
      existingPlayer.image = user.image;
      delete room.disconnectDeadlines[user.id];
      room.emptyCloseAt = null;
      if (room.ownerId === user.id) room.ownerTransferAt = null;
      this.broadcastRoomState(room);
      return this.toSnapshot(room);
    }

    if (room.status !== "lobby") {
      throw new ApiError(
        "ROOM_IN_PROGRESS",
        "A match is already in progress in this room.",
      );
    }

    const def = getGameDefinition(room.gameSlug);
    if (room.players.length >= def.maxPlayers) {
      throw new ApiError("ROOM_FULL", "This room is already full.");
    }

    room.players.push({
      userId: user.id,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      joinedAt: Date.now(),
      isReady: false,
      connected: true,
    });
    room.emptyCloseAt = null;
    this.userToRoom.set(user.id, room.code);

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  joinPublicRoom(user: SocketUser, slug: string): RoomSnapshot {
    if (!isGameEnabled(this.appEnv, slug)) {
      throw new ApiError("GAME_NOT_FOUND", "This game is not available.");
    }
    this.assertNotInAnotherRoom(user.id);

    const def = getGameDefinition(slug);
    let candidate: InternalRoom | null = null;

    for (const room of this.rooms.values()) {
      if (
        room.gameSlug === slug &&
        room.visibility === "public" &&
        room.status === "lobby" &&
        room.players.length < def.maxPlayers &&
        !room.bannedUserIds.includes(user.id)
      ) {
        if (!candidate || room.createdAt < candidate.createdAt) {
          candidate = room;
        }
      }
    }

    if (!candidate) {
      throw new ApiError(
        "NO_PUBLIC_ROOM",
        "No open public rooms found right now.",
      );
    }
    return this.joinRoom(user, candidate.code);
  }

  leaveRoom(userId: string): null {
    const code = this.userToRoom.get(userId);
    if (!code) return null;

    const room = this.rooms.get(code);
    this.userToRoom.delete(userId);
    if (!room) return null;

    room.players = room.players.filter((p) => p.userId !== userId);
    delete room.disconnectDeadlines[userId];

    if (room.players.length === 0) {
      this.destroyRoom(room, false);
      return null;
    }

    if (room.ownerId === userId) {
      const nextOwner =
        room.players.find((p) => p.connected) ?? room.players[0];
      if (nextOwner) {
        room.ownerId = nextOwner.userId;
        nextOwner.isReady = true;
      }
      room.ownerTransferAt = null;
    }

    if (room.status === "in_progress") {
      let stateMutated = false;
      if (room.gameState !== null) {
        const gameModule = getServerGameModule(room.gameSlug);
        stateMutated = Boolean(
          gameModule.onPlayerLeft?.(room.gameState, userId),
        );
      }
      if (room.players.length < 2) {
        room.status = "lobby";
        room.gameState = null;
        room.matchId = null;
        for (const p of room.players) {
          p.isReady = p.userId === room.ownerId;
        }
      } else if (stateMutated) {
        this.broadcaster.broadcastGameState(room);
      }
    }

    this.broadcastRoomState(room);
    return null;
  }

  setVisibility(userId: string, visibility: RoomVisibility): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the room owner can change room visibility.",
      );
    }
    if (room.status !== "lobby") {
      throw new ApiError(
        "ROOM_IN_PROGRESS",
        "Cannot change visibility while a match is in progress.",
      );
    }

    room.visibility = visibility;
    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  setReady(userId: string, ready: boolean): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.status !== "lobby") {
      throw new ApiError("ROOM_IN_PROGRESS", "Match has already started.");
    }
    const player = room.players.find((p) => p.userId === userId);
    if (!player) {
      throw new ApiError("NOT_IN_ROOM", "You are not in this room.");
    }
    player.isReady = room.ownerId === userId ? true : ready;

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  transferOwner(userId: string, targetUserId: string): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the current owner can transfer ownership.",
      );
    }
    if (targetUserId === userId) {
      throw new ApiError(
        "INVALID_TARGET",
        "You are already the owner of this room.",
      );
    }
    const target = room.players.find((p) => p.userId === targetUserId);
    if (!target) {
      throw new ApiError(
        "INVALID_TARGET",
        "That player is no longer in the room.",
      );
    }

    room.ownerId = target.userId;
    target.isReady = true;
    room.ownerTransferAt = target.connected
      ? null
      : Date.now() + OWNER_TRANSFER_DELAY_MS;

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  kickPlayer(userId: string, targetUserId: string): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the room owner can remove players.",
      );
    }
    if (targetUserId === userId) {
      throw new ApiError("INVALID_TARGET", "You cannot kick yourself.");
    }
    const target = room.players.find((p) => p.userId === targetUserId);
    if (!target) {
      throw new ApiError("INVALID_TARGET", "Player is not in the room.");
    }

    room.players = room.players.filter((p) => p.userId !== targetUserId);
    delete room.disconnectDeadlines[targetUserId];
    if (!room.bannedUserIds.includes(targetUserId)) {
      room.bannedUserIds.push(targetUserId);
    }
    this.userToRoom.delete(targetUserId);

    if (room.status === "in_progress") {
      let stateMutated = false;
      if (room.gameState !== null) {
        const gameModule = getServerGameModule(room.gameSlug);
        stateMutated = Boolean(
          gameModule.onPlayerLeft?.(room.gameState, targetUserId),
        );
      }
      if (room.players.length < 2) {
        room.status = "lobby";
        room.gameState = null;
        room.matchId = null;
        for (const p of room.players) {
          p.isReady = p.userId === room.ownerId;
        }
      } else if (stateMutated) {
        this.broadcaster.broadcastGameState(room);
      }
    }

    this.broadcaster.sendToUser(targetUserId, "room:kicked", {
      code: room.code,
    });
    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  endGame(userId: string): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the room owner can end the match.",
      );
    }
    if (room.status !== "in_progress") {
      throw new ApiError(
        "VALIDATION_ERROR",
        "No match is currently in progress.",
      );
    }

    room.status = "lobby";
    room.gameState = null;
    room.matchId = null;
    for (const p of room.players) {
      p.isReady = p.userId === room.ownerId;
    }

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  changeGame(userId: string, newSlug: string): RoomSnapshot {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the room owner can change the game.",
      );
    }
    if (room.status !== "lobby") {
      throw new ApiError(
        "ROOM_IN_PROGRESS",
        "Cannot switch games while a match is running.",
      );
    }
    if (!isGameEnabled(this.appEnv, newSlug)) {
      throw new ApiError("GAME_NOT_FOUND", "That game is not available.");
    }

    const newDef = getGameDefinition(newSlug);
    if (room.players.length > newDef.maxPlayers) {
      throw new ApiError(
        "ROOM_FULL",
        `${newDef.name} supports at most ${newDef.maxPlayers} players (currently ${room.players.length} in room).`,
      );
    }

    room.gameSlug = newSlug;
    room.gameState = null;
    room.matchId = null;
    room.matchCompleted = false;
    for (const p of room.players) {
      p.isReady = p.userId === room.ownerId;
    }

    this.broadcastRoomState(room);
    return this.toSnapshot(room);
  }

  getInviteToken(userId: string): { token: string; inviteUrl: string } {
    const room = this.getRequiredRoomForUser(userId);
    return {
      token: room.inviteToken,
      inviteUrl: `/join/${room.inviteToken}`,
    };
  }

  async inviteUserByNumericId(
    sender: SocketUser,
    targetNumericId: string,
  ): Promise<{ ok: boolean; targetName: string }> {
    const room = this.getRequiredRoomForUser(sender.id);
    const target = await withDb(this.env, (db) =>
      findUserByNumericId(db, targetNumericId),
    );

    if (!target) {
      throw new ApiError(
        "NOT_FOUND",
        `No player found with User ID "${targetNumericId}".`,
      );
    }
    if (target.userId === sender.id) {
      throw new ApiError("INVALID_TARGET", "You cannot invite yourself.");
    }
    if (room.players.some((p) => p.userId === target.userId)) {
      throw new ApiError(
        "INVALID_TARGET",
        `${target.name} is already in your room.`,
      );
    }
    if (!this.broadcaster.isUserOnline(target.userId)) {
      throw new ApiError("NOT_FOUND", `${target.name} is currently offline.`);
    }

    const def = getGameDefinition(room.gameSlug);
    this.broadcaster.sendToUser(target.userId, "room:invitation-received", {
      senderName: sender.name,
      gameSlug: room.gameSlug,
      gameName: def.name,
      inviteToken: room.inviteToken,
    });

    return { ok: true, targetName: target.name };
  }

  async startGame(userId: string): Promise<RoomSnapshot> {
    const room = this.getRequiredRoomForUser(userId);
    if (room.ownerId !== userId) {
      throw new ApiError(
        "NOT_ROOM_OWNER",
        "Only the room owner can start the match.",
      );
    }
    if (room.status !== "lobby") {
      throw new ApiError("ROOM_IN_PROGRESS", "Match is already in progress.");
    }

    const def = getGameDefinition(room.gameSlug);
    const check = evaluateStartRequirements(def, {
      ownerId: room.ownerId,
      players: room.players,
    });
    if (!check.canStart) {
      throw new ApiError(
        "START_REQUIREMENTS_NOT_MET",
        check.unmet[0]?.message ?? "Start requirements are not met.",
        { unmet: check.unmet },
      );
    }

    const matchId = await withDb(this.env, (db) =>
      createMatch(db, {
        gameSlug: room.gameSlug,
        roomCode: room.code,
        playerIds: room.players.map((p) => p.userId),
      }),
    );

    const gameModule = getServerGameModule(room.gameSlug);
    room.status = "in_progress";
    room.matchId = matchId;
    room.matchCompleted = false;
    room.gameState = gameModule.createInitialState(room.players);

    this.broadcastRoomState(room);
    this.broadcaster.broadcastGameState(room);
    return this.toSnapshot(room);
  }

  destroyRoom(room: InternalRoom, notifyClosed: boolean): void {
    if (notifyClosed) {
      this.broadcaster.broadcastToRoom(room, "room:closed", {
        code: room.code,
      });
    }
    for (const p of room.players) {
      if (this.userToRoom.get(p.userId) === room.code) {
        this.userToRoom.delete(p.userId);
      }
    }
    this.inviteToRoom.delete(room.inviteToken);
    this.rooms.delete(room.code);
  }

  toSnapshot(room: InternalRoom): RoomSnapshot {
    const def = getGameDefinition(room.gameSlug);
    return {
      code: room.code,
      gameSlug: room.gameSlug,
      ownerId: room.ownerId,
      visibility: room.visibility,
      status: room.status,
      players: room.players,
      minPlayers: def.minPlayers,
      maxPlayers: def.maxPlayers,
      createdAt: room.createdAt,
      ownerTransferAt: room.ownerTransferAt,
      matchId: room.matchId,
      start: evaluateStartRequirements(def, {
        ownerId: room.ownerId,
        players: room.players,
      }),
      serverTime: Date.now(),
    };
  }

  broadcastRoomState(room: InternalRoom): void {
    this.broadcaster.broadcastToRoom(room, "room:state", this.toSnapshot(room));
  }
}
