export const LUDO_COLORS = ["coral", "mint", "sunshine", "sky"] as const
export type LudoColor = (typeof LUDO_COLORS)[number]

export const LUDO_COLOR_STARTS: Record<LudoColor, number> = { coral: 0, mint: 13, sunshine: 26, sky: 39 }

/** Shared clockwise ring, starting at the coral entry square. Coordinates are [column, row]. */
export const LUDO_TRACK_COORDINATES = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
] as const

/** Star squares on the shared ring. Start squares are protected separately. */
export const LUDO_STAR_SQUARES = [8, 21, 34, 47] as const

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

export const LUDO_SAFE_SQUARES = new Set<number>([
  ...Object.values(LUDO_COLOR_STARTS),
  ...LUDO_STAR_SQUARES,
])

export function getLudoTrackSquare(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > 51) return null
  return (LUDO_COLOR_STARTS[color] + progress) % 52
}

export function getLudoCaptureTargets(
  players: readonly LudoPlayerState[],
  activePlayerIndex: number,
  landingSquare: number,
): Array<{ playerIndex: number; tokenIndex: number }> {
  if (LUDO_SAFE_SQUARES.has(landingSquare)) return []

  return players.flatMap((player, playerIndex) => playerIndex === activePlayerIndex
    ? []
    : player.tokens.flatMap((progress, tokenIndex) => getLudoTrackSquare(player.color, progress) === landingSquare
      ? [{ playerIndex, tokenIndex }]
      : []))
}

export function getLudoMovableTokens(player: LudoPlayerState, dice: number): number[] {
  return player.tokens.flatMap((progress, tokenIndex) => {
    if (progress === -1) return dice === 6 ? [tokenIndex] : []
    return progress + dice <= 57 ? [tokenIndex] : []
  })
}
