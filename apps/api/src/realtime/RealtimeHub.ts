import {
  changeGameSchema,
  createRoomSchema,
  emptySchema,
  inviteUserSchema,
  joinPublicSchema,
  joinRoomSchema,
  setReadySchema,
  setVisibilitySchema,
  targetPlayerSchema,
  type SocketUser,
} from "@kridora/shared";
import { DurableObject } from "cloudflare:workers";
import { recordMatchRewards } from "../games/match-rewards";
import { getServerGameModule } from "../games/registry";
import type { GameActionContext } from "../games/types";
import { ApiError, errAck, okAck, toErrorPayload } from "../lib/errors";
import { RoomManager } from "../rooms/room-manager";
import type { InternalRoom } from "../rooms/types";
import type { Env } from "../types";
import {
  MAX_WS_FRAME_BYTES,
  SlidingWindowLimiter,
  WS_OPEN_READY_STATE,
  wsClientFrameSchema,
  type SocketAttachment,
} from "./protocol";

export class RealtimeHub extends DurableObject<Env> {
  private readonly roomManager: RoomManager;
  private readonly usedTicketNonces = new Map<string, number>();
  private readonly wsLimiter = new SlidingWindowLimiter(5_000, 35);
  private readonly nameChangeBuckets = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.roomManager = new RoomManager(env, {
      broadcastToRoom: (room, event, data) =>
        this.broadcastToRoom(room, event, data),
      broadcastGameState: (room) => this.broadcastGameState(room),
      sendToUser: (userId, event, data) =>
        this.sendEventToUser(userId, event, data),
      isUserOnline: (userId) => this.getOpenSockets(userId).length > 0,
    });

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );

    this.ctx.blockConcurrencyWhile(async () => {
      const saved =
        await this.ctx.storage.get<Record<string, InternalRoom>>("rooms");
      const activeUserIds = new Set<string>();
      for (const ws of this.ctx.getWebSockets()) {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (att?.user?.id) activeUserIds.add(att.user.id);
      }
      this.roomManager.hydrate(saved, activeUserIds);
    });
  }

  private async persistAndSchedule(): Promise<void> {
    await this.ctx.storage.put("rooms", this.roomManager.serialize());
    const nextAlarm = this.roomManager.getNextAlarmTimestamp();
    if (nextAlarm !== null) {
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 250, nextAlarm));
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const [nonce, exp] of this.usedTicketNonces.entries()) {
      if (now > exp) this.usedTicketNonces.delete(nonce);
    }
    this.wsLimiter.prune();

    const changed = this.roomManager.processAlarms(now);
    if (changed) {
      await this.persistAndSchedule();
    } else {
      const nextAlarm = this.roomManager.getNextAlarmTimestamp();
      if (nextAlarm !== null) {
        await this.ctx.storage.setAlarm(Math.max(Date.now() + 250, nextAlarm));
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. Internal RPC endpoints from Hono Worker
    if (
      url.pathname === "/internal/consume-nonce" &&
      request.method === "POST"
    ) {
      const { nonce, exp } = (await request.json()) as {
        nonce: string;
        exp: number;
      };
      const now = Date.now();
      for (const [k, v] of this.usedTicketNonces.entries()) {
        if (now > v) this.usedTicketNonces.delete(k);
      }
      if (this.usedTicketNonces.has(nonce)) {
        return Response.json({ consumed: false });
      }
      this.usedTicketNonces.set(nonce, exp);
      return Response.json({ consumed: true });
    }

    if (url.pathname === "/internal/sync-name" && request.method === "POST") {
      const { userId, name } = (await request.json()) as {
        userId: string;
        name: string;
      };
      const now = Date.now();
      const last = this.nameChangeBuckets.get(userId) ?? 0;
      if (now - last < 5_000) {
        return Response.json({ allowed: false });
      }
      this.nameChangeBuckets.set(userId, now);

      for (const ws of this.ctx.getWebSockets(userId)) {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (att) {
          att.user.name = name;
          ws.serializeAttachment(att);
        }
      }

      if (this.roomManager.syncPlayerName(userId, name)) {
        await this.persistAndSchedule();
      }
      return Response.json({ allowed: true });
    }

    if (
      url.pathname.startsWith("/internal/invite/") &&
      request.method === "GET"
    ) {
      const token = decodeURIComponent(
        url.pathname.slice("/internal/invite/".length),
      );
      const preview = this.roomManager.getInvitePreview(token);
      if (!preview) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      return Response.json(preview);
    }

    // 2. WebSocket Upgrade Endpoint (/ws)
    if (
      url.pathname === "/ws" &&
      request.headers.get("Upgrade")?.toLowerCase() === "websocket"
    ) {
      const userHeader = request.headers.get("X-Socket-User");
      if (!userHeader) {
        return new Response("Missing authenticated user", { status: 401 });
      }

      let user: SocketUser;
      try {
        user = JSON.parse(userHeader) as SocketUser;
      } catch {
        return new Response("Invalid user payload", { status: 400 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      const attachment: SocketAttachment = {
        user,
        connectedAt: Date.now(),
      };

      this.ctx.acceptWebSocket(server, [user.id]);
      server.serializeAttachment(attachment);

      const rejoinedRoom = this.roomManager.onUserConnected(user);
      if (rejoinedRoom) {
        this.sendEventToSocket(
          server,
          "room:state",
          this.roomManager.toSnapshot(rejoinedRoom),
        );
        if (
          rejoinedRoom.status === "in_progress" &&
          rejoinedRoom.gameState !== null
        ) {
          this.sendGameStateToSocket(server, user.id, rejoinedRoom);
        }
        await this.persistAndSchedule();
      }

      // Signal to client that initial room & game state sync is complete
      server.send(JSON.stringify({ type: "ready" }));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const rawStr =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    if (rawStr === "ping") {
      ws.send("pong");
      return;
    }

    if (rawStr.length > MAX_WS_FRAME_BYTES) {
      ws.close(1009, "Message frame exceeds maximum size");
      return;
    }

    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment?.user) {
      ws.close(1008, "Unauthenticated connection");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawStr);
    } catch {
      return;
    }

    const frameResult = wsClientFrameSchema.safeParse(parsedJson);
    if (!frameResult.success) return;

    const { id, event, payload } = frameResult.data;
    const user = attachment.user;

    if (!this.wsLimiter.allow(user.id)) {
      if (id !== undefined) {
        this.sendAck(
          ws,
          id,
          errAck(
            "RATE_LIMITED",
            "Too many actions. Please wait a moment and try again.",
          ),
        );
      }
      return;
    }

    try {
      const data = await this.dispatchEvent(user, event, payload ?? {});
      if (id !== undefined) {
        this.sendAck(ws, id, okAck(data));
      }
    } catch (err) {
      if (id !== undefined) {
        const errPayload = toErrorPayload(err);
        this.sendAck(
          ws,
          id,
          errAck(errPayload.code, errPayload.message, errPayload.details),
        );
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Ignore already closed socket
    }
    await this.handleDisconnect(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleDisconnect(ws);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment?.user) return;
    const userId = attachment.user.id;

    const remaining = this.getOpenSockets(userId).filter((s) => s !== ws);
    if (remaining.length > 0) return;

    if (this.roomManager.onUserLastSocketDisconnected(userId)) {
      await this.persistAndSchedule();
    }
  }

  private async dispatchEvent(
    user: SocketUser,
    event: string,
    rawPayload: unknown,
  ): Promise<unknown> {
    const colonIdx = event.indexOf(":");
    if (colonIdx <= 0 || colonIdx === event.length - 1) {
      throw new ApiError("VALIDATION_ERROR", `Malformed event "${event}".`);
    }

    const prefix = event.slice(0, colonIdx);
    const action = event.slice(colonIdx + 1);

    // 1. Platform Room Events ("room:*")
    if (prefix === "room") {
      const result = await this.handleRoomAction(user, action, rawPayload);
      await this.persistAndSchedule();
      return result;
    }

    // 2. Modular Game Events ("<gameSlug>:*")
    const room = this.roomManager.getRequiredRoomForUser(user.id);
    if (room.status !== "in_progress") {
      throw new ApiError(
        "VALIDATION_ERROR",
        "No match is currently in progress in this room.",
      );
    }

    const gameModule = getServerGameModule(room.gameSlug);
    if (gameModule.eventPrefix !== prefix) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `Event "${event}" does not match active game "${room.gameSlug}".`,
      );
    }

    if (room.gameState === null || room.gameState === undefined) {
      room.gameState = gameModule.createInitialState(room.players);
    }

    let stateMutated = false;

    const ctx: GameActionContext<unknown> = {
      env: this.env,
      user,
      roomCode: room.code,
      matchId: room.matchId,
      players: room.players,
      state: room.gameState,
      setState: (nextState) => {
        room.gameState = nextState;
        stateMutated = true;
      },
      broadcastState: () => {
        this.broadcastGameState(room);
      },
      broadcastEvent: (ev, data) => {
        this.broadcastToRoom(room, ev, data);
      },
      sendToPlayer: (targetUserId, ev, data) => {
        this.sendEventToUser(targetUserId, ev, data);
      },
      completeMatch: async (outcome) => {
        if (room.matchCompleted || !room.matchId) return;
        room.matchCompleted = true;
        stateMutated = true;
        await recordMatchRewards(this.env, {
          matchId: room.matchId,
          gameSlug: room.gameSlug,
          players: room.players,
          outcome,
        });
      },
    };

    const response = await gameModule.handleAction(ctx, action, rawPayload);
    if (stateMutated) {
      await this.persistAndSchedule();
    }
    return response;
  }

  private async handleRoomAction(
    user: SocketUser,
    action: string,
    rawPayload: unknown,
  ): Promise<unknown> {
    switch (action) {
      case "create": {
        const input = createRoomSchema.parse(rawPayload);
        return this.roomManager.createRoom(
          user,
          input.gameSlug,
          input.visibility,
        );
      }
      case "join": {
        const input = joinRoomSchema.parse(rawPayload);
        return this.roomManager.joinRoom(user, input.code);
      }
      case "join-public": {
        const input = joinPublicSchema.parse(rawPayload);
        return this.roomManager.joinPublicRoom(user, input.gameSlug);
      }
      case "leave": {
        emptySchema.parse(rawPayload);
        return this.roomManager.leaveRoom(user.id);
      }
      case "set-visibility": {
        const input = setVisibilitySchema.parse(rawPayload);
        return this.roomManager.setVisibility(user.id, input.visibility);
      }
      case "set-ready": {
        const input = setReadySchema.parse(rawPayload);
        return this.roomManager.setReady(user.id, input.ready);
      }
      case "transfer-owner": {
        const input = targetPlayerSchema.parse(rawPayload);
        return this.roomManager.transferOwner(user.id, input.userId);
      }
      case "kick": {
        const input = targetPlayerSchema.parse(rawPayload);
        return this.roomManager.kickPlayer(user.id, input.userId);
      }
      case "end-game": {
        emptySchema.parse(rawPayload);
        return this.roomManager.endGame(user.id);
      }
      case "start": {
        emptySchema.parse(rawPayload);
        return this.roomManager.startGame(user.id);
      }
      case "get-invite-token": {
        emptySchema.parse(rawPayload);
        return this.roomManager.getInviteToken(user.id);
      }
      case "invite-user": {
        const input = inviteUserSchema.parse(rawPayload);
        return this.roomManager.inviteUserByNumericId(
          user,
          input.targetNumericId,
        );
      }
      case "change-game": {
        const input = changeGameSchema.parse(rawPayload);
        return this.roomManager.changeGame(user.id, input.gameSlug);
      }
      default:
        throw new ApiError(
          "VALIDATION_ERROR",
          `Unknown room action "${action}".`,
        );
    }
  }

  private getOpenSockets(userId: string): WebSocket[] {
    return this.ctx
      .getWebSockets(userId)
      .filter((ws) => ws.readyState === WS_OPEN_READY_STATE);
  }

  private broadcastGameState(room: InternalRoom): void {
    const gameModule = getServerGameModule(room.gameSlug);
    if (gameModule.serializeStateForPlayer) {
      for (const p of room.players) {
        const view = gameModule.serializeStateForPlayer(
          room.gameState,
          p.userId,
        );
        this.sendEventToUser(p.userId, gameModule.stateEvent, view);
      }
    } else {
      this.broadcastToRoom(room, gameModule.stateEvent, room.gameState);
    }
  }

  private sendGameStateToSocket(
    ws: WebSocket,
    userId: string,
    room: InternalRoom,
  ): void {
    const gameModule = getServerGameModule(room.gameSlug);
    const view = gameModule.serializeStateForPlayer
      ? gameModule.serializeStateForPlayer(room.gameState, userId)
      : room.gameState;
    this.sendEventToSocket(ws, gameModule.stateEvent, view);
  }

  private broadcastToRoom(
    room: InternalRoom,
    event: string,
    data: unknown,
  ): void {
    const encoded = JSON.stringify({ type: "event", event, data });
    for (const p of room.players) {
      for (const ws of this.getOpenSockets(p.userId)) {
        try {
          ws.send(encoded);
        } catch {
          // Closed socket is cleaned up in webSocketClose
        }
      }
    }
  }

  private sendEventToUser(userId: string, event: string, data: unknown): void {
    const encoded = JSON.stringify({ type: "event", event, data });
    for (const ws of this.getOpenSockets(userId)) {
      try {
        ws.send(encoded);
      } catch {
        // Ignore closed socket
      }
    }
  }

  private sendEventToSocket(ws: WebSocket, event: string, data: unknown): void {
    if (ws.readyState === WS_OPEN_READY_STATE) {
      ws.send(JSON.stringify({ type: "event", event, data }));
    }
  }

  private sendAck(ws: WebSocket, id: number, response: unknown): void {
    if (ws.readyState === WS_OPEN_READY_STATE) {
      ws.send(JSON.stringify({ type: "ack", id, response }));
    }
  }
}
