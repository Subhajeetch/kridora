import { Hono } from "hono";
import { ApiError } from "../../lib/errors";
import { fetchInvitePreviewFromHub } from "../../realtime/hub-client";
import type { AppContext } from "../../types";

export const invitesRoutes = new Hono<AppContext>();

invitesRoutes.get("/invites/:token", async (c) => {
  const token = c.req.param("token")?.trim() ?? "";
  if (!token || token.length > 64) {
    throw new ApiError(
      "ROOM_NOT_FOUND",
      "This invite link is invalid or has expired.",
    );
  }

  const preview = await fetchInvitePreviewFromHub(c.env, token);
  if (!preview) {
    throw new ApiError(
      "ROOM_NOT_FOUND",
      "This invite link is invalid or the room has closed.",
    );
  }

  return c.json(preview);
});
