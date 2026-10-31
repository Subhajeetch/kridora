export const LUDO_COLORS = ["coral", "mint", "sunshine", "sky"] as const;
export type LudoColor = (typeof LUDO_COLORS)[number];

export const LUDO_YARD_STEP = -1;
export const LUDO_TRACK_RING_SIZE = 52;
/** Outer shared track runs 0..50 (51 squares total, ending on the player's entry arrow). */
export const LUDO_MAX_SHARED_PROGRESS = 50;
/** 5 private safe boxes leading to the center goal (51..55). */
export const LUDO_HOME_LANE_START = 51;
export const LUDO_HOME_LANE_END = 55;
/** Center home triangle (finished). */
export const LUDO_HOME_STEP = 56;

export const LUDO_COLOR_STARTS: Record<LudoColor, number> = {
  coral: 0,
  mint: 13,
  sunshine: 26,
  sky: 39,
};

/** Shared clockwise ring, starting at the coral entry square. Coordinates are [column, row]. */
export const LUDO_TRACK_COORDINATES = [
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  [7, 0],
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  [14, 7],
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  [7, 14],
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  [0, 7],
  [0, 6],
] as const;

/** Star squares on the shared ring. Start squares are protected separately. */
export const LUDO_STAR_SQUARES = [8, 21, 34, 47] as const;
export const LUDO_STAR_SQUARE_SET = new Set<number>(LUDO_STAR_SQUARES);

export const LUDO_SAFE_SQUARES = new Set<number>([
  ...Object.values(LUDO_COLOR_STARTS),
  ...LUDO_STAR_SQUARES,
]);

export interface LudoPlayerState {
  userId: string;
  name: string;
  image?: string | null;
  color: LudoColor;
  /** -1 = yard, 0..50 = shared track, 51..55 = safe home lane, 56 = home goal. */
  tokens: number[];
}

export interface LudoPlayerRollStats {
  /** Number of consecutive rolls without a 6. */
  turnsWithoutSix: number;
  /** Number of consecutive 6s rolled within the active turn. */
  consecutiveSixes: number;
  /** Consecutive rolls that produced zero legal moves. */
  deadTurnStreak: number;
  /** Last up-to-4 dice outcomes for anti-streak smoothing. */
  recentRolls: number[];
}

export interface LudoGameState {
  players: LudoPlayerState[];
  lastRolls: number[];
  currentPlayerIndex: number;
  dice: number | null;
  movableTokens: number[];
  winnerId: string | null;
  lastAction: string;
  updatedAt: number;
  /** Optional per-player roll history for balanced commercial Ludo dice probability. */
  rollStats?: LudoPlayerRollStats[];
}

export function createInitialRollStats(count: number): LudoPlayerRollStats[] {
  return Array.from({ length: count }, () => ({
    turnsWithoutSix: 0,
    consecutiveSixes: 0,
    deadTurnStreak: 0,
    recentRolls: [],
  }));
}

export function createLudoGameState(
  players: readonly { userId: string; name: string; image?: string | null }[],
): LudoGameState {
  const colors: readonly LudoColor[] =
    players.length === 2
      ? ["coral", "sunshine"]
      : players.length === 3
        ? ["coral", "mint", "sunshine"]
        : LUDO_COLORS;

  return {
    players: players.map((player, index) => ({
      userId: player.userId,
      name: player.name,
      image: player.image ?? null,
      color: colors[index] ?? "coral",
      tokens: [LUDO_YARD_STEP, LUDO_YARD_STEP, LUDO_YARD_STEP, LUDO_YARD_STEP],
    })),
    lastRolls: players.map(() => 1),
    currentPlayerIndex: 0,
    dice: null,
    movableTokens: [],
    winnerId: null,
    lastAction: `${players[0]?.name ?? "Players"} are ready. Roll a 6 to leave your yard.`,
    updatedAt: Date.now(),
    rollStats: createInitialRollStats(players.length),
  };
}

export function getLudoTrackSquare(
  color: LudoColor,
  progress: number,
): number | null {
  if (progress < 0 || progress > LUDO_MAX_SHARED_PROGRESS) return null;
  return (LUDO_COLOR_STARTS[color] + progress) % LUDO_TRACK_RING_SIZE;
}

export function isLudoSafeSquare(color: LudoColor, progress: number): boolean {
  const sq = getLudoTrackSquare(color, progress);
  return sq !== null && LUDO_SAFE_SQUARES.has(sq);
}

export function isLudoStarSquare(color: LudoColor, progress: number): boolean {
  const sq = getLudoTrackSquare(color, progress);
  return sq !== null && LUDO_STAR_SQUARE_SET.has(sq);
}

export function getLudoCaptureTargets(
  players: readonly LudoPlayerState[],
  activePlayerIndex: number,
  landingSquare: number,
): Array<{ playerIndex: number; tokenIndex: number }> {
  if (LUDO_SAFE_SQUARES.has(landingSquare)) return [];

  return players.flatMap((player, playerIndex) =>
    playerIndex === activePlayerIndex
      ? []
      : player.tokens.flatMap((progress, tokenIndex) =>
          getLudoTrackSquare(player.color, progress) === landingSquare
            ? [{ playerIndex, tokenIndex }]
            : [],
        ),
  );
}

export function getLudoMovableTokens(
  player: LudoPlayerState,
  dice: number,
): number[] {
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) return [];

  return player.tokens.flatMap((progress, tokenIndex) => {
    if (progress === LUDO_YARD_STEP) return dice === 6 ? [tokenIndex] : [];
    if (progress >= LUDO_HOME_STEP) return [];
    return progress + dice <= LUDO_HOME_STEP ? [tokenIndex] : [];
  });
}

/**
 * Returns the tokenIndex to auto-move when the player has zero real strategic choice:
 * - Exactly 1 token is movable, OR
 * - Multiple tokens are movable, but ALL of them sit on the exact same progress
 *   (e.g., rolling a 6 when only yard tokens can move, or 2+ stacked tokens on one square
 *   with no other movable pieces).
 */
export function getLudoAutoMoveToken(
  player: LudoPlayerState,
  movableTokens: readonly number[],
): number | null {
  if (movableTokens.length === 0) return null;
  const firstToken = movableTokens[0];
  if (firstToken === undefined) return null;
  if (movableTokens.length === 1) return firstToken;

  const uniquePositions = new Set<number>();
  for (const tokenIndex of movableTokens) {
    const progress = player.tokens[tokenIndex];
    if (progress !== undefined) {
      uniquePositions.add(progress);
      if (uniquePositions.size > 1) return null;
    }
  }

  return uniquePositions.size === 1 ? firstToken : null;
}

function randomUnitFloat(): number {
  const cryptoObj = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint32Array) => Uint32Array };
    }
  ).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    const val = buf[0];
    if (val !== undefined) {
      return val / 0x1_0000_0000;
    }
  }
  return Math.random();
}

/**
 * Balanced commercial Ludo dice generator:
 * - CSPRNG entropy base
 * - Anti-clumping repeat dampener (prevents unnatural 3x-4x repeats of non-6 faces)
 * - Yard-break pity curve (eliminates 12+ turn opening lockouts when no active tokens are out)
 * - Consecutive-6 decay (prevents runaway multi-6 steamrolls)
 * - Endgame exact-finish anti-stall (prevents endless dead turns right outside Home)
 */
export function rollProfessionalLudoDice(
  state: LudoGameState,
  playerIndex: number,
): { dice: number; rollStats: LudoPlayerRollStats[] } {
  const playerCount = state.players.length;
  const baseStats =
    state.rollStats && state.rollStats.length === playerCount
      ? state.rollStats
      : createInitialRollStats(playerCount);

  const player = state.players[playerIndex];
  const currentStats: LudoPlayerRollStats = baseStats[playerIndex] ?? {
    turnsWithoutSix: 0,
    consecutiveSixes: 0,
    deadTurnStreak: 0,
    recentRolls: [],
  };

  // Base weights for faces 1..6
  const weights: [number, number, number, number, number, number] = [
    100, 100, 100, 100, 100, 100,
  ];

  if (player) {
    const yardCount = player.tokens.filter((t) => t === LUDO_YARD_STEP).length;
    const activeBoardCount = player.tokens.filter(
      (t) => t >= 0 && t < LUDO_HOME_STEP,
    ).length;

    // 1. Anti-clumping on non-6 faces
    const recent = currentStats.recentRolls;
    const lastRoll = recent[recent.length - 1];
    const prevRoll = recent[recent.length - 2];
    if (lastRoll !== undefined && lastRoll >= 1 && lastRoll <= 5) {
      const idx = (lastRoll - 1) as 0 | 1 | 2 | 3 | 4;
      weights[idx] *= prevRoll === lastRoll ? 0.24 : 0.64;
    }

    // 2. Yard-drought pity vs consecutive-6 decay
    if (currentStats.consecutiveSixes === 1) {
      weights[5] = 82;
    } else if (currentStats.consecutiveSixes >= 2) {
      weights[5] = 24;
    } else if (activeBoardCount === 0 && yardCount > 0) {
      // All remaining pieces are locked in the yard: ramp 6 probability smoothly on dry streaks
      const dry = currentStats.turnsWithoutSix;
      if (dry <= 1) weights[5] = 122;
      else if (dry === 2) weights[5] = 155;
      else if (dry === 3) weights[5] = 215;
      else if (dry === 4) weights[5] = 310;
      else if (dry === 5) weights[5] = 450;
      else weights[5] = 680;
    } else if (yardCount >= 2 && currentStats.turnsWithoutSix >= 5) {
      weights[5] = 132;
    }

    // 3. Endgame exact-home anti-stall when pieces need exact small faces
    if (yardCount === 0 && activeBoardCount > 0) {
      if (
        currentStats.consecutiveSixes === 0 &&
        getLudoMovableTokens(player, 6).length === 0
      ) {
        weights[5] *= 0.72;
      }
      if (currentStats.deadTurnStreak >= 3) {
        const boost = 1.45 + Math.min(3, currentStats.deadTurnStreak - 3) * 0.3;
        for (let face = 1; face <= 6; face++) {
          if (getLudoMovableTokens(player, face).length > 0) {
            const idx = (face - 1) as 0 | 1 | 2 | 3 | 4 | 5;
            weights[idx] *= boost;
          }
        }
      }
    }
  }

  let totalWeight = 0;
  for (let i = 0; i < 6; i++) {
    const clamped = Math.max(1, weights[i] ?? 1);
    weights[i as 0 | 1 | 2 | 3 | 4 | 5] = clamped;
    totalWeight += clamped;
  }

  let threshold = randomUnitFloat() * totalWeight;
  let rolled = 6;
  for (let i = 0; i < 6; i++) {
    threshold -= weights[i] ?? 1;
    if (threshold <= 0) {
      rolled = i + 1;
      break;
    }
  }

  const hasValidMoves = player
    ? getLudoMovableTokens(player, rolled).length > 0
    : true;

  const nextStats = baseStats.map((entry, idx) => {
    if (idx !== playerIndex) {
      return entry.consecutiveSixes !== 0
        ? { ...entry, consecutiveSixes: 0 }
        : entry;
    }
    return {
      turnsWithoutSix: rolled === 6 ? 0 : entry.turnsWithoutSix + 1,
      consecutiveSixes: rolled === 6 ? entry.consecutiveSixes + 1 : 0,
      deadTurnStreak: hasValidMoves ? 0 : entry.deadTurnStreak + 1,
      recentRolls: [...entry.recentRolls.slice(-3), rolled],
    };
  });

  return { dice: rolled, rollStats: nextStats };
}
