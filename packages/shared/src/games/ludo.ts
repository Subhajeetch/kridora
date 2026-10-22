export const LUDO_COLORS = ["coral", "mint", "sunshine", "sky"] as const
export type LudoColor = (typeof LUDO_COLORS)[number]

const COLOR_STARTS: Record<LudoColor, number> = { coral: 0, mint: 13, sunshine: 26, sky: 39 }

export interface LudoPlayerState {
  userId: string
  name: string
  color: LudoColor
  /** -1 = yard, 0..51 = shared track, 52..57 = home lane; 57 is home. */
  tokens: number[]
}

export interface LudoGameState {
  players: LudoPlayerState[]
  lastRolls: number[]
  currentPlayerIndex: number
  dice: number | null
  movableTokens: number[]
  winnerId: string | null
  lastAction: string
  updatedAt: number
}

export function createLudoGameState(players: readonly { userId: string; name: string }[]): LudoGameState {
  const colors: readonly LudoColor[] = players.length === 2
    ? ["coral", "sunshine"]
    : players.length === 3
      ? ["coral", "mint", "sunshine"]
      : LUDO_COLORS
  return {
    players: players.map((player, index) => ({
      userId: player.userId,
      name: player.name,
      color: colors[index]!,
      tokens: [-1, -1, -1, -1],
    })),
    lastRolls: players.map(() => 1),
    currentPlayerIndex: 0,
    dice: null,
    movableTokens: [],
    winnerId: null,
    lastAction: `${players[0]?.name ?? "Players"} are ready. Roll a 6 to leave your yard.`,
    updatedAt: Date.now(),
  }
}

export const LUDO_SAFE_SQUARES = new Set([0, 6, 13, 19, 26, 32, 39, 45])

export function getLudoTrackSquare(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 51) return null
  return (COLOR_STARTS[color] + progress) % 52
}

export function getLudoMovableTokens(player: LudoPlayerState, dice: number): number[] {
  return player.tokens.flatMap((progress, tokenIndex) => {
    if (progress === -1) return dice === 6 ? [tokenIndex] : []
    return progress + dice <= 57 ? [tokenIndex] : []
  })
}
