import {
  BUSINESS_BOARD,
  type BusinessActionPayload,
  type BusinessPlayer,
  type BusinessState,
  type BusinessUpdateSettingsPayload,
} from "@kridora/shared";
import confetti from "canvas-confetti";
import { Dices, Trophy, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { request, socket } from "@/lib/socket";
import { useInGameRoom } from "@/games/hooks";
import type { GameComponentProps } from "../types";
import { businessAudio } from "./audio";
import styles from "./business.module.css";
import { SpecialTileArtwork } from "./components/BoardArtwork";
import { CenterBoardConsole } from "./components/CenterBoardConsole";
import { MobileBusinessDrawer } from "./components/MobileBusinessDrawer";
import { PlayerCornerCard } from "./components/PlayerCornerCard";
import { ThreeDice } from "./components/ThreeDice";

const EMOTES = ["👍", "💀", "😮", "😭", "🔥", "🎉"] as const;

/**
 * Maps our 28-tile 8x8 perimeter board (indices 0..27) to 1-indexed CSS grid coordinates:
 * 0 = Bottom-Left (row 8, col 1)
 * 1..6 = Left column going UP (row 7..2, col 1)
 * 7 = Top-Left (row 1, col 1)
 * 8..13 = Top row going RIGHT (row 1, col 2..7)
 * 14 = Top-Right (row 1, col 8)
 * 15..20 = Right column going DOWN (row 2..7, col 8)
 * 21 = Bottom-Right (row 8, col 8)
 * 22..27 = Bottom row going LEFT (row 8, col 7..2)
 */
function getGridCoords(index: number): { gridRow: number; gridColumn: number } {
  if (index === 0) return { gridRow: 8, gridColumn: 1 };
  if (index >= 1 && index <= 6) return { gridRow: 8 - index, gridColumn: 1 };
  if (index === 7) return { gridRow: 1, gridColumn: 1 };
  if (index >= 8 && index <= 13) return { gridRow: 1, gridColumn: index - 6 };
  if (index === 14) return { gridRow: 1, gridColumn: 8 };
  if (index >= 15 && index <= 20) return { gridRow: index - 13, gridColumn: 8 };
  if (index === 21) return { gridRow: 8, gridColumn: 8 };
  return { gridRow: 8, gridColumn: 29 - index };
}

export default function BusinessGame({ userId }: GameComponentProps) {
  const { onBackToRoom, onLeaveRoom, isLeaving } = useInGameRoom();
  const [state, setState] = useState<BusinessState | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const [isHopping, setIsHopping] = useState(false);
  const [hoppingPlayerId, setHoppingPlayerId] = useState<string | null>(null);

  // Authoritative visual positions rendered on the board (prevents teleporting!)
  const [visualPositions, setVisualPositions] = useState<
    Record<string, number>
  >({});
  const visualPosRef = useRef<Record<string, number>>({});
  const lastRollIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleIncomingState = (next: BusinessState) => {
      setState(next);
      if (next.phase === "setup") {
        visualPosRef.current = {};
        setVisualPositions({});
        return;
      }
      setVisualPositions((prev) => {
        let changed = false;
        const updated = { ...prev };
        for (const p of next.players) {
          if (updated[p.userId] === undefined) {
            updated[p.userId] = p.position;
            visualPosRef.current[p.userId] = p.position;
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    };

    void request("business:get-state", {})
      .then(handleIncomingState)
      .catch(() => undefined);

    socket.on("business:state", handleIncomingState);
    return () => {
      socket.off("business:state", handleIncomingState);
    };
  }, []);

  // Step-by-step smooth piece hopping animation (eliminates teleporting!)
  useEffect(() => {
    if (!state?.lastRoll) return;

    const roll = state.lastRoll;
    if (roll.rollId === lastRollIdRef.current) return;
    lastRollIdRef.current = roll.rollId;

    businessAudio.playDieRoll(isMuted);

    // Trigger 3D dice spin
    const rollStartTimer = window.setTimeout(() => {
      setIsRollingAnim(true);
    }, 0);
    const stopRollSpinTimer = window.setTimeout(() => {
      setIsRollingAnim(false);
    }, 450);

    // If piece didn't move (e.g. rolled inside Jail and didn't roll a 6)
    if (roll.fromTile === roll.toTile) {
      return () => {
        window.clearTimeout(rollStartTimer);
        window.clearTimeout(stopRollSpinTimer);
      };
    }

    // Build the sequential path of tiles to hop across
    const path: number[] = [];
    let curr = roll.fromTile;
    while (curr !== roll.toTile) {
      curr = (curr + 1) % BUSINESS_BOARD.length;
      path.push(curr);
    }

    const hopStartTimer = window.setTimeout(() => {
      setIsHopping(true);
      setHoppingPlayerId(roll.rollerId);
    }, 0);

    let stepIdx = 0;
    const hopInterval = window.setInterval(() => {
      if (stepIdx >= path.length) {
        window.clearInterval(hopInterval);
        setIsHopping(false);
        setHoppingPlayerId(null);
        if (state.lastTransaction) {
          businessAudio.playRentCoin(isMuted);
        } else if (BUSINESS_BOARD[roll.toTile]?.type === "jail") {
          businessAudio.playJail(isMuted);
        }
        return;
      }

      const nextTile = path[stepIdx]!;
      visualPosRef.current[roll.rollerId] = nextTile;
      setVisualPositions((prev) => ({ ...prev, [roll.rollerId]: nextTile }));
      stepIdx += 1;
      businessAudio.playHop(isMuted, stepIdx);

      if (stepIdx >= path.length) {
        window.clearInterval(hopInterval);
        window.setTimeout(() => {
          setIsHopping(false);
          setHoppingPlayerId(null);
          if (state.lastTransaction) {
            businessAudio.playRentCoin(isMuted);
          } else if (BUSINESS_BOARD[roll.toTile]?.type === "jail") {
            businessAudio.playJail(isMuted);
          }
        }, 120);
      }
    }, 200);

    return () => {
      window.clearTimeout(rollStartTimer);
      window.clearTimeout(stopRollSpinTimer);
      window.clearTimeout(hopStartTimer);
      window.clearInterval(hopInterval);
    };
  }, [state?.lastRoll, isMuted, state?.lastTransaction]);

  useEffect(() => {
    if (state?.phase === "game_over") {
      businessAudio.playWin(isMuted);
      void confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });
    }
  }, [state?.phase, isMuted]);

  const sendAction = useCallback(
    (payload: BusinessActionPayload) => {
      if (
        payload.type === "buy-property" ||
        payload.type === "upgrade-property"
      ) {
        businessAudio.playBuy(isMuted);
      }
      void request("business:action", payload)
        .then(setState)
        .catch(() => undefined);
    },
    [isMuted],
  );

  const updateSettings = useCallback((patch: BusinessUpdateSettingsPayload) => {
    void request("business:update-settings", patch)
      .then(setState)
      .catch(() => undefined);
  }, []);

  const startMatch = useCallback(() => {
    void request("business:start-match", {})
      .then(setState)
      .catch(() => undefined);
  }, []);

  const activePlayer = state ? (state.players[state.turnIndex] ?? null) : null;
  const isMyTurn = activePlayer?.userId === userId;
  const me = useMemo(
    () => state?.players.find((p) => p.userId === userId) ?? null,
    [state, userId],
  );

  const canRollNow =
    isMyTurn &&
    !isHopping &&
    (state?.turnSubPhase === "awaiting_roll" ||
      state?.turnSubPhase === "jail_choice");

  // Spacebar shortcut to roll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && state?.phase === "playing" && canRollNow) {
        e.preventDefault();
        sendAction({ type: "roll-die" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state?.phase, canRollNow, sendAction]);

  /**
   * Corner Cards Placement (User Specification):
   * - 2 players: Bottom-Left (Me), Top-Right (Opponent)
   * - 3 players: Bottom-Left (Me), Top-Left (Opponent 1), Top-Right (Opponent 2)
   * - 4 players: Bottom-Left (Me), Top-Left (Opponent 1), Top-Right (Opponent 2), Bottom-Right (Opponent 3)
   */
  const cornerPlayers = useMemo<{
    topLeft: BusinessPlayer | null;
    topRight: BusinessPlayer | null;
    bottomLeft: BusinessPlayer | null;
    bottomRight: BusinessPlayer | null;
  }>(() => {
    if (!state) {
      return {
        topLeft: null,
        topRight: null,
        bottomLeft: null,
        bottomRight: null,
      };
    }

    const mePlayer =
      state.players.find((p) => p.userId === userId) ??
      state.players[0] ??
      null;
    const opponents = state.players.filter(
      (p) => p.userId !== mePlayer?.userId,
    );

    if (opponents.length === 1) {
      // 2 players
      return {
        bottomLeft: mePlayer,
        topRight: opponents[0] ?? null,
        topLeft: null,
        bottomRight: null,
      };
    }

    if (opponents.length === 2) {
      // 3 players
      return {
        bottomLeft: mePlayer,
        topLeft: opponents[0] ?? null,
        topRight: opponents[1] ?? null,
        bottomRight: null,
      };
    }

    // 4 players
    return {
      bottomLeft: mePlayer,
      topLeft: opponents[0] ?? null,
      topRight: opponents[1] ?? null,
      bottomRight: opponents[2] ?? null,
    };
  }, [state, userId]);

  if (!state) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070b14] font-black text-emerald-400">
        Loading Business Board...
      </div>
    );
  }

  // ============================================================================
  // MINIMAL SETUP SCREEN (2-4 Players)
  // ============================================================================
  if (state.phase === "setup") {
    const isHost = state.hostUserId === userId;
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#070b14] p-4 text-white">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <button
              onClick={onBackToRoom}
              className="text-xs font-semibold text-slate-400 transition hover:text-white"
            >
              ← Room
            </button>
            <button
              onClick={onLeaveRoom}
              disabled={isLeaving}
              className="text-xs font-semibold text-red-400 transition hover:text-red-300"
            >
              {isLeaving ? "Leaving…" : "Leave"}
            </button>
          </div>

          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              BUSINESS SETUP
            </h1>
            <p className="text-xs text-slate-400">
              {isHost
                ? "Select Target Net Worth and Starting Capital (2–4 Players)"
                : "Waiting for room host to start the match..."}
            </p>
          </div>

          {/* 1. Target Net Worth */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Target Net Worth to Win
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {([5000, 7000, 10000] as const).map((goal) => (
                <button
                  key={goal}
                  disabled={!isHost}
                  onClick={() => updateSettings({ targetNetWorth: goal })}
                  className={`cursor-pointer rounded-xl border py-2.5 text-xs font-black transition active:scale-95 sm:text-sm ${
                    state.settings.targetNetWorth === goal
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-md"
                      : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/20"
                  }`}
                >
                  ${goal.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Starting Capital */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Starting Capital
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {([1000, 1500, 2000] as const).map((cash) => (
                <button
                  key={cash}
                  disabled={!isHost}
                  onClick={() => updateSettings({ startingCash: cash })}
                  className={`cursor-pointer rounded-xl border py-2.5 text-xs font-black transition active:scale-95 sm:text-sm ${
                    state.settings.startingCash === cash
                      ? "border-rose-400 bg-rose-500/20 text-rose-300 shadow-md"
                      : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/20"
                  }`}
                >
                  ${cash.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Players Roster */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Players ({state.players.length}/4)
            </div>
            <div className="space-y-1.5">
              {state.players.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/90 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: p.color }}
                      className="h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                    />
                    <span className="text-xs font-bold text-white">
                      {p.username}
                    </span>
                    {p.userId === userId && (
                      <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] font-black uppercase text-slate-300">
                        YOU
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-emerald-400">
                    ${state.settings.startingCash.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <button
              onClick={startMatch}
              className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 py-3.5 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-95"
            >
              Start Match
            </button>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN ACTIVE GAME VIEW:
  // - 4 Corner Player Cards (Net worth + Cash)
  // - 8x8 Perimeter Board with smooth jumping animation
  // - Center Console (Buy/Pass, Upgrade, Rent Golden Notification, Jail Countdown)
  // - Three.js 3D Dice (Shaking and blinking/growing on your turn!)
  // - Mobile Drawer for Dice & Emojis
  // ============================================================================
  const diceValue = state.lastRoll?.value ?? 1;

  return (
    <div className="flex h-screen w-screen select-none flex-col items-center justify-between overflow-hidden bg-[#070b14] p-2 text-white sm:p-4">
      {/* Top Header Status Bar */}
      <header className="flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0f172a]/90 px-4 py-2 shadow-lg backdrop-blur-md">
        <button
          onClick={onBackToRoom}
          className="flex items-center gap-1 text-xs font-bold text-slate-300 transition hover:text-white"
        >
          ← Room
        </button>

        <span className="text-xs font-bold text-slate-200 sm:text-sm">
          Target:{" "}
          <strong className="text-[#84cc16]">
            ${state.settings.targetNetWorth.toLocaleString()}
          </strong>{" "}
          Net Worth to Win
        </span>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted((m) => !m)}
            className="cursor-pointer text-slate-400 transition hover:text-white"
            title="Toggle Audio"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={onLeaveRoom}
            disabled={isLeaving}
            className="cursor-pointer text-xs font-semibold text-red-400 transition hover:text-red-300"
          >
            {isLeaving ? "Leaving…" : "Leave"}
          </button>
        </div>
      </header>

      {/* Main Arena: Board + Corner Player Cards + Desktop Controls */}
      <main className="flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center gap-6 py-1">
        {/* Board Arena with 4 Player Cards around the 4 corners */}
        <div className="flex h-full w-full max-w-[min(82vh,620px)] flex-col items-center justify-between gap-2">
          {/* Top Row: Top-Left Card & Top-Right Card */}
          <div className="flex w-full items-center justify-between gap-2 px-1">
            {cornerPlayers.topLeft ? (
              <PlayerCornerCard
                player={cornerPlayers.topLeft}
                isMe={cornerPlayers.topLeft.userId === userId}
                isTurn={activePlayer?.userId === cornerPlayers.topLeft.userId}
                isHost={cornerPlayers.topLeft.userId === state.hostUserId}
                position="top-left"
              />
            ) : (
              <div className="invisible min-w-[140px]" />
            )}

            {cornerPlayers.topRight ? (
              <PlayerCornerCard
                player={cornerPlayers.topRight}
                isMe={cornerPlayers.topRight.userId === userId}
                isTurn={activePlayer?.userId === cornerPlayers.topRight.userId}
                isHost={cornerPlayers.topRight.userId === state.hostUserId}
                position="top-right"
              />
            ) : (
              <div className="invisible min-w-[140px]" />
            )}
          </div>

          {/* 8x8 Perimeter Board */}
          <div className="flex h-full w-full flex-1 items-center justify-center">
            <div className={styles.boardGrid}>
              {BUSINESS_BOARD.map((tile) => {
                const coords = getGridCoords(tile.index);
                const prop = state.properties[tile.index];
                const owner = prop?.ownerId
                  ? state.players.find((p) => p.userId === prop.ownerId)
                  : null;

                const occupants = state.players.filter(
                  (p) =>
                    !p.isBankrupt &&
                    (visualPositions[p.userId] ?? p.position) === tile.index,
                );

                const displayCost =
                  prop && prop.level > 0 && tile.rent
                    ? tile.rent[prop.level]
                    : tile.cost;

                return (
                  <div
                    key={tile.index}
                    style={{
                      gridRow: coords.gridRow,
                      gridColumn: coords.gridColumn,
                    }}
                    onClick={() => {
                      if (
                        isMyTurn &&
                        state.turnSubPhase === "debt_resolution" &&
                        prop?.ownerId === userId
                      ) {
                        sendAction({
                          type: "sell-property",
                          tileIndex: tile.index,
                        });
                      }
                    }}
                    className="relative flex select-none flex-col overflow-hidden rounded-[5px] shadow-sm"
                  >
                    {tile.type === "city" ? (
                      <>
                        {/* Top Price Ribbon */}
                        <div
                          style={{ backgroundColor: tile.topBgHex }}
                          className="flex h-[38%] w-full items-center justify-center px-1"
                        >
                          <span className="text-[10px] font-extrabold text-white drop-shadow sm:text-xs">
                            ${displayCost}
                          </span>
                        </div>
                        {/* Bottom City Name Block */}
                        <div
                          style={{ backgroundColor: tile.bottomBgHex }}
                          className="flex h-[62%] w-full flex-col items-center justify-center px-1 text-center"
                        >
                          <span className="text-[9px] font-black uppercase leading-tight tracking-wide text-white sm:text-[11px]">
                            {tile.name}
                          </span>
                          {prop && prop.level > 0 && (
                            <span className="text-[8px] font-black text-amber-200">
                              {"★".repeat(prop.level)}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <SpecialTileArtwork
                        tileIndex={tile.index}
                        name={tile.name}
                      />
                    )}

                    {/* Owner Badge Ring */}
                    {owner && (
                      <span
                        style={{ backgroundColor: owner.color }}
                        className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full border border-white shadow"
                        title={`Owned by ${owner.username}`}
                      />
                    )}

                    {/* 3D Puck Tokens Sitting on the Tile */}
                    {occupants.length > 0 && (
                      <div className="pointer-events-none absolute inset-0 flex flex-wrap items-center justify-center gap-1 bg-black/15 p-0.5">
                        {occupants.map((occ) => {
                          const isHoppingNow = hoppingPlayerId === occ.userId;
                          return (
                            <div
                              key={occ.userId}
                              className={`flex h-5 w-5 items-center justify-center rounded-full bg-white p-[2px] shadow-[0_3px_0_#64748b,0_5px_8px_rgba(0,0,0,0.5)] transition-transform duration-150 sm:h-6 sm:w-6 ${
                                isHoppingNow ? styles.hoppingToken : ""
                              }`}
                            >
                              <div
                                style={{ backgroundColor: occ.color }}
                                className="h-full w-full rounded-full"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* CENTER WELL: All interactions happen here! */}
              <div
                className={`${styles.centerWell} flex items-center justify-center`}
              >
                <CenterBoardConsole
                  state={state}
                  userId={userId}
                  isHopping={isHopping}
                  activePlayer={activePlayer}
                  isMyTurn={isMyTurn}
                  me={me}
                  onBuy={() => sendAction({ type: "buy-property" })}
                  onPass={() => sendAction({ type: "pass-property" })}
                  onUpgrade={() => sendAction({ type: "upgrade-property" })}
                  onSkipUpgrade={() => sendAction({ type: "skip-upgrade" })}
                  onAcknowledgeMystery={() =>
                    sendAction({ type: "acknowledge-mystery" })
                  }
                  onPayBail={() => sendAction({ type: "pay-bail" })}
                  onPassJailTurn={() => sendAction({ type: "pass-jail-turn" })}
                  onPayDebt={() => sendAction({ type: "pay-debt" })}
                  onDeclareBankruptcy={() =>
                    sendAction({ type: "declare-bankruptcy" })
                  }
                  onSellProperty={(tileIndex) =>
                    sendAction({ type: "sell-property", tileIndex })
                  }
                />
              </div>
            </div>
          </div>

          {/* Bottom Row: Bottom-Left Card (Me) & Bottom-Right Card */}
          <div className="flex w-full items-center justify-between gap-2 px-1">
            {cornerPlayers.bottomLeft ? (
              <PlayerCornerCard
                player={cornerPlayers.bottomLeft}
                isMe={cornerPlayers.bottomLeft.userId === userId}
                isTurn={
                  activePlayer?.userId === cornerPlayers.bottomLeft.userId
                }
                isHost={cornerPlayers.bottomLeft.userId === state.hostUserId}
                position="bottom-left"
              />
            ) : (
              <div className="invisible min-w-[140px]" />
            )}

            {cornerPlayers.bottomRight ? (
              <PlayerCornerCard
                player={cornerPlayers.bottomRight}
                isMe={cornerPlayers.bottomRight.userId === userId}
                isTurn={
                  activePlayer?.userId === cornerPlayers.bottomRight.userId
                }
                isHost={cornerPlayers.bottomRight.userId === state.hostUserId}
                position="bottom-right"
              />
            ) : (
              <div className="invisible min-w-[140px]" />
            )}
          </div>
        </div>

        {/* Desktop Controls Sidebar: 3D Dice + Roll CTA + Quick Emotes */}
        <aside className="hidden h-full w-[310px] shrink-0 flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-[#0f172a]/95 p-4 shadow-2xl backdrop-blur-xl lg:flex">
          {/* Top Status & 3D Dice Display */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 p-4 text-center shadow-inner">
            <div className="text-[11px] font-black uppercase tracking-widest text-[#ff6b72]">
              {isMyTurn ? "YOUR TURN" : `${activePlayer?.username}'S TURN`}
            </div>

            {/* Three.js 3D Dice Component */}
            <ThreeDice
              value={diceValue}
              isRolling={isRollingAnim}
              isMyTurn={isMyTurn}
              canRoll={canRollNow}
              onRoll={() => sendAction({ type: "roll-die" })}
              size={96}
            />

            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold text-white">
                {canRollNow
                  ? "Click 3D Dice or Roll Button!"
                  : state.statusMessage}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Rolling a 6 grants a bonus turn!
              </p>
            </div>
          </div>

          {/* Roll CTA Button */}
          <button
            disabled={!canRollNow}
            onClick={() => sendAction({ type: "roll-die" })}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff6b72] to-[#ff4757] py-3.5 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg shadow-rose-500/25 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Dices className="h-4 w-4" /> ROLL THE DIE (SPACE)
          </button>

          {isMyTurn &&
            state.turnSubPhase === "jail_choice" &&
            (me?.cash ?? 0) >= 100 && (
              <button
                onClick={() => sendAction({ type: "pay-bail" })}
                className="w-full cursor-pointer rounded-xl border border-amber-400/40 bg-amber-500/20 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 active:scale-95"
              >
                Pay $100 Bail to Leave Jail
              </button>
            )}

          {/* Emotes Picker */}
          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              REACTIONS
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendAction({ type: "send-emote", emoji })}
                  className="cursor-pointer rounded-xl border border-white/5 bg-slate-900/80 py-2 text-lg transition hover:bg-white/10 active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile Drawer (Ludo-style): 3D Dice Pod + Active Info + Emote Bar */}
      <MobileBusinessDrawer
        activePlayer={activePlayer}
        isMyTurn={isMyTurn}
        canRoll={canRollNow}
        isRolling={isRollingAnim}
        diceValue={diceValue}
        onRoll={() => sendAction({ type: "roll-die" })}
        onSendEmote={(emoji) => sendAction({ type: "send-emote", emoji })}
      />

      {/* GAME OVER MODAL */}
      {state.phase === "game_over" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/15 bg-[#0f172a] p-6 text-center shadow-2xl">
            <Trophy className="mx-auto h-12 w-12 text-amber-400" />
            <h2 className="text-2xl font-black text-white">MATCH COMPLETE</h2>
            <p className="text-xs font-bold text-[#84cc16]">
              {state.winReason}
            </p>
            <div className="space-y-2 text-left">
              {[...state.players]
                .sort((a, b) => b.netWorth - a.netWorth)
                .map((p, i) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-amber-400">
                        #{i + 1}
                      </span>
                      <span
                        style={{ backgroundColor: p.color }}
                        className="inline-block h-3.5 w-3.5 rounded-full"
                      />
                      <span className="text-xs font-bold text-white">
                        {p.username}
                      </span>
                    </div>
                    <span className="text-xs font-black text-[#84cc16]">
                      ${p.cash.toLocaleString()} ($
                      {p.netWorth.toLocaleString()})
                    </span>
                  </div>
                ))}
            </div>
            <button
              onClick={onBackToRoom}
              className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:brightness-110 active:scale-95"
            >
              Return to Room
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
