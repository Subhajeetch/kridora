import {
  getLudoTrackSquare,
  isLudoSafeSquare,
  isLudoStarSquare,
  LUDO_HOME_LANE_END,
  LUDO_HOME_LANE_START,
  LUDO_HOME_STEP,
  LUDO_MAX_SHARED_PROGRESS,
  LUDO_YARD_STEP,
  type LudoColor,
  type LudoGameState,
  type LudoPlayerState,
} from "@kridora/shared";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { AudioSettings } from "@/lib/audio-settings";
import { cn } from "@/lib/utils";
import { ludoAudio } from "../audio";
import {
  BOARD_TRACK,
  COLOR_ORDER,
  GOAL_SLOT_OFFSETS,
  SEAT_DEFINITIONS,
  STATIC_BOARD_CELLS,
} from "../constants";
import styles from "../ludo.module.css";
import type {
  BoardCoordinate,
  CapturedReturnPath,
  MovementPath,
} from "../types";

interface LudoBoardProps {
  state: LudoGameState;
  userId: string;
  onMoveToken: (tokenIndex: number) => void;
  audioSettings?: AudioSettings;
  occupiedColors: Set<LudoColor>;
  playerAvatars: Record<string, string | null>;
}

interface ActiveReturnState extends CapturedReturnPath {
  waitingForImpact: boolean;
  stepMs: number;
}

interface BoardFxItem {
  id: number;
  kind: "capture" | "safe";
  coord: BoardCoordinate;
}

const HOP_STEP_MS = 130;

const STACK_OFFSETS: Record<1 | 2 | 3 | 4, ReadonlyArray<BoardCoordinate>> = {
  1: [[0, 0]],
  2: [
    [-0.13, -0.11],
    [0.10, 0.11],
  ],
  3: [
    [-0.13, 0],
    [0.10, -0.13],
    [0.10, 0.13],
  ],
  4: [
    [-0.13, -0.13],
    [-0.13, 0.13],
    [0.10, -0.13],
    [0.10, 0.13],
  ],
};

function StarIcon({
  fill,
  stroke = "rgba(0,0,0,0.3)",
}: {
  fill: string;
  stroke?: string;
}) {
  return (
    <svg
      className="size-[72%]"
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

/** Shared SVG radial gradients defined once instead of 16 duplicate DOM IDs. */
const SharedPawnSvgDefs = memo(function SharedPawnSvgDefs() {
  return (
    <svg
      width="0"
      height="0"
      className="pointer-events-none absolute opacity-0"
      aria-hidden="true"
    >
      <defs>
        {COLOR_ORDER.map((color) => {
          const seat = SEAT_DEFINITIONS[color];
          return (
            <radialGradient
              key={color}
              id={`pawnGrad_${color}`}
              cx="32%"
              cy="28%"
              r="70%"
            >
              <stop offset="0%" stopColor={seat.pawnLight} />
              <stop offset="45%" stopColor={seat.pawnMid} />
              <stop offset="100%" stopColor={seat.pawnDark} />
            </radialGradient>
          );
        })}
      </defs>
    </svg>
  );
});

const CenterGoal = memo(function CenterGoal() {
  return (
    <div className={styles.centerGoal}>
      <svg
        viewBox="0 0 100 100"
        className="block size-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon
          points="0,0 50,50 0,100"
          fill="#ff1a1a"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <polygon
          points="0,0 100,0 50,50"
          fill="#12b84a"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <polygon
          points="100,0 100,100 50,50"
          fill="#f6ce00"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <polygon
          points="0,100 100,100 50,50"
          fill="#0098ec"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
});

/** Static 72-cell perimeter + safe home lanes: only re-renders when selectable cells change. */
const BoardTrackCells = memo(function BoardTrackCells({
  selectableByCell,
  onSelectCellToken,
}: {
  selectableByCell: ReadonlyMap<string, number>;
  onSelectCellToken: (tokenIndex: number) => void;
}) {
  return (
    <>
      {STATIC_BOARD_CELLS.map((cell) => {
        const movableTokenIdx = selectableByCell.get(cell.key);
        const isSelectable = movableTokenIdx !== undefined;

        return (
          <div
            key={cell.key}
            style={{
              gridRow: cell.row + 1,
              gridColumn: cell.col + 1,
              backgroundColor: cell.bg,
            }}
            onClick={
              isSelectable
                ? () => onSelectCellToken(movableTokenIdx)
                : undefined
            }
            className={cn(
              styles.boardCell,
              isSelectable && styles.selectableCell,
            )}
          >
            {cell.kind === "start" && <StarIcon fill="rgba(0,0,0,0.3)" />}
            {cell.kind === "star" && (
              <StarIcon fill="#5c7c9e" stroke="#47627f" />
            )}
            {cell.kind === "arrow" && cell.arrowHex && (
              <svg
                className="size-3/5"
                style={{ transform: `rotate(${cell.arrowRot ?? 0}deg)` }}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 12H19M13 6L19 12L13 18"
                  stroke={cell.arrowHex}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        );
      })}
    </>
  );
});

const Pawn3D = memo(function Pawn3D({
  color,
  tokenIndex,
  movable,
  isHopping,
  isReturning,
  rewindStepMs,
  scale,
  rowPos,
  colPos,
  onActivate,
  onHoverStart,
  onHoverEnd,
  label,
}: {
  color: LudoColor;
  tokenIndex: number;
  movable: boolean;
  isHopping: boolean;
  isReturning: boolean;
  rewindStepMs?: number;
  scale: number;
  rowPos: number;
  colPos: number;
  onActivate: (tokenIndex: number) => void;
  onHoverStart: (tokenIndex: number) => void;
  onHoverEnd: () => void;
  label: string;
}) {
  // 1 unit of [row, col] equals 100% of .tokenHitBox (which is 1/15th of .tokensLayer)
  const txPct = (colPos - 0.5) * 100;
  const tyPct = (rowPos - 0.5) * 100;

  const hitBoxStyle: CSSProperties & { "--rewind-ms"?: string } = {
    top: 0,
    left: 0,
    transform: `translate3d(${txPct}%, ${tyPct}%, 0) scale(${scale})`,
  };
  if (isReturning && rewindStepMs !== undefined) {
    hitBoxStyle["--rewind-ms"] = `${rewindStepMs}ms`;
  }

  return (
    <div
      role={movable ? "button" : undefined}
      tabIndex={movable ? 0 : -1}
      aria-label={label}
      onClick={movable ? () => onActivate(tokenIndex) : undefined}
      onMouseEnter={movable ? () => onHoverStart(tokenIndex) : undefined}
      onMouseLeave={movable ? onHoverEnd : undefined}
      onKeyDown={
        movable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(tokenIndex);
              }
            }
          : undefined
      }
      style={hitBoxStyle}
      className={cn(
        styles.tokenHitBox,
        movable && styles.isMovable,
        isHopping && styles.isHopping,
        isReturning && styles.isReturning,
      )}
    >
      {movable && <div className={styles.tokenBaseRing} />}
      <div className={styles.tokenVisual}>
        <svg
          viewBox="0 3.5 64 64"
          className="size-full overflow-visible"
          aria-hidden="true"
        >
          <ellipse cx="32" cy="58.5" rx="15" ry="4.2" fill="rgba(0,0,0,0.34)" />
          <path
            d="M16 52 C16 39, 23 32, 25 23 C22 19, 22 11, 32 11 C42 11, 42 19, 39 23 C41 32, 48 39, 48 52 C48 61, 16 61, 16 52 Z"
            fill={`url(#pawnGrad_${color})`}
            stroke="#062238"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path
            d="M22 49 C22 39, 26 33, 28 25"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse
            cx="29"
            cy="16.5"
            rx="3.8"
            ry="2.6"
            transform="rotate(-20 29 16.5)"
            fill="rgba(255,255,255,0.88)"
          />
        </svg>
      </div>
    </div>
  );
});

export function LudoBoard({
  state,
  userId,
  onMoveToken,
  audioSettings,
  occupiedColors,
  playerAvatars,
}: LudoBoardProps) {
  const activePlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = activePlayer?.userId === userId;
  const movableTokens = useMemo(
    () => (isMyTurn && state.dice !== null ? state.movableTokens : []),
    [isMyTurn, state.dice, state.movableTokens],
  );

  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(
    null,
  );
  const [movementPaths, setMovementPaths] = useState<
    Record<string, MovementPath>
  >({});
  const [returnPaths, setReturnPaths] = useState<
    Record<string, ActiveReturnState>
  >({});
  const [boardFx, setBoardFx] = useState<BoardFxItem[]>([]);

  const audioRef = useRef<AudioSettings | undefined>(audioSettings);
  useEffect(() => {
    audioRef.current = audioSettings;
  }, [audioSettings]);

  const previousProgress = useRef<Map<string, number> | null>(null);
  const movementTimers = useRef<Map<string, number[]>>(new Map());
  const returnTimers = useRef<Map<string, number[]>>(new Map());
  const fxTimers = useRef<Set<number>>(new Set());
  const animSeq = useRef(0);

  const spawnBoardFx = useCallback(
    (kind: "capture" | "safe", coord: BoardCoordinate) => {
      const id = ++animSeq.current;
      setBoardFx((prev) => [...prev, { id, kind, coord }]);
      const timer = window.setTimeout(() => {
        setBoardFx((prev) => prev.filter((item) => item.id !== id));
        fxTimers.current.delete(timer);
      }, 540);
      fxTimers.current.add(timer);
    },
    [],
  );

  /**
   * Maps logical token progress (-1..56) to [row, col] board coordinates:
   * - -1:     Corner yard socket
   * - 0..50:  51-square outer track (ending at the player's entry arrow)
   * - 51..55: 5-square protected home stretch
   * - 56:     Center home goal triangle
   */
  const getTokenCoord = useCallback(
    (color: LudoColor, tokenIdx: number, step: number): BoardCoordinate => {
      const seat = SEAT_DEFINITIONS[color];
      if (step <= LUDO_YARD_STEP) {
        return seat.yardCoords[tokenIdx] ?? [0, 0];
      }
      if (step <= LUDO_MAX_SHARED_PROGRESS) {
        const trackIdx = getLudoTrackSquare(color, step);
        const trackCell =
          trackIdx !== null ? BOARD_TRACK[trackIdx] : undefined;
        if (trackCell) {
          return [trackCell[0] + 0.5, trackCell[1] + 0.5];
        }
      }
      if (step >= LUDO_HOME_LANE_START && step <= LUDO_HOME_LANE_END) {
        const hc = seat.homeColumn[step - LUDO_HOME_LANE_START];
        if (hc) {
          return [hc[0] + 0.5, hc[1] + 0.5];
        }
      }
      return seat.goalCoord;
    },
    [],
  );

  // Step-by-step forward hop animation + synchronized capture rewind choreography
  useLayoutEffect(() => {
    const nextProgress = new Map<string, number>();
    for (const player of state.players) {
      player.tokens.forEach((progress, tokenIndex) => {
        nextProgress.set(`${player.userId}:${tokenIndex}`, progress);
      });
    }

    const prev = previousProgress.current;
    previousProgress.current = nextProgress;
    if (!prev) return;

    const isFreshReset =
      state.dice === null &&
      state.players.every((p) =>
        p.tokens.every((t) => t === LUDO_YARD_STEP),
      ) &&
      state.lastAction.includes("ready");

    if (isFreshReset) return;

    // 1. Detect forward movements first so we know exact attacker arrival time
    let attackerArrivalMs = 0;
    let captureHappenedInTurn = false;

    for (const player of state.players) {
      player.tokens.forEach((progress, tokenIndex) => {
        const oldProgress = prev.get(`${player.userId}:${tokenIndex}`);
        if (
          oldProgress !== undefined &&
          oldProgress >= 0 &&
          progress === LUDO_YARD_STEP
        ) {
          captureHappenedInTurn = true;
        }
      });
    }

    for (const player of state.players) {
      player.tokens.forEach((progress, tokenIndex) => {
        const key = `${player.userId}:${tokenIndex}`;
        const oldProgress = prev.get(key);
        if (oldProgress === undefined || progress <= oldProgress) return;

        const pathPoints: BoardCoordinate[] = [];
        const startStep = oldProgress < 0 ? 0 : oldProgress + 1;
        for (let s = startStep; s <= progress; s++) {
          pathPoints.push(getTokenCoord(player.color, tokenIndex, s));
        }
        if (pathPoints.length === 0) return;

        const animId = ++animSeq.current;
        movementTimers.current.get(key)?.forEach((t) => window.clearTimeout(t));
        returnTimers.current.get(key)?.forEach((t) => window.clearTimeout(t));

        const arrivalMs =
          Math.max(0, pathPoints.length - 1) * HOP_STEP_MS + 95;
        if (arrivalMs > attackerArrivalMs) {
          attackerArrivalMs = arrivalMs;
        }

        if (oldProgress < 0) {
          ludoAudio.unlockBase(audioRef.current);
        } else {
          ludoAudio.hop(0, audioRef.current);
        }

        setMovementPaths((curr) => ({
          ...curr,
          [key]: {
            id: animId,
            points: pathPoints,
            step: 0,
            launchFrom:
              oldProgress < 0
                ? getTokenCoord(player.color, tokenIndex, LUDO_YARD_STEP)
                : undefined,
          },
        }));

        const timers: number[] = [];
        for (let stepIdx = 1; stepIdx < pathPoints.length; stepIdx++) {
          timers.push(
            window.setTimeout(() => {
              ludoAudio.hop(stepIdx, audioRef.current);
              setMovementPaths((paths) => {
                const existing = paths[key];
                if (!existing || existing.id !== animId) return paths;
                return {
                  ...paths,
                  [key]: { ...existing, step: stepIdx },
                };
              });
            }, stepIdx * HOP_STEP_MS),
          );
        }

        const finishDelay = pathPoints.length * HOP_STEP_MS + 35;
        const landingCoord = pathPoints[pathPoints.length - 1]!;
        const playerWonMatch =
          state.winnerId === player.userId ||
          player.tokens.every((t) => t === LUDO_HOME_STEP);

        timers.push(
          window.setTimeout(() => {
            if (progress === LUDO_HOME_STEP) {
              if (playerWonMatch) {
                ludoAudio.victory(audioRef.current);
              } else {
                ludoAudio.homeFinish(audioRef.current);
              }
              spawnBoardFx("safe", landingCoord);
            } else if (!captureHappenedInTurn && oldProgress >= 0) {
              const landedOnSafeTrack =
                isLudoStarSquare(player.color, progress) ||
                isLudoSafeSquare(player.color, progress);
              const enteredSafeHomeLane =
                oldProgress <= LUDO_MAX_SHARED_PROGRESS &&
                progress >= LUDO_HOME_LANE_START &&
                progress <= LUDO_HOME_LANE_END;

              if (landedOnSafeTrack || enteredSafeHomeLane) {
                ludoAudio.safeZone(audioRef.current);
                spawnBoardFx("safe", landingCoord);
              }
            }

            setMovementPaths((paths) => {
              if (paths[key]?.id !== animId) return paths;
              const next = { ...paths };
              delete next[key];
              return next;
            });
            movementTimers.current.delete(key);
          }, finishDelay),
        );

        movementTimers.current.set(key, timers);
      });
    }

    // 2. Animate captured tokens backward along the exact track path they came from
    let impactSoundScheduled = false;

    for (const player of state.players) {
      player.tokens.forEach((progress, tokenIndex) => {
        const key = `${player.userId}:${tokenIndex}`;
        const oldProgress = prev.get(key);
        if (
          oldProgress === undefined ||
          oldProgress < 0 ||
          progress !== LUDO_YARD_STEP
        ) {
          return;
        }

        // Build reverse path: captureSquare (oldProgress) -> ... -> 0 -> yardSocket (-1)
        const reversePoints: BoardCoordinate[] = [];
        for (
          let s = Math.min(oldProgress, LUDO_MAX_SHARED_PROGRESS);
          s >= 0;
          s--
        ) {
          reversePoints.push(getTokenCoord(player.color, tokenIndex, s));
        }
        reversePoints.push(
          getTokenCoord(player.color, tokenIndex, LUDO_YARD_STEP),
        );

        if (reversePoints.length < 2) return;

        const animId = ++animSeq.current;
        movementTimers.current.get(key)?.forEach((t) => window.clearTimeout(t));
        returnTimers.current.get(key)?.forEach((t) => window.clearTimeout(t));

        const stepMs = Math.max(
          18,
          Math.min(42, Math.floor(680 / reversePoints.length)),
        );
        const holdMs = attackerArrivalMs;
        const captureCoord = reversePoints[0]!;

        // Hold victim stationary at reversePoints[0] while attacker hops onto the square
        setReturnPaths((curr) => ({
          ...curr,
          [key]: {
            id: animId,
            points: reversePoints,
            step: 0,
            waitingForImpact: holdMs > 0,
            stepMs,
          },
        }));

        const timers: number[] = [];

        // Trigger capture hit sound + visual shockwave once at moment of contact
        if (!impactSoundScheduled) {
          impactSoundScheduled = true;
          timers.push(
            window.setTimeout(() => {
              ludoAudio.captureHit(audioRef.current);
              spawnBoardFx("capture", captureCoord);
            }, holdMs),
          );
        }

        const rewindStartMs = holdMs + 75;
        timers.push(
          window.setTimeout(() => {
            ludoAudio.returnZip(audioRef.current);
            setReturnPaths((paths) => {
              const existing = paths[key];
              if (!existing || existing.id !== animId) return paths;
              return {
                ...paths,
                [key]: { ...existing, waitingForImpact: false, step: 1 },
              };
            });
          }, rewindStartMs),
        );

        // Secondary zip cascade for long cross-board rewinds
        if (reversePoints.length * stepMs > 320) {
          timers.push(
            window.setTimeout(() => {
              ludoAudio.returnZip(audioRef.current);
            }, rewindStartMs + 220),
          );
        }

        for (let stepIdx = 2; stepIdx < reversePoints.length; stepIdx++) {
          timers.push(
            window.setTimeout(
              () => {
                setReturnPaths((paths) => {
                  const existing = paths[key];
                  if (!existing || existing.id !== animId) return paths;
                  return {
                    ...paths,
                    [key]: { ...existing, step: stepIdx },
                  };
                });
              },
              rewindStartMs + (stepIdx - 1) * stepMs,
            ),
          );
        }

        const totalDoneMs =
          rewindStartMs + reversePoints.length * stepMs + 60;
        timers.push(
          window.setTimeout(() => {
            setReturnPaths((paths) => {
              if (paths[key]?.id !== animId) return paths;
              const next = { ...paths };
              delete next[key];
              return next;
            });
            returnTimers.current.delete(key);
          }, totalDoneMs),
        );

        returnTimers.current.set(key, timers);
      });
    }
  }, [state.players, state.updatedAt, state.dice, state.lastAction, state.winnerId, getTokenCoord, spawnBoardFx]);

  useEffect(() => {
    const moveTimersMap = movementTimers.current;
    const retTimersMap = returnTimers.current;
    const activeFxSet = fxTimers.current;

    return () => {
      moveTimersMap.forEach((list) => list.forEach((t) => window.clearTimeout(t)));
      moveTimersMap.clear();
      retTimersMap.forEach((list) => list.forEach((t) => window.clearTimeout(t)));
      retTimersMap.clear();
      activeFxSet.forEach((t) => window.clearTimeout(t));
      activeFxSet.clear();
    };
  }, []);

  const handleHoverStart = useCallback((tokenIndex: number) => {
    setHoveredTokenIndex(tokenIndex);
    ludoAudio.hoverTick(audioRef.current);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredTokenIndex(null);
  }, []);

  // Group stationary tokens by cell for clean stacking & finished-goal fan-out
  const { tokensToRender, stackBadges, selectableByCell } = useMemo(() => {
    const stationaryGroups = new Map<
      string,
      Array<{
        key: string;
        player: LudoPlayerState;
        tokenIndex: number;
        step: number;
        baseCoord: BoardCoordinate;
      }>
    >();

    const rendered: Array<{
      key: string;
      player: LudoPlayerState;
      tokenIndex: number;
      step: number;
      finalR: number;
      finalC: number;
      scale: number;
      isMovable: boolean;
      isHopping: boolean;
      isReturning: boolean;
      rewindStepMs?: number;
    }> = [];

    for (const player of state.players) {
      player.tokens.forEach((step, tokenIndex) => {
        const key = `${player.userId}:${tokenIndex}`;
        const activeMove = movementPaths[key];
        const activeReturn = returnPaths[key];

        if (activeMove) {
          const coord =
            activeMove.points[activeMove.step] ??
            getTokenCoord(player.color, tokenIndex, step);
          rendered.push({
            key,
            player,
            tokenIndex,
            step,
            finalR: coord[0],
            finalC: coord[1],
            scale: 1,
            isMovable: false,
            isHopping: true,
            isReturning: false,
          });
          return;
        }

        if (activeReturn) {
          const coord =
            activeReturn.points[activeReturn.step] ??
            getTokenCoord(player.color, tokenIndex, LUDO_YARD_STEP);
          rendered.push({
            key,
            player,
            tokenIndex,
            step,
            finalR: coord[0],
            finalC: coord[1],
            scale: 1,
            isMovable: false,
            isHopping: false,
            isReturning: !activeReturn.waitingForImpact,
            rewindStepMs: activeReturn.stepMs,
          });
          return;
        }

        const baseCoord = getTokenCoord(player.color, tokenIndex, step);
        let groupKey: string;
        if (step <= LUDO_YARD_STEP) {
          groupKey = `yard_${player.color}_${tokenIndex}`;
        } else if (step === LUDO_HOME_STEP) {
          groupKey = `goal_${player.color}`;
        } else {
          groupKey = `cell_${Math.floor(baseCoord[0])}_${Math.floor(baseCoord[1])}`;
        }

        const bucket = stationaryGroups.get(groupKey);
        if (bucket) {
          bucket.push({ key, player, tokenIndex, step, baseCoord });
        } else {
          stationaryGroups.set(groupKey, [
            { key, player, tokenIndex, step, baseCoord },
          ]);
        }
      });
    }

    const badges: Array<{ key: string; coord: BoardCoordinate; count: number }> =
      [];
    const cellSelectable = new Map<string, number>();

    stationaryGroups.forEach((group, groupKey) => {
      group.sort((a, b) => {
        const aMov =
          isMyTurn &&
          a.player.userId === userId &&
          movableTokens.includes(a.tokenIndex)
            ? 1
            : 0;
        const bMov =
          isMyTurn &&
          b.player.userId === userId &&
          movableTokens.includes(b.tokenIndex)
            ? 1
            : 0;
        return aMov - bMov;
      });

      const count = group.length;
      if (count > 1 && groupKey.startsWith("cell_")) {
        const anchor = group[0]?.baseCoord;
        if (anchor) {
          badges.push({
            key: `badge_${groupKey}`,
            coord: [anchor[0] + 0.34, anchor[1] + 0.34],
            count,
          });
        }
      }

      group.forEach((tok, idx) => {
        let dR = 0;
        let dC = 0;
        let scale = 1;

        if (tok.step >= 0 && tok.step < LUDO_HOME_STEP && count > 1) {
          scale = count === 2 ? 0.76 : count === 3 ? 0.70 : 0.65;
          const pattern = STACK_OFFSETS[Math.min(count, 4) as 1 | 2 | 3 | 4];
          const offset = pattern[idx];
          if (offset) {
            dR = offset[0];
            dC = offset[1];
          }
        } else if (tok.step === LUDO_HOME_STEP) {
          scale = count > 1 ? 0.76 : 0.82;
          if (count > 1) {
            const goalOffset = GOAL_SLOT_OFFSETS[tok.player.color][idx];
            if (goalOffset) {
              dR = goalOffset[0];
              dC = goalOffset[1];
            }
          }
        }

        const isMovable =
          Boolean(isMyTurn) &&
          tok.player.userId === userId &&
          movableTokens.includes(tok.tokenIndex);

        if (isMovable && tok.step >= 0 && tok.step < LUDO_HOME_STEP) {
          const cellKey = `${Math.floor(tok.baseCoord[0])},${Math.floor(tok.baseCoord[1])}`;
          cellSelectable.set(cellKey, tok.tokenIndex);
        }

        rendered.push({
          key: tok.key,
          player: tok.player,
          tokenIndex: tok.tokenIndex,
          step: tok.step,
          finalR: tok.baseCoord[0] + dR,
          finalC: tok.baseCoord[1] + dC,
          scale,
          isMovable,
          isHopping: false,
          isReturning: false,
        });
      });
    });

    return {
      tokensToRender: rendered,
      stackBadges: badges,
      selectableByCell: cellSelectable,
    };
  }, [
    state.players,
    movementPaths,
    returnPaths,
    getTokenCoord,
    isMyTurn,
    userId,
    movableTokens,
  ]);

  // Preview destination reticle + breadcrumbs for hovered token (or single/identical movable choice)
  const { previewTokenIndex, destReticleCoord, pathDotsCoords, previewColor } =
    useMemo(() => {
      let activePreviewIdx = hoveredTokenIndex;
      if (
        activePreviewIdx === null &&
        isMyTurn &&
        state.dice !== null &&
        movableTokens.length === 1
      ) {
        activePreviewIdx = movableTokens[0] ?? null;
      }

      if (
        activePreviewIdx === null ||
        !isMyTurn ||
        !activePlayer ||
        state.dice === null ||
        !movableTokens.includes(activePreviewIdx)
      ) {
        return {
          previewTokenIndex: null,
          destReticleCoord: null,
          pathDotsCoords: [] as BoardCoordinate[],
          previewColor: null,
        };
      }

      const curStep = activePlayer.tokens[activePreviewIdx];
      if (curStep === undefined) {
        return {
          previewTokenIndex: null,
          destReticleCoord: null,
          pathDotsCoords: [] as BoardCoordinate[],
          previewColor: null,
        };
      }

      const targetStep = curStep < 0 ? 0 : curStep + state.dice;
      if (targetStep > LUDO_HOME_STEP) {
        return {
          previewTokenIndex: null,
          destReticleCoord: null,
          pathDotsCoords: [] as BoardCoordinate[],
          previewColor: null,
        };
      }

      const dots: BoardCoordinate[] = [];
      if (curStep >= 0) {
        for (let s = curStep + 1; s < targetStep; s++) {
          dots.push(getTokenCoord(activePlayer.color, activePreviewIdx, s));
        }
      }

      return {
        previewTokenIndex: activePreviewIdx,
        destReticleCoord: getTokenCoord(
          activePlayer.color,
          activePreviewIdx,
          targetStep,
        ),
        pathDotsCoords: dots,
        previewColor: activePlayer.color,
      };
    }, [
      hoveredTokenIndex,
      isMyTurn,
      state.dice,
      movableTokens,
      activePlayer,
      getTokenCoord,
    ]);

  return (
    <div className={styles.boardShell}>
      <SharedPawnSvgDefs />

      <div className={styles.ludoGrid}>
        {/* 4 Corner Yards */}
        <YardBox
          color="coral"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("coral")}
          movableTokens={movableTokens}
          isMyTurn={Boolean(isMyTurn)}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />
        <YardBox
          color="mint"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("mint")}
          movableTokens={movableTokens}
          isMyTurn={Boolean(isMyTurn)}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />
        <YardBox
          color="sky"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("sky")}
          movableTokens={movableTokens}
          isMyTurn={Boolean(isMyTurn)}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />
        <YardBox
          color="sunshine"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("sunshine")}
          movableTokens={movableTokens}
          isMyTurn={Boolean(isMyTurn)}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />

        {/* Center 3x3 Home Goal */}
        <CenterGoal />

        {/* Memoized 72-Cell Perimeter Track & 5-Cell Safe Home Lanes */}
        <BoardTrackCells
          selectableByCell={selectableByCell}
          onSelectCellToken={onMoveToken}
        />
      </div>

      {/* Interactive GPU Pawn & Visual FX Layer */}
      <div className={styles.tokensLayer}>
        {/* Capture Shockwaves & Safe-Star Sparkle Rings */}
        {boardFx.map((fx) => (
          <div
            key={fx.id}
            className={
              fx.kind === "capture"
                ? styles.captureShockwave
                : styles.safeSparkleRing
            }
            style={{
              top: `${(fx.coord[0] / 15) * 100}%`,
              left: `${(fx.coord[1] / 15) * 100}%`,
            }}
          />
        ))}

        {/* Breadcrumb Path Dots */}
        {pathDotsCoords.map(([r, c], dotIdx) => (
          <div
            key={`path-dot-${dotIdx}`}
            className={styles.pathDot}
            style={{
              top: `${(r / 15) * 100}%`,
              left: `${(c / 15) * 100}%`,
              backgroundColor: previewColor
                ? SEAT_DEFINITIONS[previewColor].boardHex
                : "#ffffff",
            }}
          />
        ))}

        {/* Destination Reticle */}
        {destReticleCoord && previewColor && (
          <div
            className={styles.destReticle}
            style={{
              top: `${(destReticleCoord[0] / 15) * 100}%`,
              left: `${(destReticleCoord[1] / 15) * 100}%`,
              borderColor: SEAT_DEFINITIONS[previewColor].boardHex,
              backgroundColor: `${SEAT_DEFINITIONS[previewColor].boardHex}44`,
            }}
            onClick={
              previewTokenIndex !== null
                ? () => onMoveToken(previewTokenIndex)
                : undefined
            }
            title="Tap destination square to move piece here"
          />
        )}

        {/* Stack Count Badges (x2, x3, x4) */}
        {stackBadges.map((b) => (
          <span
            key={b.key}
            className={styles.stackCountBadge}
            style={{
              top: `${(b.coord[0] / 15) * 100}%`,
              left: `${(b.coord[1] / 15) * 100}%`,
            }}
          >
            ×{b.count}
          </span>
        ))}

        {/* 3D Glossy Pawns */}
        {tokensToRender.map((tok) => (
          <Pawn3D
            key={tok.key}
            color={tok.player.color}
            tokenIndex={tok.tokenIndex}
            movable={tok.isMovable}
            isHopping={tok.isHopping}
            isReturning={tok.isReturning}
            rewindStepMs={tok.rewindStepMs}
            scale={tok.scale}
            rowPos={tok.finalR}
            colPos={tok.finalC}
            onActivate={onMoveToken}
            onHoverStart={handleHoverStart}
            onHoverEnd={handleHoverEnd}
            label={`${tok.player.name} token ${tok.tokenIndex + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

const YardBox = memo(function YardBox({
  color,
  state,
  userId,
  dimmed,
  movableTokens,
  isMyTurn,
  onMoveToken,
  playerAvatars,
}: {
  color: LudoColor;
  state: LudoGameState;
  userId: string;
  dimmed: boolean;
  movableTokens: number[];
  isMyTurn: boolean;
  onMoveToken: (tokenIndex: number) => void;
  playerAvatars: Record<string, string | null>;
}) {
  const player = state.players.find((p) => p.color === color);
  const isTop = color === "coral" || color === "mint";
  const avatarUrl = player
    ? (playerAvatars[player.userId] ?? player.image)
    : null;

  const yardClass = {
    coral: styles.yardRed,
    mint: styles.yardGreen,
    sunshine: styles.yardYellow,
    sky: styles.yardBlue,
  }[color];

  const socketClass = {
    coral: styles.socketRed,
    mint: styles.socketGreen,
    sunshine: styles.socketYellow,
    sky: styles.socketBlue,
  }[color];

  return (
    <div className={cn(styles.yardBox, yardClass, dimmed && styles.yardDimmed)}>
      <div
        className={cn(
          styles.yardLabel,
          isTop ? styles.yardLabelTop : styles.yardLabelBottom,
        )}
      >
        {player ? (
          <>
            <span className="inline-block size-4 shrink-0 overflow-hidden rounded-full border border-white/60 bg-slate-900 align-middle">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center text-[8px] font-black">
                  {player.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="max-w-[85px] truncate sm:max-w-[120px]">
              {player.name}
            </span>
          </>
        ) : (
          <span className="opacity-70">(Unoccupied)</span>
        )}
      </div>

      <div className={styles.yardWhiteInner}>
        {[0, 1, 2, 3].map((socketIdx) => {
          const hasYardToken =
            player && player.tokens[socketIdx] === LUDO_YARD_STEP;
          const isMovableYardToken =
            Boolean(hasYardToken) &&
            isMyTurn &&
            player?.userId === userId &&
            movableTokens.includes(socketIdx);

          return (
            <div
              key={`yard-sock-${color}-${socketIdx}`}
              onClick={
                isMovableYardToken ? () => onMoveToken(socketIdx) : undefined
              }
              className={cn(
                styles.yardSocket,
                socketClass,
                isMovableYardToken &&
                  "cursor-pointer ring-2 ring-white hover:scale-110 active:scale-95",
              )}
            />
          );
        })}
      </div>
    </div>
  );
});