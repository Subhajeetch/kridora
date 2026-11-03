import type { RoomPreview, SocketUser } from "@kridora/shared";
import type { Env } from "../types";

const INTERNAL_ORIGIN = "https://realtime-hub.internal";

export function getHubStub(env: Env): DurableObjectStub {
  const id = env.REALTIME_HUB.idFromName("global-hub");
  return env.REALTIME_HUB.get(id);
}

export async function consumeWsTicketNonce(
  env: Env,
  nonce: string,
  exp: number,
): Promise<boolean> {
  const stub = getHubStub(env);
  const res = await stub.fetch(`${INTERNAL_ORIGIN}/internal/consume-nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nonce, exp }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { consumed: boolean };
  return data.consumed === true;
}

export async function checkNameRateLimitAndSyncHub(
  env: Env,
  userId: string,
  name: string,
): Promise<{ allowed: boolean }> {
  const stub = getHubStub(env);
  const res = await stub.fetch(`${INTERNAL_ORIGIN}/internal/sync-name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name }),
  });
  if (!res.ok) return { allowed: false };
  return (await res.json()) as { allowed: boolean };
}

export async function fetchInvitePreviewFromHub(
  env: Env,
  token: string,
): Promise<RoomPreview | null> {
  const stub = getHubStub(env);
  const res = await stub.fetch(
    `${INTERNAL_ORIGIN}/internal/invite/${encodeURIComponent(token)}`,
    { method: "GET" },
  );
  if (!res.ok) return null;
  return (await res.json()) as RoomPreview;
}

export async function evictUserFromHub(
  env: Env,
  userId: string,
): Promise<void> {
  const stub = getHubStub(env);
  await stub.fetch(`${INTERNAL_ORIGIN}/internal/evict-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

export function upgradeWebSocketInHub(
  env: Env,
  rawRequest: Request,
  user: SocketUser,
): Promise<Response> {
  const stub = getHubStub(env);
  const headers = new Headers(rawRequest.headers);
  headers.set("X-Socket-User", JSON.stringify(user));

  return stub.fetch(`${INTERNAL_ORIGIN}/ws`, {
    method: "GET",
    headers,
  });
}
