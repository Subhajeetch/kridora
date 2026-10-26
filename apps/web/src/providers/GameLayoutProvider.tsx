import { useEffect, useState, type ReactNode } from "react"
import { GameLayoutContext } from "@/providers/game-layout-context"

export function GameLayoutProvider({ children }: { children: ReactNode }) {
  const [inGameMode, setInGameMode] = useState(false)

  // Ensure scroll is reset when entering or leaving game mode
  useEffect(() => {
    if (inGameMode) {
      window.scrollTo({ top: 0, behavior: "instant" })
    }
  }, [inGameMode])

  return (
    <GameLayoutContext.Provider value={{ inGameMode, setInGameMode }}>
      {children}
    </GameLayoutContext.Provider>
  )
}
