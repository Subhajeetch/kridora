import { createAdapter } from "@socket.io/redis-adapter";
import type { SocketData } from "@kridora/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { db } from "../lib/db";
import { auth } from "../lib/auth";
import { createRedis } from "../lib/redis";
import { redis } from "../lib/redis-client";
import { appEnvironment, env } from "../env";
import { createRoomService } from "../rooms/service";
import { registerHandlers } from "./handlers";
import { createNotifier } from "./notifier";
import { userChannel, type AppServer } from "./types";

const DEADLINE_SWEEP_MS = 1_000;

export function createRealtime(app: FastifyInstance) {
  const log = app.log;

  const allowedOrigins = [
    env.APP_URL,
    ...(env.APP_URL.startsWith("https://") && !env.APP_URL.includes("www.")
      ? [env.APP_URL.replace("https://", "https://.")]
      : []),
  ];

  const io: AppServer = new Server(app.server, {
    path: "/socket.io",
    // Reconnecting quickly after a network blip matters more than idle-connection savings.
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 16 * 1024,
    cors: { origin: allowedOrigins, credentials: true },
    // Blocks cross-site WebSocket hijacking: browsers always send Origin, so a foreign site is rejected.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      callback(null, origin === undefined || allowedOrigins.includes(origin));
    },
  });

  // Redis adapter: broadcasts and "fetchSockets" work across multiple API instances.
  io.adapter(createAdapter(createRedis(env.REDIS_URL, "adapter-pub"), createRedis(env.REDIS_URL, "adapter-sub")));

  const rooms = createRoomService({ redis, db, notifier: createNotifier(io), log, appEnv: appEnvironment });

  // Authenticate every connection with the same Better Auth session cookie the REST API uses.
  io.use(async (socket, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
      if (!session) return next(new Error("UNAUTHENTICATED"));
      const data: SocketData = {
        user: {
          id: session.user.id,
          name: session.user.name,
          image: session.user.image ?? null,
          isAnonymous: Boolean(session.user.isAnonymous),
        },
      };
      socket.data = data;
      next();
    } catch (err) {
      log.warn({ err }, "socket authentication failed");
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    // Join the personal channel first so room broadcasts triggered below can reach this socket.
    void (async () => {
      try {
        await socket.join(userChannel(user.id));
        const snapshot = await rooms.handleConnect(user);
        if (snapshot) socket.emit("room:state", snapshot);
      } catch (err) {
        log.error({ err, userId: user.id }, "socket connect handling failed");
      }
    })();

    registerHandlers(socket, rooms, log);

    socket.on("disconnect", () => {
      const isOffline = async () => {
        try {
          return (await io.in(userChannel(user.id)).fetchSockets()).length === 0;
        } catch (err) {
          // If we cannot tell, assume the user is still around rather than punishing them.
          log.warn({ err, userId: user.id }, "could not check remaining sockets");
          return false;
        }
      };
      rooms.handleDisconnect(user.id, isOffline).catch((err) => {
        log.error({ err, userId: user.id }, "socket disconnect handling failed");
      });
    });
  });

  // Owner-transfer, lobby grace and idle-room timers. Safe to run on every instance.
  let sweeping = false;
  const sweeper = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    rooms
      .processDueDeadlines()
      .catch((err) => log.error({ err }, "deadline sweep failed"))
      .finally(() => {
        sweeping = false;
      });
  }, DEADLINE_SWEEP_MS);
  sweeper.unref();

  return {
    io,
    rooms,
    async close() {
      clearInterval(sweeper);
      await io.close();
    },
  };
}
