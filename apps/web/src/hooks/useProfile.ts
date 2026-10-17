import { useCallback, useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"

export interface MeResponse {
  user: {
    id: string
    name: string
    image: string | null
    isAnonymous: boolean
    email: string | null
    emailVerified: boolean
  }
  profile: { rings: number; xp: number; level: number; gamesPlayed: number; gamesWon: number }
}

async function fetchMe(signal?: AbortSignal): Promise<MeResponse | null> {
  try {
    const res = await fetch("/api/me", { credentials: "include", signal: signal ?? null })
    return res.ok ? ((await res.json()) as MeResponse) : null
  } catch {
    return null // network hiccup or aborted request: keep whatever we had
  }
}

/** Loads the signed-in player's game profile (Rings, XP, level) from the API. */
export function useProfile() {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id ?? null
  // Remember which user the data belongs to so a different account never sees stale numbers.
  const [state, setState] = useState<{ userId: string; me: MeResponse } | null>(null)

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    void fetchMe(controller.signal).then((me) => {
      if (me && !controller.signal.aborted) setState({ userId, me })
    })
    return () => controller.abort()
  }, [userId])

  const refresh = useCallback(async () => {
    if (!userId) return
    const me = await fetchMe()
    if (me) setState({ userId, me })
  }, [userId])

  return { me: state && state.userId === userId ? state.me : null, refresh }
}
