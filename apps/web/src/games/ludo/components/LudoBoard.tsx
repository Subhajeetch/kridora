import { getLudoTrackSquare, type LudoColor, type LudoGameState } from "@kridora/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AudioSettings } from "@/lib/audio-settings";
import { cn } from "@/lib/utils";
import { ludoAudio } from "../audio";
import {
  BOARD_TRACK,
  ENTRY_ARROWS,
  GREY_STAR_INDICES,
  SEAT_DEFINITIONS,
} from "../constants";
import styles from "../ludo.module.css";
import type { BoardCoordinate, MovementPath } from "../types";

interface LudoBoardProps {
  state: LudoGameState;
  userId: string;
  onMoveToken: (tokenIndex: number) => void;
  audioSettings?: AudioSettings;
  occupiedColors: Set<LudoColor>;
  playerAvatars: Record<string, string | null>;
}

function StarIcon({ fill, stroke = "rgba(0,0,0,0.3)" }: { fill: string; stroke?: string }) {
  return (
    <svg className="size-[72%] drop-shadow-xs" viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function Pawn3D({
  color,
  movable,
  isHopping,
  isReturning,
  scale = 1,
  topPct,
  leftPct,
  onClick,
  onMouseEnter,
  onMouseLeave,
  label,
}: {
  color: LudoColor;
  movable: boolean;
  isHopping?: boolean;
  isReturning?: boolean;
  scale?: number;
  topPct: number;
  leftPct: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  label: string;
}) {
  const seat = SEAT_DEFINITIONS[color];
  const gradId = `pawnGrad_${color}`;

  return (
    <div
      role={movable ? "button" : undefined}
      tabIndex={movable ? 0 : -1}
      aria-label={label}
      onClick={movable ? onClick : undefined}
      onMouseEnter={movable ? onMouseEnter : undefined}
      onMouseLeave={movable ? onMouseLeave : undefined}
      onKeyDown={
        movable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      style={{
        top: `${topPct}%`,
        left: `${leftPct}%`,
      }}
      className={cn(
        styles.tokenHitBox,
        movable && styles.isMovable,
        isHopping && styles.isHopping,
        isReturning && styles.isReturning,
      )}
    >
      <div
        className={styles.tokenVisual}
        style={!movable && scale !== 1 ? { transform: `scale(${scale})` } : undefined}
      >
        {movable && <div className={styles.tokenBaseRing} />}
        <svg
          viewBox="0 3.5 64 64"
          className="size-full overflow-visible drop-shadow-[0_3px_4px_rgba(0,0,0,0.55)]"
        >
          <defs>
            <radialGradient id={gradId} cx="32%" cy="28%" r="70%">
              <stop offset="0%" stopColor={seat.pawnLight} />
              <stop offset="45%" stopColor={seat.pawnMid} />
              <stop offset="100%" stopColor={seat.pawnDark} />
            </radialGradient>
          </defs>

          {/* Ground Contact Shadow Ellipse beneath pawn base */}
          <ellipse cx="32" cy="58.5" rx="15" ry="4" fill="rgba(0,0,0,0.32)" />

          {/* Upright Sculpted Chess Pawn Body */}
          <path
            d="M16 52 C16 39, 23 32, 25 23 C22 19, 22 11, 32 11 C42 11, 42 19, 39 23 C41 32, 48 39, 48 52 C48 61, 16 61, 16 52 Z"
            fill={`url(#${gradId})`}
            stroke="#062238"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />

          {/* Glossy Left Specular Highlight Curve */}
          <path
            d="M22 49 C22 39, 26 33, 28 25"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Top Head Specular Highlight */}
          <ellipse cx="29" cy="16.5" rx="3.8" ry="2.6" transform="rotate(-20 29 16.5)" fill="rgba(255,255,255,0.88)" />
        </svg>
      </div>
    </div>
  );
}

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
  const movableTokens = isMyTurn && state.dice !== null ? state.movableTokens : [];

  // Hover preview state
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);

  // Track coordinates for token movement animations
  const [movementPaths, setMovementPaths] = useState<Record<string, MovementPath>>({});
  const previousProgress = useRef<Map<string, number> | null>(null);
  const movementTimers = useRef<Map<string, number[]>>(new Map());
  const movementSeq = useRef(0);

  /**
   * Returns [row, column] board coordinate.
   */
  const getTokenCoord = useCallback(
    (color: LudoColor, tokenIdx: number, step: number): BoardCoordinate => {
      const seat = SEAT_DEFINITIONS[color];
      // In yard: -1
      if (step < 0) return seat.yardCoords[tokenIdx] ?? [0, 0];
      // Main track: 0..51
      if (step <= 51) {
        const trackIdx = getLudoTrackSquare(color, step);
        if (trackIdx !== null && BOARD_TRACK[trackIdx]) {
          const [r, c] = BOARD_TRACK[trackIdx];
          return [r + 0.5, c + 0.5];
        }
      }
      // Home column: 52..56
      if (step >= 52 && step <= 56) {
        const hc = seat.homeColumn[step - 52];
        if (hc) return [hc[0] + 0.5, hc[1] + 0.5];
      }
      // Reached goal: 57
      return seat.goalCoord;
    },
    [],
  );

  // Animate token moves step by step with sounds
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

        const animId = ++movementSeq.current;
        const oldTimers = movementTimers.current.get(key);
        oldTimers?.forEach((t) => window.clearTimeout(t));

        if (oldProgress < 0) {
          ludoAudio.unlockBase(audioSettings);
        }

        setMovementPaths((p) => ({
          ...p,
          [key]: {
            id: animId,
            points: pathPoints,
            step: 0,
            launchFrom: oldProgress < 0 ? getTokenCoord(player.color, tokenIndex, -1) : undefined,
          },
        }));

        const timers: number[] = [];
        pathPoints.forEach((_, stepIdx) => {
          timers.push(
            window.setTimeout(
              () => {
                if (oldProgress >= 0 || stepIdx > 0) {
                  ludoAudio.hop(stepIdx, audioSettings);
                }
                setMovementPaths((paths) => {
                  const curr = paths[key];
                  if (!curr || curr.id !== animId) return paths;
                  return { ...paths, [key]: { ...curr, step: stepIdx } };
                });
              },
              stepIdx * 140,
            ),
          );
        });

        // Cleanup after completion
        timers.push(
          window.setTimeout(
            () => {
              if (progress === 57) {
                ludoAudio.homeFinish(audioSettings);
              }
              setMovementPaths((paths) => {
                if (paths[key]?.id !== animId) return paths;
                const next = { ...paths };
                delete next[key];
                return next;
              });
              movementTimers.current.delete(key);
            },
            pathPoints.length * 140 + 160,
          ),
        );

        movementTimers.current.set(key, timers);
      });
    }
  }, [state.players, state.updatedAt, getTokenCoord, audioSettings]);

  useEffect(
    () => () => {
      movementTimers.current.forEach((timers) => timers.forEach((t) => window.clearTimeout(t)));
      movementTimers.current.clear();
    },
    [],
  );

  // Group tokens for stacking offsets
  const stackOffsets = {
    1: [[0, 0]],
    2: [[-0.17, -0.11], [0.17, 0.11]],
    3: [[0, -0.19], [-0.19, 0.14], [0.19, 0.14]],
    4: [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]],
  } as const;

  // Discrete cell key -> list of tokens
  const cellGroups = new Map<string, Array<{ key: string; player: typeof state.players[0]; tokenIndex: number; step: number }>>();

  state.players.forEach((player) => {
    player.tokens.forEach((step, tokenIndex) => {
      const key = `${player.userId}:${tokenIndex}`;
      let groupKey: string;
      if (step < 0) {
        groupKey = `yard_${player.color}_${tokenIndex}`;
      } else if (step === 57) {
        groupKey = `goal_${player.color}`;
      } else {
        const [r, c] = getTokenCoord(player.color, tokenIndex, step);
        groupKey = `cell_${Math.floor(r)}_${Math.floor(c)}`;
      }

      if (!cellGroups.has(groupKey)) cellGroups.set(groupKey, []);
      cellGroups.get(groupKey)!.push({ key, player, tokenIndex, step });
    });
  });

  // Calculate rendered tokens with stack offsets
  const tokensToRender: Array<{
    key: string;
    player: typeof state.players[0];
    tokenIndex: number;
    step: number;
    finalR: number;
    finalC: number;
    scale: number;
    isMovable: boolean;
    isHopping: boolean;
    stackCount: number;
  }> = [];

  cellGroups.forEach((group) => {
    // Sort so movable tokens are on top
    group.sort((a, b) => {
      const aMov = isMyTurn && a.player.userId === userId && movableTokens.includes(a.tokenIndex) ? 1 : 0;
      const bMov = isMyTurn && b.player.userId === userId && movableTokens.includes(b.tokenIndex) ? 1 : 0;
      return aMov - bMov;
    });

    const count = group.length;
    group.forEach((tok, idx) => {
      const key = tok.key;
      const activePath = movementPaths[key];
      const baseCoord = activePath
        ? activePath.points[activePath.step] ?? getTokenCoord(tok.player.color, tok.tokenIndex, tok.step)
        : getTokenCoord(tok.player.color, tok.tokenIndex, tok.step);

      let dR = 0, dC = 0;
      let scale = 1;

      if (tok.step >= 0 && tok.step < 57 && count > 1) {
        scale = 0.85;
        const pattern = stackOffsets[Math.min(count, 4) as 1 | 2 | 3 | 4];
        if (pattern && idx < pattern.length) {
          [dR, dC] = pattern[idx]!;
        }
      } else if (tok.step === 57) {
        scale = 0.82;
      }

      const isMovable =
        isMyTurn &&
        tok.player.userId === userId &&
        movableTokens.includes(tok.tokenIndex);

      tokensToRender.push({
        key,
        player: tok.player,
        tokenIndex: tok.tokenIndex,
        step: tok.step,
        finalR: baseCoord[0] + dR,
        finalC: baseCoord[1] + dC,
        scale,
        isMovable,
        isHopping: Boolean(activePath),
        stackCount: count,
      });
    });
  });

  // Determine active token to preview destination for:
  // Either hovered token OR if only 1 movable token exists, preview it automatically!
  let previewTokenIndex = hoveredTokenIndex;
  if (previewTokenIndex === null && isMyTurn && state.dice !== null && movableTokens.length === 1) {
    previewTokenIndex = movableTokens[0]!;
  }

  // Pre-calculate destination reticle and breadcrumb dots
  let destReticleCoord: BoardCoordinate | null = null;
  const pathDotsCoords: BoardCoordinate[] = [];
  let previewColor: LudoColor | null = null;

  if (previewTokenIndex !== null && isMyTurn && activePlayer && state.dice !== null && movableTokens.includes(previewTokenIndex)) {
    const curStep = activePlayer.tokens[previewTokenIndex];
    if (curStep !== undefined) {
      previewColor = activePlayer.color;
      const targetStep = curStep < 0 ? 0 : curStep + state.dice;

      if (targetStep <= 57) {
        destReticleCoord = getTokenCoord(activePlayer.color, previewTokenIndex, targetStep);

        // Path breadcrumbs
        if (curStep >= 0) {
          for (let s = curStep + 1; s < targetStep; s++) {
            pathDotsCoords.push(getTokenCoord(activePlayer.color, previewTokenIndex, s));
          }
        }
      }
    }
  }

  // Track coordinates & home columns
  const trackCoordMap = new Map<string, number>();
  BOARD_TRACK.forEach(([r, c], idx) => {
    trackCoordMap.set(`${r},${c}`, idx);
  });

  const homeColumnMap = new Map<string, { color: LudoColor; hex: string }>();
  Object.values(SEAT_DEFINITIONS).forEach((seat) => {
    seat.homeColumn.forEach(([r, c]) => {
      homeColumnMap.set(`${r},${c}`, { color: seat.color, hex: seat.boardHex });
    });
  });

  return (
    <div className={styles.boardShell}>
      <div className={styles.ludoGrid}>
        {/* 1. TOP-LEFT YARD (RED / CORAL) */}
        <YardBox
          color="coral"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("coral")}
          movableTokens={movableTokens}
          isMyTurn={isMyTurn}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />

        {/* 2. TOP-RIGHT YARD (GREEN / MINT) */}
        <YardBox
          color="mint"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("mint")}
          movableTokens={movableTokens}
          isMyTurn={isMyTurn}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />

        {/* 3. BOTTOM-LEFT YARD (BLUE / SKY) */}
        <YardBox
          color="sky"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("sky")}
          movableTokens={movableTokens}
          isMyTurn={isMyTurn}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />

        {/* 4. BOTTOM-RIGHT YARD (YELLOW / SUNSHINE) */}
        <YardBox
          color="sunshine"
          state={state}
          userId={userId}
          dimmed={!occupiedColors.has("sunshine")}
          movableTokens={movableTokens}
          isMyTurn={isMyTurn}
          onMoveToken={onMoveToken}
          playerAvatars={playerAvatars}
        />

        {/* 5. CENTER 3x3 GOAL TRIANGLES */}
        <div className={styles.centerGoal}>
          <svg viewBox="0 0 100 100" className="size-full block" preserveAspectRatio="none">
            {/* Red left triangle */}
            <polygon points="0,0 50,50 0,100" fill="#ff1a1a" stroke="#0f172a" strokeWidth="1.2" />
            {/* Green top triangle */}
            <polygon points="0,0 100,0 50,50" fill="#12b84a" stroke="#0f172a" strokeWidth="1.2" />
            {/* Yellow right triangle */}
            <polygon points="100,0 100,100 50,50" fill="#f6ce00" stroke="#0f172a" strokeWidth="1.2" />
            {/* Blue bottom triangle */}
            <polygon points="0,100 100,100 50,50" fill="#0098ec" stroke="#0f172a" strokeWidth="1.2" />
          </svg>
        </div>

        {/* 6. 15x15 TRACK AND HOME COLUMN CELLS */}
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            const inTL = row < 6 && col < 6;
            const inTR = row < 6 && col >= 9;
            const inBL = row >= 9 && col < 6;
            const inBR = row >= 9 && col >= 9;
            const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
            if (inTL || inTR || inBL || inBR || inCenter) return null;

            const coordKey = `${row},${col}`;
            const hc = homeColumnMap.get(coordKey);
            const trackIdx = trackCoordMap.get(coordKey);
            const entryArrow = ENTRY_ARROWS[coordKey];

            let cellBg = "#ffffff";
            let starContent: React.ReactNode = null;
            let arrowContent: React.ReactNode = null;

            if (hc) {
              cellBg = hc.hex;
            } else if (trackIdx !== undefined) {
              const startOwner = Object.values(SEAT_DEFINITIONS).find(
                (s) => s.startTrackIdx === trackIdx,
              );
              if (startOwner) {
                cellBg = startOwner.boardHex;
                starContent = <StarIcon fill="rgba(0,0,0,0.3)" />;
              } else if (GREY_STAR_INDICES.has(trackIdx as 8 | 21 | 34 | 47)) {
                cellBg = "#ced8e2";
                starContent = <StarIcon fill="#5c7c9e" stroke="#47627f" />;
              } else if (entryArrow) {
                arrowContent = (
                  <svg
                    className="size-3/5"
                    style={{ transform: `rotate(${entryArrow.rot}deg)` }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M4 12H19M13 6L19 12L13 18"
                      stroke={entryArrow.hex}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              }
            }

            // Check if active user has a movable token at this cell
            const movableHere = tokensToRender.find(
              (t) =>
                t.isMovable &&
                t.step >= 0 &&
                Math.floor(t.finalR) === row &&
                Math.floor(t.finalC) === col,
            );

            return (
              <div
                key={`cell-${row}-${col}`}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  backgroundColor: cellBg,
                }}
                onClick={
                  movableHere
                    ? () => onMoveToken(movableHere.tokenIndex)
                    : undefined
                }
                className={cn(
                  styles.boardCell,
                  movableHere && styles.selectableCell,
                )}
              >
                {starContent}
                {arrowContent}
              </div>
            );
          }),
        )}
      </div>

      {/* 7. INTERACTIVE 3D PAWN TOKENS & DESTINATION PREVIEW LAYER */}
      <div className={styles.tokensLayer}>
        {/* Breadcrumb Path Dots */}
        {pathDotsCoords.map(([r, c], dotIdx) => (
          <div
            key={`path-dot-${dotIdx}`}
            className={styles.pathDot}
            style={{
              top: `${(r / 15) * 100}%`,
              left: `${(c / 15) * 100}%`,
              backgroundColor: previewColor ? SEAT_DEFINITIONS[previewColor].boardHex : "#ffffff",
            }}
          />
        ))}

        {/* Destination Reticle matching HTML */}
        {destReticleCoord && previewColor && (
          <div
            className={styles.destReticle}
            style={{
              top: `${(destReticleCoord[0] / 15) * 100}%`,
              left: `${(destReticleCoord[1] / 15) * 100}%`,
              borderColor: SEAT_DEFINITIONS[previewColor].boardHex,
              backgroundColor: `${SEAT_DEFINITIONS[previewColor].boardHex}44`,
            }}
            onClick={previewTokenIndex !== null ? () => onMoveToken(previewTokenIndex) : undefined}
            title="Click destination square to move piece here"
          />
        )}

        {/* 3D Glossy Pawns (positioned directly on tokensLayer, full sized) */}
        {tokensToRender.map((tok) => {
          const topPct = (tok.finalR / 15) * 100;
          const leftPct = (tok.finalC / 15) * 100;

          return (
            <Pawn3D
              key={tok.key}
              color={tok.player.color}
              movable={tok.isMovable}
              isHopping={tok.isHopping}
              scale={tok.scale}
              topPct={topPct}
              leftPct={leftPct}
              onClick={() => onMoveToken(tok.tokenIndex)}
              onMouseEnter={() => {
                setHoveredTokenIndex(tok.tokenIndex);
                ludoAudio.hoverTick(audioSettings);
              }}
              onMouseLeave={() => setHoveredTokenIndex(null)}
              label={`${tok.player.name} token ${tok.tokenIndex + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function YardBox({
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
  const avatarUrl = player ? playerAvatars[player.userId] ?? player.image : null;

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
      {/* Yard Player Label matching HTML */}
      <div
        className={cn(
          styles.yardLabel,
          isTop ? styles.yardLabelTop : styles.yardLabelBottom,
        )}
      >
        {player ? (
          <>
            <span className="size-4 shrink-0 overflow-hidden rounded-full border border-white/60 bg-slate-900 inline-block align-middle">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-[8px] font-black">
                  {player.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="truncate max-w-[85px] sm:max-w-[120px]">{player.name}</span>
          </>
        ) : (
          <span className="opacity-70">(Unoccupied)</span>
        )}
      </div>

      <div className={styles.yardWhiteInner}>
        {[0, 1, 2, 3].map((socketIdx) => {
          const hasYardToken = player && player.tokens[socketIdx] === -1;
          const isMovableYardToken =
            hasYardToken &&
            isMyTurn &&
            player.userId === userId &&
            movableTokens.includes(socketIdx);

          return (
            <div
              key={`yard-sock-${color}-${socketIdx}`}
              onClick={isMovableYardToken ? () => onMoveToken(socketIdx) : undefined}
              className={cn(
                styles.yardSocket,
                socketClass,
                isMovableYardToken && "cursor-pointer ring-2 ring-white hover:scale-110 active:scale-95",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
