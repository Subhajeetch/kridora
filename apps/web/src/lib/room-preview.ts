import type { RoomPreview } from "@kridora/shared";
import { API_URL } from "./api-url";
import { RequestError, type RequestErrorCode } from "./socket";

export async function fetchInvitePreview(
  token: string,
  signal?: AbortSignal,
): Promise<RoomPreview> {
  const clean = token.trim();
  const res = await fetch(
    `${API_URL}/api/invites/${encodeURIComponent(clean)}`,
    {
      signal,
      headers: { Accept: "application/json" },
    },
  );

  if (!res.ok) {
    let errCode: RequestErrorCode = "ROOM_NOT_FOUND";
    let message = "This invite link is invalid or has expired.";
    let details: Record<string, unknown> | undefined;
    try {
      const data = (await res.json()) as {
        error?: {
          code?: RequestErrorCode;
          message?: string;
          details?: Record<string, unknown>;
        };
      };
      if (data?.error?.code) errCode = data.error.code;
      if (data?.error?.message) message = data.error.message;
      if (data?.error?.details) details = data.error.details;
    } catch {
      // Non-JSON response fallback
    }
    throw new RequestError(errCode, message, details);
  }

  return (await res.json()) as RoomPreview;
}
