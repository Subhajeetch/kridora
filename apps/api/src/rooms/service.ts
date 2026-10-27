import { randomInt } from "node:crypto";
import { createMatch, findUserByNumericId, type Database } from "@kridora/db";
import {
  EMPTY_ROOM_CLOSE_DELAY_MS,
  evaluateStartRequirements,
  createLudoGameState,
  getLudoCaptureTargets,
  getGameDefinition,
  getLudoMovableTokens,
  getLudoTrackSquare,
  isGameEnabled,
  OWNER_TRANSFER_DELAY_MS,
  PLAYER_DISCONNECT_GRACE_MS,
  type AppEnvironment,
  type ErrorCode,
  type GameSlug,
  type LudoGameState,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomVisibility,
} from "@kridora/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { AppError } from "../lib/errors";
import { createRoomLock } from "./lock";
import { createRoomStore, deadline, generateRoomCode, keys } from "./store";
import type { RoomNotifier, SessionUser, StoredRoom } from "./types";

export interface RoomServiceDeps {
  redis: Redis;
  db: Database;
  notifier: RoomNotifier;
  log: FastifyBaseLogger;
  appEnv: AppEnvironment;
}

export type RoomService = ReturnType<typeof createRoomService>;

const MAX_BANS_PER_ROOM = 50;
const MAX_JOIN_ATTEMPTS_PER_MINUTE = 20;
/** Errors that just mean "this particular public room is not usable, try the next one". */
const SKIPPABLE_PUBLIC_ERRORS = new Set<ErrorCode>([
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_IN_PROGRESS",
  "ROOM_BUSY",
  "BANNED_FROM_ROOM",
]);

export function createRoomService({
  redis,
  db,
  notifier,
  log,
  appEnv,
}: RoomServiceDeps) {
  const store = createRoomStore(redis);
  const withRoomLock = createRoomLock(redis);

  /* ------------------------------------------------------------------ helpers */

  function toSnapshot(room: StoredRoom): RoomSnapshot {
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
      start: evaluateStartRequirements(def, room),
      serverTime: Date.now(),
    };
  }

  function assertGameEnabled(slug: string): GameSlug {
    if (!isGameEnabled(appEnv, slug))
      throw new AppError("GAME_NOT_FOUND", "That game is not available");
    return slug;
  }

  function assertOwner(room: StoredRoom, userId: string): void {
    if (room.ownerId !== userId)
      throw new AppError("NOT_ROOM_OWNER", "Only the room owner can do that");
  }

  /** Next owner = earliest-joined player (after the current owner), preferring players who are online. */
  function pickSuccessor(
    room: StoredRoom,
    connectedOnly: boolean,
  ): RoomPlayer | undefined {
    const others = room.players.filter((p) => p.userId !== room.ownerId);
    return (
      others.find((p) => p.connected) ?? (connectedOnly ? undefined : others[0])
    );
  }

  /**
   * Keeps the deadline set in sync with the room: the 40s owner-transfer timer, the lobby grace timer
   * for offline players, and the idle timer for rooms nobody is connected to.
   */
  async function reconcileTimers(room: StoredRoom): Promise<void> {
    const owner = room.players.find((p) => p.userId === room.ownerId);
    if (owner?.connected) {
      room.ownerTransferAt = null;
      await store.unschedule(deadline.owner(room.code));
    } else {
      room.ownerTransferAt ??= Date.now() + OWNER_TRANSFER_DELAY_MS;
      await store.schedule(deadline.owner(room.code), room.ownerTransferAt);
    }

    for (const p of room.players) {
      const member = deadline.player(room.code, p.userId);
      if (
        !p.connected &&
        p.userId !== room.ownerId &&
        room.status === "lobby"
      ) {
        await store.schedule(
          member,
          Date.now() + PLAYER_DISCONNECT_GRACE_MS,
          true,
        );
      } else {
        await store.unschedule(member);
      }
    }

    if (room.players.some((p) => p.connected)) {
      await store.unschedule(deadline.idle(room.code));
    } else {
      await store.schedule(
        deadline.idle(room.code),
        Date.now() + EMPTY_ROOM_CLOSE_DELAY_MS,
        true,
      );
    }
  }

  /** The single place that persists a changed room and tells everyone about it. */
  async function commit(room: StoredRoom): Promise<void> {
    await reconcileTimers(room);
    const def = getGameDefinition(room.gameSlug);
    const listed =
      room.visibility === "public" &&
      room.status === "lobby" &&
      room.players.length < def.maxPlayers;
    await store.setPublic(room, listed);
    await store.save(room);
    notifier.state(toSnapshot(room));
  }

  async function destroyRoomLocked(room: StoredRoom): Promise<void> {
    await store.remove(room);
    for (const p of room.players) {
      await store.clearUserSlot(p.userId, room.code);
      notifier.detach(p.userId, room.code);
    }
    notifier.closed(room.code);
  }

  /** Removes a player; moves ownership if they owned the room; destroys the room if it is now empty. */
  async function removePlayerLocked(
    room: StoredRoom,
    userId: string,
  ): Promise<void> {
    if (room.ludoState) {
      const removedIndex = room.ludoState.players.findIndex(
        (player) => player.userId === userId,
      );
      if (removedIndex >= 0) {
        const wasTakingTurn =
          room.ludoState.currentPlayerIndex === removedIndex;
        const removedName = room.ludoState.players[removedIndex]!.name;
        room.ludoState.players = room.ludoState.players.filter(
          (player) => player.userId !== userId,
        );
        room.ludoState.lastRolls.splice(removedIndex, 1);
        room.ludoState.currentPlayerIndex = room.ludoState.players.length
          ? (wasTakingTurn
              ? removedIndex
              : room.ludoState.currentPlayerIndex -
                Number(removedIndex < room.ludoState.currentPlayerIndex)) %
            room.ludoState.players.length
          : 0;
        if (wasTakingTurn) {
          room.ludoState.dice = null;
          room.ludoState.movableTokens = [];
        }
        if (room.ludoState.players.length === 1) {
          room.ludoState.winnerId = room.ludoState.players[0]!.userId;
          room.ludoState.lastAction = `${room.ludoState.players[0]!.name} wins by forfeit.`;
        } else {
          room.ludoState.lastAction = `${removedName} left the game.`;
        }
        room.ludoState.updatedAt = Date.now();
      }
    }
    room.players = room.players.filter((p) => p.userId !== userId);
    await store.clearUserSlot(userId, room.code);
    await store.unschedule(deadline.player(room.code, userId));
    notifier.detach(userId, room.code);

    const first = room.players[0];
    if (!first) {
      await destroyRoomLocked(room);
      return;
    }
    if (room.ownerId === userId) {
      room.ownerId = (
        pickSuccessor({ ...room, ownerId: userId }, false) ?? first
      ).userId;
      room.ownerTransferAt = null;
    }
    await commit(room);
    if (room.ludoState) notifier.ludoState(room.code, room.ludoState);
  }

  /** Runs `fn` with the room the user is currently in, locked. */
  async function withUserRoom<T>(
    userId: string,
    fn: (room: StoredRoom) => Promise<T>,
  ): Promise<T> {
    const code = await store.getUserRoomCode(userId);
    if (!code) throw new AppError("NOT_IN_ROOM", "You are not in a room");
    return withRoomLock(code, async () => {
      const room = await store.get(code);
      if (!room || !room.players.some((p) => p.userId === userId)) {
        await store.clearUserSlot(userId, code);
        throw new AppError("NOT_IN_ROOM", "You are not in a room");
      }
      return fn(room);
    });
  }

  function newPlayer(user: SessionUser): RoomPlayer {
    return {
      userId: user.id,
      name: user.name,
      image: user.image,
      isAnonymous: user.isAnonymous,
      joinedAt: Date.now(),
      isReady: false,
      connected: true,
    };
  }

  /* ------------------------------------------------------------------ player actions */

  /** Stops people from brute-forcing room codes. */
  async function consumeJoinAttempt(userId: string): Promise<void> {
    const key = keys.joinAttempts(userId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > MAX_JOIN_ATTEMPTS_PER_MINUTE) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many attempts. Wait a minute and try again.",
      );
    }
  }

  async function createRoom(
    user: SessionUser,
    input: { gameSlug: string; visibility: RoomVisibility },
  ): Promise<RoomSnapshot> {
    const gameSlug = assertGameEnabled(input.gameSlug);

    for (let attempt = 0; attempt < 8; attempt++) {
      const room: StoredRoom = {
        code: generateRoomCode(),
        gameSlug,
        ownerId: user.id,
        visibility: input.visibility,
        status: "lobby",
        players: [newPlayer(user)],
        bannedUserIds: [],
        createdAt: Date.now(),
        ownerTransferAt: null,
        matchId: null,
      };
      if (!(await store.create(room))) continue; // code collision, try another

      try {
        await store.claimUserSlot(user.id, room.code);
        await store.setPublic(room, room.visibility === "public");
      } catch (err) {
        await store.remove(room);
        throw err;
      }
      notifier.attach(user.id, room.code);
      return toSnapshot(room);
    }
    throw new AppError(
      "INTERNAL_ERROR",
      "Could not create a room. Please try again.",
    );
  }

  async function joinRoom(
    user: SessionUser,
    code: string,
    options: { publicOnly?: boolean } = {},
  ): Promise<RoomSnapshot> {
    return withRoomLock(code, async () => {
      const room = await store.get(code);
      if (!room || (options.publicOnly && room.visibility !== "public")) {
        throw new AppError("ROOM_NOT_FOUND", "No room with that code");
      }
      assertGameEnabled(room.gameSlug);
      const def = getGameDefinition(room.gameSlug);

      // Already a member (page refresh, second tab, reconnect): just reattach.
      const existing = room.players.find((p) => p.userId === user.id);
      if (existing) {
        await store.claimUserSlot(user.id, code);
        existing.connected = true;
        existing.name = user.name;
        existing.image = user.image;
        await commit(room);
        notifier.attach(user.id, code);
        return toSnapshot(room);
      }

      if (room.bannedUserIds.includes(user.id)) {
        throw new AppError(
          "BANNED_FROM_ROOM",
          "You were removed from this room",
        );
      }
      if (room.status !== "lobby")
        throw new AppError("ROOM_IN_PROGRESS", "That game has already started");
      if (room.players.length >= def.maxPlayers)
        throw new AppError("ROOM_FULL", "That room is full");

      await store.claimUserSlot(user.id, code);
      try {
        room.players.push(newPlayer(user));
        await commit(room);
      } catch (err) {
        await store.clearUserSlot(user.id, code);
        throw err;
      }
      notifier.attach(user.id, code);
      return toSnapshot(room);
    });
  }

  async function joinPublicRoom(
    user: SessionUser,
    slug: string,
  ): Promise<RoomSnapshot> {
    const gameSlug = assertGameEnabled(slug);
    const codes = await store.listPublic(gameSlug, 50);

    for (const code of codes) {
      try {
        return await joinRoom(user, code, { publicOnly: true });
      } catch (err) {
        if (err instanceof AppError && SKIPPABLE_PUBLIC_ERRORS.has(err.code)) {
          if (err.code === "ROOM_NOT_FOUND")
            await store.setPublic({ code, gameSlug, createdAt: 0 }, false);
          continue;
        }
        throw err;
      }
    }
    throw new AppError("NO_PUBLIC_ROOM", "No public rooms are open right now");
  }

  async function leaveRoom(userId: string): Promise<void> {
    const code = await store.getUserRoomCode(userId);
    if (!code) return;
    await withRoomLock(code, async () => {
      const room = await store.get(code);
      if (!room || !room.players.some((p) => p.userId === userId)) {
        await store.clearUserSlot(userId, code);
        notifier.detach(userId, code);
        return;
      }
      await removePlayerLocked(room, userId);
    });
  }

  function setVisibility(
    userId: string,
    visibility: RoomVisibility,
  ): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      assertOwner(room, userId);
      if (room.status !== "lobby")
        throw new AppError("ROOM_IN_PROGRESS", "The game has already started");
      room.visibility = visibility;
      await commit(room);
      return toSnapshot(room);
    });
  }

  function setReady(userId: string, ready: boolean): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      if (room.status !== "lobby")
        throw new AppError("ROOM_IN_PROGRESS", "The game has already started");
      const me = room.players.find((p) => p.userId === userId);
      if (me) me.isReady = ready;
      await commit(room);
      return toSnapshot(room);
    });
  }

  function transferOwner(
    userId: string,
    targetId: string,
  ): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      assertOwner(room, userId);
      if (
        targetId === userId ||
        !room.players.some((p) => p.userId === targetId)
      ) {
        throw new AppError(
          "INVALID_TARGET",
          "Pick another player in this room",
        );
      }
      room.ownerId = targetId;
      room.ownerTransferAt = null;
      await commit(room);
      return toSnapshot(room);
    });
  }

  function kickPlayer(userId: string, targetId: string): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      assertOwner(room, userId);
      if (room.status !== "lobby")
        throw new AppError("ROOM_IN_PROGRESS", "The game has already started");
      if (
        targetId === userId ||
        !room.players.some((p) => p.userId === targetId)
      ) {
        throw new AppError(
          "INVALID_TARGET",
          "Pick another player in this room",
        );
      }
      room.bannedUserIds = [...room.bannedUserIds, targetId].slice(
        -MAX_BANS_PER_ROOM,
      );
      notifier.kicked(targetId, room.code);
      await removePlayerLocked(room, targetId);
      return toSnapshot(room);
    });
  }

  function changeGame(
    userId: string,
    newGameSlug: string,
  ): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      assertOwner(room, userId);
      if (room.status !== "lobby") {
        throw new AppError(
          "ROOM_IN_PROGRESS",
          "Cannot change game while a match is in progress",
        );
      }
      const gameSlug = assertGameEnabled(newGameSlug);
      if (room.gameSlug === gameSlug) {
        return toSnapshot(room);
      }

      const nextDef = getGameDefinition(gameSlug);
      if (room.players.length > nextDef.maxPlayers) {
        throw new AppError(
          "ROOM_FULL",
          `Cannot switch to ${nextDef.name}: this game supports up to ${nextDef.maxPlayers} players, but there are currently ${room.players.length} players in the room. Please remove players before switching.`,
          {
            currentPlayers: room.players.length,
            maxPlayers: nextDef.maxPlayers,
            gameName: nextDef.name,
          },
        );
      }

      // Remove the room from the old game's public listings if it was public
      await store.setPublic(room, false);

      // Clean up previous game-specific state
      delete room.ludoState;

      // Reset ready state for all players for the new game
      for (const player of room.players) {
        player.isReady = false;
      }

      // Update game slug and update invite token cache
      room.gameSlug = gameSlug;
      await store.updateInviteGameSlug(room.code, gameSlug);

      // Re-index public room under new game if applicable, persist, and broadcast state
      await commit(room);
      return toSnapshot(room);
    });
  }

  function startGame(userId: string): Promise<RoomSnapshot> {
    return withUserRoom(userId, async (room) => {
      assertOwner(room, userId);
      if (room.status !== "lobby")
        throw new AppError("ROOM_IN_PROGRESS", "The game has already started");

      const check = evaluateStartRequirements(
        getGameDefinition(room.gameSlug),
        room,
      );
      if (!check.canStart) {
        throw new AppError(
          "START_REQUIREMENTS_NOT_MET",
          check.unmet[0]?.message ?? "Requirements not met",
          {
            unmet: check.unmet,
          },
        );
      }

      room.matchId = await createMatch(db, {
        gameSlug: room.gameSlug,
        roomCode: room.code,
        playerIds: room.players.map((p) => p.userId),
      });
      room.status = "in_progress";
      await commit(room);
      return toSnapshot(room);
    });
  }

  function assertLudoGame(room: StoredRoom): LudoGameState {
    if (room.gameSlug !== "ludo" || room.status !== "in_progress") {
      throw new AppError(
        "ROOM_IN_PROGRESS",
        "Ludo has not started in this room",
      );
    }
    room.ludoState ??= createLudoGameState(
      room.players.map(({ userId, name, image }) => ({
        userId,
        name,
        image,
      })),
    );
    return room.ludoState;
  }

  async function getLudoState(userId: string): Promise<LudoGameState> {
    return withUserRoom(userId, async (room) => {
      const state = assertLudoGame(room);
      await store.save(room);
      return state;
    });
  }

  async function rollLudoDice(userId: string): Promise<LudoGameState> {
    return withUserRoom(userId, async (room) => {
      const state = assertLudoGame(room);
      if (state.winnerId)
        throw new AppError(
          "ROOM_IN_PROGRESS",
          "This Ludo game is already over",
        );
      const player = state.players[state.currentPlayerIndex];
      if (!player)
        throw new AppError("INTERNAL_ERROR", "Ludo turn state is invalid");
      if (player.userId !== userId)
        throw new AppError("INVALID_TARGET", "Wait for your turn");
      if (state.dice !== null)
        throw new AppError(
          "INVALID_TARGET",
          "Choose one of your highlighted pieces first",
        );

      const roll = randomInt(1, 7);
      const movable = getLudoMovableTokens(player, roll);
      state.lastRolls[state.currentPlayerIndex] = roll;
      state.dice = roll;
      state.movableTokens = movable;
      state.lastAction = `${player.name} rolled a ${roll}.`;
      if (movable.length === 0) {
        state.lastAction +=
          roll === 6 ? " No piece can move." : " No move this turn.";
        state.currentPlayerIndex =
          (state.currentPlayerIndex + 1) % state.players.length;
        state.dice = null;
        state.movableTokens = [];
      }
      state.updatedAt = Date.now();
      await store.save(room);
      notifier.ludoState(room.code, state);
      return state;
    });
  }

  async function moveLudoToken(
    userId: string,
    tokenIndex: number,
  ): Promise<LudoGameState> {
    return withUserRoom(userId, async (room) => {
      const state = assertLudoGame(room);
      if (state.winnerId)
        throw new AppError(
          "ROOM_IN_PROGRESS",
          "This Ludo game is already over",
        );
      const playerIndex = state.currentPlayerIndex;
      const player = state.players[playerIndex];
      if (!player)
        throw new AppError("INTERNAL_ERROR", "Ludo turn state is invalid");
      if (player.userId !== userId)
        throw new AppError("INVALID_TARGET", "Wait for your turn");
      if (state.dice === null || !state.movableTokens.includes(tokenIndex)) {
        throw new AppError("INVALID_TARGET", "That piece cannot move");
      }

      const roll = state.dice;
      const previousProgress = player.tokens[tokenIndex];
      if (previousProgress === undefined)
        throw new AppError("INVALID_TARGET", "That piece does not exist");
      const nextProgress = previousProgress < 0 ? 0 : previousProgress + roll;
      player.tokens[tokenIndex] = nextProgress;

      const landingSquare = getLudoTrackSquare(player.color, nextProgress);
      const capturedTokens =
        landingSquare === null
          ? []
          : getLudoCaptureTargets(state.players, playerIndex, landingSquare);
      for (const target of capturedTokens) {
        state.players[target.playerIndex]!.tokens[target.tokenIndex] = -1;
      }
      const captured = capturedTokens.length > 0;

      const reachedHome = nextProgress === 57;
      state.lastAction = `${player.name} moved a piece${captured ? " and sent a rival back to the yard" : ""}${reachedHome ? " home" : ""}.`;
      if (player.tokens.every((progress) => progress === 57)) {
        state.winnerId = player.userId;
        state.lastAction = `${player.name} brought every piece home and wins!`;
        state.dice = null;
        state.movableTokens = [];
      } else if (roll === 6 || captured) {
        state.dice = null;
        state.movableTokens = [];
        state.lastAction +=
          roll === 6 ? " Roll again!" : " Capture bonus: roll again!";
      } else {
        state.currentPlayerIndex = (playerIndex + 1) % state.players.length;
        state.dice = null;
        state.movableTokens = [];
      }

      state.updatedAt = Date.now();
      await store.save(room);
      notifier.ludoState(room.code, state);
      return state;
    });
  }

  /* ------------------------------------------------------------------ connection lifecycle */

  /** Called for every new socket. Reattaches the user to their room and marks them online. */
  async function handleConnect(
    user: SessionUser,
  ): Promise<RoomSnapshot | null> {
    const code = await store.getUserRoomCode(user.id);
    if (!code) return null;
    return withRoomLock(code, async () => {
      const room = await store.get(code);
      const player = room?.players.find((p) => p.userId === user.id);
      if (!room || !player) {
        await store.clearUserSlot(user.id, code);
        return null;
      }
      player.connected = true;
      player.name = user.name;
      player.image = user.image;
      notifier.attach(user.id, code);
      await commit(room);
      return toSnapshot(room);
    });
  }

  /**
   * Called when a socket closes. `isOffline` is re-checked inside the lock so a quick page refresh
   * (new socket connects while the old one is closing) never marks the player offline.
   */
  async function handleDisconnect(
    userId: string,
    isOffline: () => Promise<boolean>,
  ): Promise<void> {
    const code = await store.getUserRoomCode(userId);
    if (!code) return;
    await withRoomLock(code, async () => {
      if (!(await isOffline())) return;
      const room = await store.get(code);
      const player = room?.players.find((p) => p.userId === userId);
      if (!room || !player || !player.connected) return;
      player.connected = false;
      await commit(room);
    });
  }

  /* ------------------------------------------------------------------ timed work */

  async function processDeadline(member: string): Promise<void> {
    const [kind, code, ...rest] = member.split(":");
    if (!kind || !code) return;

    await withRoomLock(code, async () => {
      const room = await store.get(code);
      if (!room) return;

      if (kind === "owner") {
        const owner = room.players.find((p) => p.userId === room.ownerId);
        if (!owner || owner.connected) return;
        const successor = pickSuccessor(room, true);
        room.ownerTransferAt = null;
        if (successor) {
          log.info(
            { code, from: room.ownerId, to: successor.userId },
            "owner offline: transferring ownership",
          );
          room.ownerId = successor.userId;
        }
        await commit(room);
      } else if (kind === "player") {
        const userId = rest.join(":");
        const player = room.players.find((p) => p.userId === userId);
        if (
          !player ||
          player.connected ||
          room.status !== "lobby" ||
          userId === room.ownerId
        )
          return;
        log.info({ code, userId }, "offline player removed from lobby");
        await removePlayerLocked(room, userId);
      } else if (kind === "idle") {
        if (room.players.some((p) => p.connected)) return;
        log.info({ code }, "closing idle room");
        await destroyRoomLocked(room);
      }
    });
  }

  /** Run on a short interval by every API instance; Redis guarantees each deadline is handled once. */
  async function processDueDeadlines(): Promise<void> {
    const due = await store.due(Date.now(), 50);
    for (const member of due) {
      if (!(await store.claimDeadline(member))) continue; // another instance took it
      try {
        await processDeadline(member);
      } catch (err) {
        log.error(
          { err, member },
          "deadline processing failed; retrying shortly",
        );
        await store.schedule(member, Date.now() + 5_000);
      }
    }
  }

  async function getInviteToken(
    userId: string,
  ): Promise<{ token: string; inviteUrl: string }> {
    return withUserRoom(userId, async (room) => {
      const token = await store.getOrCreateInviteToken(
        room.code,
        room.gameSlug,
      );
      return { token, inviteUrl: `/join/${token}` };
    });
  }

  async function inviteUserByNumericId(
    userId: string,
    targetNumericId: string,
  ): Promise<{ ok: boolean; targetName: string }> {
    return withUserRoom(userId, async (room) => {
      const sender = room.players.find((p) => p.userId === userId);
      const targetUser = await findUserByNumericId(db, targetNumericId);
      if (!targetUser) {
        throw new AppError(
          "NOT_FOUND",
          `No player found with User ID ${targetNumericId}`,
        );
      }
      if (room.players.some((p) => p.userId === targetUser.userId)) {
        throw new AppError(
          "ALREADY_IN_ROOM",
          `${targetUser.name} is already in this room`,
        );
      }
      const token = await store.getOrCreateInviteToken(
        room.code,
        room.gameSlug,
      );
      const gameDef = getGameDefinition(room.gameSlug);

      notifier.invitationReceived(targetUser.userId, {
        senderName: sender?.name ?? "A friend",
        gameSlug: room.gameSlug,
        gameName: gameDef.name,
        inviteToken: token,
      });

      return { ok: true, targetName: targetUser.name };
    });
  }

  return {
    consumeJoinAttempt,
    createRoom,
    joinRoom,
    joinPublicRoom,
    leaveRoom,
    setVisibility,
    setReady,
    transferOwner,
    kickPlayer,
    changeGame,
    startGame,
    getInviteToken,
    inviteUserByNumericId,
    getLudoState,
    rollLudoDice,
    moveLudoToken,
    handleConnect,
    handleDisconnect,
    processDueDeadlines,
  };
}
