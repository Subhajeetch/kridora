import { useCallback, useEffect, useState } from "react";
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
    return null; // network hiccup or aborted request: keep whatever we had
  }
}

/** Loads the signed-in player's game profile (Rings, XP, level) from the API. */
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
  // Remember which user the data belongs to so a different account never sees stale numbers.
  const [state, setState] = useState<{ userId: string; me: MeResponse } | null>(
    null,
  );

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void fetchMe(controller.signal).then((me) => {
      if (me && !controller.signal.aborted) setState({ userId, me });
    });
    return () => controller.abort();
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const me = await fetchMe();
    if (me) setState({ userId, me });
  }, [userId]);

  return { me: state && state.userId === userId ? state.me : null, refresh };
}
