import { getGameDefinition, type RoomPreview } from "@kridora/shared";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../lib/errors";
import { redis } from "../../lib/redis-client";
import { createRoomStore } from "../../rooms/store";

const roomRoutes: FastifyPluginAsync = async (app) => {
  const store = createRoomStore(redis);

  /**
   * Secure Invite Resolution:
   * Only visitors who possess a cryptographically unguessable invite token can view
   * the room preview (host, game, player roster).
   * Manual room codes cannot be probed or brute-forced to inspect sensitive player data.
   */
  app.get<{ Params: { token: string } }>(
    "/invites/:token",
    async (request, reply) => {
      const rawToken = request.params.token?.trim();
      if (!rawToken || rawToken.length < 16 || rawToken.length > 128) {
        throw new AppError("VALIDATION_ERROR", "Invalid invite token");
      }

      const invite = await store.getInvite(rawToken);
      if (!invite) {
        throw new AppError(
          "ROOM_NOT_FOUND",
          "This invite link is invalid or has expired",
        );
      }

      const room = await store.get(invite.code);
      if (!room) {
        throw new AppError(
          "ROOM_NOT_FOUND",
          "The room for this invite no longer exists",
        );
      }

      const def = getGameDefinition(room.gameSlug);
      const owner =
        room.players.find((p) => p.userId === room.ownerId) ?? room.players[0];

      reply.header("cache-control", "no-store");

      const preview: RoomPreview = {
        code: room.code,
        inviteToken: rawToken,
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
          image: p.image ?? null,
          isOwner: p.userId === room.ownerId,
        })),
      };

      return preview;
    },
  );
};

export default roomRoutes;
