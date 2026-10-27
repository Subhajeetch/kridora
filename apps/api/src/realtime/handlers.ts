import {
  changeGameSchema,
  createRoomSchema,
  emptySchema,
  inviteUserSchema,
  joinPublicSchema,
  joinRoomSchema,
  ludoMoveSchema,
  setReadySchema,
  setVisibilitySchema,
  targetPlayerSchema,
  type Ack,
  type ClientToServerEventName,
} from "@kridora/shared";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";
import { AppError, toErrorPayload } from "../lib/errors";
import type { RoomService } from "../rooms/service";
import type { AppSocket } from "./types";

interface HandlerContext {
  userId: string;
  user: AppSocket["data"]["user"];
  rooms: RoomService;
}

interface HandlerDef {
  schema: z.ZodType;
  run: (ctx: HandlerContext, payload: never) => Promise<unknown>;
}

/** Ties a validation schema to its handler so `payload` is fully typed inside `run`. */
function define<S extends z.ZodType, R>(
  schema: S,
  run: (ctx: HandlerContext, payload: z.output<S>) => Promise<R>,
): HandlerDef {
  return { schema, run: run as HandlerDef["run"] };
}

/** One entry per client -> server event. Every payload is validated before the handler runs. */
const handlers: Record<ClientToServerEventName, HandlerDef> = {
  "room:create": define(createRoomSchema, (ctx, p) =>
    ctx.rooms.createRoom(ctx.user, p),
  ),
  "room:join": define(joinRoomSchema, async (ctx, p) => {
    await ctx.rooms.consumeJoinAttempt(ctx.userId);
    return ctx.rooms.joinRoom(ctx.user, p.code);
  }),
  "room:join-public": define(joinPublicSchema, (ctx, p) =>
    ctx.rooms.joinPublicRoom(ctx.user, p.gameSlug),
  ),
  "room:leave": define(emptySchema, async (ctx) => {
    await ctx.rooms.leaveRoom(ctx.userId);
    return null;
  }),
  "room:set-visibility": define(setVisibilitySchema, (ctx, p) =>
    ctx.rooms.setVisibility(ctx.userId, p.visibility),
  ),
  "room:set-ready": define(setReadySchema, (ctx, p) =>
    ctx.rooms.setReady(ctx.userId, p.ready),
  ),
  "room:transfer-owner": define(targetPlayerSchema, (ctx, p) =>
    ctx.rooms.transferOwner(ctx.userId, p.userId),
  ),
  "room:kick": define(targetPlayerSchema, (ctx, p) =>
    ctx.rooms.kickPlayer(ctx.userId, p.userId),
  ),
  "room:change-game": define(changeGameSchema, (ctx, p) =>
    ctx.rooms.changeGame(ctx.userId, p.gameSlug),
  ),
  "room:start": define(emptySchema, (ctx) => ctx.rooms.startGame(ctx.userId)),
  "room:get-invite-token": define(emptySchema, (ctx) =>
    ctx.rooms.getInviteToken(ctx.userId),
  ),
  "room:invite-user": define(inviteUserSchema, (ctx, p) =>
    ctx.rooms.inviteUserByNumericId(ctx.userId, p.targetNumericId),
  ),
  "ludo:get-state": define(emptySchema, (ctx) =>
    ctx.rooms.getLudoState(ctx.userId),
  ),
  "ludo:roll": define(emptySchema, (ctx) => ctx.rooms.rollLudoDice(ctx.userId)),
  "ludo:move": define(ludoMoveSchema, (ctx, p) =>
    ctx.rooms.moveLudoToken(ctx.userId, p.tokenIndex),
  ),
};

/** Allows `max` events per `windowMs` per socket. */
function createSocketLimiter(max: number, windowMs: number) {
  let timestamps: number[] = [];
  return () => {
    const now = Date.now();
    timestamps = timestamps.filter((t) => now - t < windowMs);
    if (timestamps.length >= max) return false;
    timestamps.push(now);
    return true;
  };
}

export function registerHandlers(
  socket: AppSocket,
  rooms: RoomService,
  log: FastifyBaseLogger,
): void {
  const ctx: HandlerContext = {
    userId: socket.data.user.id,
    user: socket.data.user,
    rooms,
  };
  const allow = createSocketLimiter(30, 10_000);

  for (const [event, handler] of Object.entries(handlers) as [
    ClientToServerEventName,
    HandlerDef,
  ][]) {
    // The generic event typing cannot express "all events share one dispatcher", so cast once here.
    socket.on(
      event as never,
      (async (raw: unknown, ack: unknown) => {
        if (typeof ack !== "function") return; // every request must be acknowledged
        const reply = ack as (response: Ack<unknown>) => void;
        try {
          if (!allow())
            throw new AppError("RATE_LIMITED", "You are doing that too fast");
          const parsed = handler.schema.safeParse(raw ?? {});
          if (!parsed.success)
            throw new AppError("VALIDATION_ERROR", "Invalid request");
          const data = await handler.run(ctx, parsed.data as never);
          reply({ ok: true, data });
        } catch (err) {
          const { payload, unexpected } = toErrorPayload(err);
          if (unexpected)
            log.error(
              { err, event, userId: ctx.userId },
              "socket handler failed",
            );
          reply({ ok: false, error: payload });
        }
      }) as never,
    );
  }
}
