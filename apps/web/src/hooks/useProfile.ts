import { useCallback, useEffect, useSyncExternalStore } from "react";
import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/api-url";

export interface MeResponse {
  user: {
    id: string;
    numericId?: string | null;
    name: string;
    image: string | null;
    isAnonymous: boolean;
    email: string | null;
    emailVerified: boolean;
  };
  profile: {
    numericId?: string | null;
    rings: number;
    xp: number | null;
    level: number | null;
    gamesPlayed: number;
    gamesWon: number;
  };
}

let cachedProfile: {
  userId: string;
  me: MeResponse;
  timestamp: number;
} | null = null;
let inFlightFetch: {
  userId: string;
  promise: Promise<MeResponse | null>;
} | null = null;
const listeners = new Set<() => void>();

function notifyProfileListeners() {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchMe(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/me`, {
      credentials: "include",
      signal: signal ?? null,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

export function loadProfile(
  userId: string,
  force = false,
): Promise<MeResponse | null> {
  if (
    !force &&
    cachedProfile &&
    cachedProfile.userId === userId &&
    Date.now() - cachedProfile.timestamp < 30_000
  ) {
    return Promise.resolve(cachedProfile.me);
  }

  if (inFlightFetch && inFlightFetch.userId === userId && !force) {
    return inFlightFetch.promise;
  }

  const promise = fetchMe()
    .then((me) => {
      if (me && me.user.id === userId) {
        cachedProfile = { userId, me, timestamp: Date.now() };
        notifyProfileListeners();
      }
      return me;
    })
    .finally(() => {
      if (inFlightFetch?.promise === promise) {
        inFlightFetch = null;
      }
    });

  inFlightFetch = { userId, promise };
  return promise;
}

export function invalidateProfileCache(): void {
  cachedProfile = null;
  notifyProfileListeners();
}

/**
 * Loads and shares the signed-in player's game profile across all components.
 * Employs in-memory caching and request deduplication to prevent duplicate network roundtrips.
 */
export function useProfile() {
  const { data: rawSession } = authClient.useSession();
  const session =
    rawSession &&
    typeof rawSession === "object" &&
    "user" in rawSession &&
    rawSession.user
      ? rawSession
      : null;
  const userId = session?.user.id ?? null;

  const me = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () =>
      cachedProfile && cachedProfile.userId === userId
        ? cachedProfile.me
        : null,
    () => null,
  );

  useEffect(() => {
    if (!userId) {
      if (cachedProfile) {
        cachedProfile = null;
        notifyProfileListeners();
      }
      return;
    }
    void loadProfile(userId);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await loadProfile(userId, true);
  }, [userId]);

  return { me, refresh };
}
