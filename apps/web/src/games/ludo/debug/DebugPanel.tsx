import {
  Activity,
  Check,
  Copy,
  Crosshair,
  Dices,
  Maximize2,
  Minimize2,
  Move,
  Play,
  RotateCcw,
  Swords,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  getLudoMovableTokens,
  LUDO_HOME_STEP,
  LUDO_YARD_STEP,
  type LudoGameState,
} from "@kridora/shared";
import { useGameAudio } from "@/games/hooks";
import { describeError, request } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { ludoAudio } from "../audio";
import { SEAT_DEFINITIONS } from "../constants";
import type { DebugPanelProps, DebugTab, SoundEffectItem } from "./debug-types";

const DICE_FACES = [1, 2, 3, 4, 5, 6] as const;

export default function DebugPanel({
  state,
  room,
  userId,
  isRoomOwner,
  audioSettings,
  onClose,
  onDisableDebug,
  onApplyStateOverride,
}: DebugPanelProps) {
  const { isMuted, toggleMute, setSfxVolume } = useGameAudio();

  // Window State: Floating, Minimized, Dragging
  const [activeTab, setActiveTab] = useState<DebugTab>("dice");
  const [isMinimized, setIsMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 72 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);

  // Status feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const feedbackTimerRef = useRef<number | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMsg(msg);
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMsg(null);
      feedbackTimerRef.current = null;
    }, 2800);
  }, []);

  // Draggable logic
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only drag from header handle
      if ((e.target as HTMLElement).closest("button, input, select, textarea"))
        return;
      setIsDragging(true);
      dragStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: pos.x,
        posY: pos.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      const newX = Math.max(
        8,
        Math.min(window.innerWidth - 380, dragStartRef.current.posX + deltaX),
      );
      const newY = Math.max(
        8,
        Math.min(window.innerHeight - 80, dragStartRef.current.posY + deltaY),
      );
      setPos({ x: newX, y: newY });
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // Safe fallback
        }
      }
    },
    [isDragging],
  );

  // Selected Player & Token for Piece Mover
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const selectedPlayer = state.players[selectedPlayerIdx] ?? state.players[0];
  const currentTokenStep =
    selectedPlayer?.tokens[selectedTokenIdx] ?? LUDO_YARD_STEP;

  // Selected Attacker & Defender for Cut Combat Tester
  const [cutAttackerIdx, setCutAttackerIdx] = useState(0);
  const [cutAttackerToken, setCutAttackerToken] = useState(0);
  const [cutDefenderIdx, setCutDefenderIdx] = useState(1);
  const [cutDefenderToken, setCutDefenderToken] = useState(0);
  const [cutDistance, setCutDistance] = useState<number>(3);

  // Synchronized server action helper with optimistic local fallback
  const dispatchDebugAction = useCallback(
    async (
      actionName: string,
      payload: unknown,
      optimisticUpdater?: (curr: LudoGameState) => LudoGameState,
    ) => {
      if (optimisticUpdater) {
        onApplyStateOverride(optimisticUpdater(state));
      }
      try {
        const nextState = await request(actionName as any, payload as any);
        if (
          nextState &&
          typeof nextState === "object" &&
          "players" in nextState
        ) {
          onApplyStateOverride(nextState as LudoGameState);
        }
      } catch (err) {
        showFeedback(`Sync note: ${describeError(err)}`);
      }
    },
    [state, onApplyStateOverride, showFeedback],
  );

  // 1. DICE ACTIONS
  const handleSetDice = useCallback(
    (dice: number) => {
      ludoAudio.diceLand(dice, audioSettings);
      showFeedback(`🎲 Forced Dice: ${dice}`);
      void dispatchDebugAction("ludo:debug-set-dice", { dice }, (curr) => {
        const active = curr.players[curr.currentPlayerIndex];
        const next = { ...curr };
        next.dice = dice;
        next.lastRolls = [...curr.lastRolls];
        next.lastRolls[curr.currentPlayerIndex] = dice;
        next.movableTokens = active ? getLudoMovableTokens(active, dice) : [];
        next.lastAction = `[DEBUG] Set dice to ${dice}.`;
        next.updatedAt = Date.now();
        return next;
      });
    },
    [audioSettings, showFeedback, dispatchDebugAction],
  );

  const handleClearDice = useCallback(() => {
    showFeedback("🎲 Dice cleared to roll state");
    void dispatchDebugAction("ludo:debug-set-dice", { dice: 1 }, (curr) => {
      return {
        ...curr,
        dice: null,
        movableTokens: [],
        lastAction: "[DEBUG] Cleared dice.",
        updatedAt: Date.now(),
      };
    });
  }, [showFeedback, dispatchDebugAction]);

  // 2. PIECE MOVER ACTIONS
  const handleTeleportToken = useCallback(
    (targetStep: number) => {
      if (!selectedPlayer) return;
      const stepName =
        targetStep === LUDO_YARD_STEP
          ? "Yard"
          : targetStep === LUDO_HOME_STEP
            ? "Home Goal"
            : targetStep >= 51
              ? `Safe Lane Step ${targetStep - 50}`
              : `Track Step ${targetStep}`;

      // Play appropriate sound
      if (targetStep === LUDO_YARD_STEP) {
        ludoAudio.returnZip(audioSettings);
      } else if (targetStep === LUDO_HOME_STEP) {
        ludoAudio.homeFinish(audioSettings);
      } else if (targetStep >= 51) {
        ludoAudio.safeZone(audioSettings);
      } else {
        ludoAudio.hop(targetStep, audioSettings);
      }

      showFeedback(
        `📍 Moved ${selectedPlayer.name} #${selectedTokenIdx + 1} to ${stepName}`,
      );

      void dispatchDebugAction(
        "ludo:debug-set-piece",
        {
          playerIndex: selectedPlayerIdx,
          tokenIndex: selectedTokenIdx,
          step: targetStep,
        },
        (curr) => {
          const players = curr.players.map((p, pIdx) => {
            if (pIdx !== selectedPlayerIdx) return p;
            const tokens = [...p.tokens];
            tokens[selectedTokenIdx] = targetStep;
            return { ...p, tokens };
          });
          const active = players[curr.currentPlayerIndex];
          const movableTokens =
            curr.dice !== null && active
              ? getLudoMovableTokens(active, curr.dice)
              : curr.movableTokens;

          return {
            ...curr,
            players,
            movableTokens,
            lastAction: `[DEBUG] Moved ${selectedPlayer.name} #${selectedTokenIdx + 1} to step ${targetStep}.`,
            updatedAt: Date.now(),
          };
        },
      );
    },
    [
      selectedPlayer,
      selectedPlayerIdx,
      selectedTokenIdx,
      audioSettings,
      showFeedback,
      dispatchDebugAction,
    ],
  );

  // 3. COMBAT & CUT TESTER
  const handleSetupCutScenario = useCallback(() => {
    if (cutAttackerIdx === cutDefenderIdx) {
      showFeedback("⚠️ Choose two different players for cut test");
      return;
    }
    const attacker = state.players[cutAttackerIdx];
    const defender = state.players[cutDefenderIdx];
    if (!attacker || !defender) return;

    ludoAudio.diceRoll(audioSettings);
    showFeedback(
      `⚔️ Cut Setup: ${attacker.name} ${cutDistance} steps behind ${defender.name}`,
    );

    void dispatchDebugAction(
      "ludo:debug-setup-cut",
      {
        attackerPlayerIndex: cutAttackerIdx,
        attackerTokenIndex: cutAttackerToken,
        defenderPlayerIndex: cutDefenderIdx,
        defenderTokenIndex: cutDefenderToken,
        distance: cutDistance,
      },
      (curr) => {
        const next = { ...curr };
        next.currentPlayerIndex = cutAttackerIdx;
        next.dice = cutDistance;
        next.lastRolls = [...curr.lastRolls];
        next.lastRolls[cutAttackerIdx] = cutDistance;
        next.movableTokens = [cutAttackerToken];
        next.lastAction = `[DEBUG] Cut Setup: ${attacker.name} is ${cutDistance} steps behind ${defender.name}! Click piece to capture.`;
        next.updatedAt = Date.now();
        return next;
      },
    );
  }, [
    cutAttackerIdx,
    cutDefenderIdx,
    cutAttackerToken,
    cutDefenderToken,
    cutDistance,
    state.players,
    audioSettings,
    showFeedback,
    dispatchDebugAction,
  ]);

  // 4. QUICK SCENARIO PRESETS
  const handleTriggerScenario = useCallback(
    (
      scenario:
        "all_yard" | "all_track" | "near_win" | "instant_win" | "scatter",
    ) => {
      ludoAudio.unlockBase(audioSettings);
      showFeedback(
        `⚡ Loaded preset: ${scenario.replace("_", " ").toUpperCase()}`,
      );
      void dispatchDebugAction("ludo:debug-scenario", { scenario });
    },
    [audioSettings, showFeedback, dispatchDebugAction],
  );

  // 5. TURN SWITCHER
  const handleSwitchTurn = useCallback(
    (playerIndex: number) => {
      const p = state.players[playerIndex];
      if (!p) return;
      ludoAudio.hoverTick(audioSettings);
      showFeedback(`👉 Turn switched to: ${p.name}`);
      void dispatchDebugAction(
        "ludo:debug-set-turn",
        { playerIndex },
        (curr) => ({
          ...curr,
          currentPlayerIndex: playerIndex,
          dice: null,
          movableTokens: [],
          lastAction: `[DEBUG] Turn changed to ${p.name}.`,
          updatedAt: Date.now(),
        }),
      );
    },
    [state.players, audioSettings, showFeedback, dispatchDebugAction],
  );

  // 6. RESYNC FROM SERVER
  const handleResync = useCallback(async () => {
    try {
      showFeedback("🔄 Fetching server state...");
      const serverState = await request("ludo:get-state", {});
      onApplyStateOverride(serverState);
      ludoAudio.safeZone(audioSettings);
      showFeedback("✅ Resynced with server state!");
    } catch (err) {
      showFeedback(`Resync error: ${describeError(err)}`);
    }
  }, [onApplyStateOverride, audioSettings, showFeedback]);

  // Soundboard items
  const soundEffects: SoundEffectItem[] = useMemo(
    () => [
      {
        id: "diceRoll",
        name: "Dice Roll",
        category: "dice",
        description: "Mechanical 3D tumble",
        action: (s) => ludoAudio.diceRoll(s),
      },
      {
        id: "diceLandNorm",
        name: "Dice Land (1-5)",
        category: "dice",
        description: "Standard landing chime",
        action: (s) => ludoAudio.diceLand(3, s),
      },
      {
        id: "diceLandSix",
        name: "Dice Land (6)",
        category: "dice",
        description: "Triumphant fanfare arpeggio",
        action: (s) => ludoAudio.diceLand(6, s),
      },
      {
        id: "hop",
        name: "Pawn Hop",
        category: "movement",
        description: "Track progression hop",
        action: (s) => ludoAudio.hop(2, s),
      },
      {
        id: "unlockBase",
        name: "Unlock Base",
        category: "movement",
        description: "Exiting yard fanfare",
        action: (s) => ludoAudio.unlockBase(s),
      },
      {
        id: "safeZone",
        name: "Safe Star",
        category: "movement",
        description: "Magical safe sparkle",
        action: (s) => ludoAudio.safeZone(s),
      },
      {
        id: "captureHit",
        name: "Capture Hit",
        category: "combat",
        description: "Punchy arcade impact",
        action: (s) => ludoAudio.captureHit(s),
      },
      {
        id: "returnZip",
        name: "Rewind Zip",
        category: "combat",
        description: "Captured piece rewind",
        action: (s) => ludoAudio.returnZip(s),
      },
      {
        id: "homeFinish",
        name: "Home Finish",
        category: "game",
        description: "Reaching center goal",
        action: (s) => ludoAudio.homeFinish(s),
      },
      {
        id: "victory",
        name: "Victory Fanfare",
        category: "game",
        description: "Grand match championship",
        action: (s) => ludoAudio.victory(s),
      },
      {
        id: "invalid",
        name: "Invalid Buzz",
        category: "game",
        description: "Action rejected buzz",
        action: (s) => ludoAudio.invalid(s),
      },
      {
        id: "hoverTick",
        name: "Hover Tick",
        category: "game",
        description: "Subtle pointer tick",
        action: (s) => ludoAudio.hoverTick(s),
      },
      {
        id: "emotePop",
        name: "Emote Pop",
        category: "room",
        description: "Chat emote bubble pop",
        action: (s) => ludoAudio.emotePop(s),
      },
      {
        id: "roomJoin",
        name: "Room Join",
        category: "room",
        description: "Player connect chime",
        action: (s) => ludoAudio.roomJoin(s),
      },
      {
        id: "roomLeave",
        name: "Room Leave",
        category: "room",
        description: "Player disconnect chime",
        action: (s) => ludoAudio.roomLeave(s),
      },
    ],
    [],
  );

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div
        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="fixed z-50 flex items-center gap-2 rounded-full border border-sky-400/50 bg-[#0c1222]/95 px-3 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_16px_rgba(56,189,248,0.35)] backdrop-blur-md cursor-grab active:cursor-grabbing select-none"
      >
        <span className="flex size-2 rounded-full bg-emerald-400 animate-ping" />
        <span className="text-xs font-black tracking-wider text-sky-300">
          🛠️ LUDO DEBUG
        </span>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          aria-label="Expand Debug Panel"
          className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
    );
  }

  const activeTurnPlayer = state.players[state.currentPlayerIndex];

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 flex w-[370px] sm:w-[420px] max-w-[calc(100vw-16px)] flex-col rounded-2xl border border-sky-500/40 bg-[#0d1322]/95 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(56,189,248,0.22)] backdrop-blur-xl text-slate-100 select-none overflow-hidden text-xs"
    >
      {/* 1. DRAGGABLE HEADER */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex items-center justify-between border-b border-sky-500/20 bg-sky-950/40 px-3.5 py-2.5 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30">
            <Wand2 className="size-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-white">
              <span>Ludo Debug Console</span>
              {isRoomOwner && (
                <span className="rounded bg-amber-400/20 px-1 py-0.2 font-mono text-[9px] font-bold text-amber-300 border border-amber-400/30">
                  HOST
                </span>
              )}
            </div>
            <p className="text-[10px] text-sky-300/70">
              Hold X + d-e-b-u-g active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
            aria-label="Minimize"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <Minimize2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close Panel"
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 2. TRANSIENT FEEDBACK TOAST */}
      {feedbackMsg && (
        <div className="border-b border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-center text-[11px] font-bold text-amber-200">
          {feedbackMsg}
        </div>
      )}

      {/* 3. QUICK STATUS STRIP */}
      <div className="flex items-center justify-between border-b border-white/5 bg-black/30 px-3.5 py-1.5 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Turn:</span>
          {activeTurnPlayer && (
            <span
              className="flex items-center gap-1 font-bold"
              style={{
                color: SEAT_DEFINITIONS[activeTurnPlayer.color].boardHex,
              }}
            >
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor:
                    SEAT_DEFINITIONS[activeTurnPlayer.color].boardHex,
                }}
              />
              {activeTurnPlayer.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Die:</span>
          <span className="font-bold text-amber-300">
            {state.dice !== null ? state.dice : "Waiting Roll"}
          </span>
        </div>
      </div>

      {/* 4. NAVIGATION TABS */}
      <div className="flex border-b border-white/10 bg-slate-900/60 p-1 gap-1 overflow-x-auto scrollbar-none">
        {(
          [
            { id: "dice", label: "Dice", icon: Dices },
            { id: "pieces", label: "Pieces", icon: Move },
            { id: "cut", label: "Cut Test", icon: Swords },
            { id: "soundboard", label: "Audio", icon: Volume2 },
            { id: "presets", label: "Presets", icon: Zap },
            { id: "state", label: "State", icon: Activity },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-all shrink-0",
                isActive
                  ? "bg-sky-500/20 border border-sky-400/40 text-sky-200 shadow-sm"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <Icon className="size-3" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 5. TAB CONTENT BODY */}
      <div className="max-h-[360px] overflow-y-auto p-3.5 space-y-3 scrollbar-thin scrollbar-thumb-white/20">
        {/* ================= TAB 1: DICE CONTROLS ================= */}
        {activeTab === "dice" && (
          <div className="space-y-3">
            <div>
              <p className="font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Force Dice Value (Immediate)</span>
                <span className="text-[10px] text-sky-300 font-mono">
                  Syncs to Room
                </span>
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                {DICE_FACES.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleSetDice(val)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border py-2.5 transition-all active:scale-95",
                      state.dice === val
                        ? "border-amber-400 bg-amber-400/25 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                        : "border-white/10 bg-white/5 text-white hover:border-sky-400/40 hover:bg-sky-500/10",
                    )}
                  >
                    <span className="font-mono text-base font-black">
                      {val}
                    </span>
                    <span className="text-[9px] text-slate-400">Face</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClearDice}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                <RotateCcw className="size-3 text-amber-400" /> Clear Dice
              </button>
              <button
                type="button"
                onClick={() => void request("ludo:pass", {}).catch(() => {})}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                <Play className="size-3 text-sky-400" /> Force Pass
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] text-slate-300 space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Movable Pieces:</span>
                <span className="text-amber-300 font-bold">
                  {state.movableTokens.join(", ") || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Consecutive 6s:</span>
                <span className="text-slate-200">
                  {state.rollStats?.[state.currentPlayerIndex]
                    ?.consecutiveSixes ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PIECES & BOARD ================= */}
        {activeTab === "pieces" && (
          <div className="space-y-3">
            {/* Player Selector */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Select Player
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {state.players.map((p, idx) => {
                  const seat = SEAT_DEFINITIONS[p.color];
                  const isSelected = selectedPlayerIdx === idx;
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => setSelectedPlayerIdx(idx)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border p-1.5 transition-all text-left",
                        isSelected
                          ? "border-sky-400 bg-sky-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                      )}
                    >
                      <span
                        className="size-3 rounded-full shrink-0"
                        style={{ backgroundColor: seat.boardHex }}
                      />
                      <span className="truncate font-bold text-[11px]">
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Token Selector */}
            {selectedPlayer && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Select Piece
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {selectedPlayer.tokens.map((step, tIdx) => {
                    const isSelected = selectedTokenIdx === tIdx;
                    return (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => setSelectedTokenIdx(tIdx)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl border py-1.5 transition-all font-mono",
                          isSelected
                            ? "border-amber-400 bg-amber-400/20 text-amber-200"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                        )}
                      >
                        <span className="font-bold">#{tIdx + 1}</span>
                        <span className="text-[10px] text-slate-400">
                          {step === LUDO_YARD_STEP
                            ? "Yard"
                            : step === LUDO_HOME_STEP
                              ? "Goal"
                              : `${step}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step Slider & Jump Presets */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Target Position:</span>
                <span className="font-mono font-bold text-amber-400">
                  {currentTokenStep === LUDO_YARD_STEP
                    ? "Yard (-1)"
                    : currentTokenStep === LUDO_HOME_STEP
                      ? "Home Goal (56)"
                      : currentTokenStep >= 51
                        ? `Safe Lane (${currentTokenStep})`
                        : `Track Ring (${currentTokenStep})`}
                </span>
              </div>

              <input
                type="range"
                min={-1}
                max={56}
                value={currentTokenStep}
                onChange={(e) => handleTeleportToken(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => handleTeleportToken(-1)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Yard (-1)
                </button>
                <button
                  type="button"
                  onClick={() => handleTeleportToken(0)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Start (0)
                </button>
                <button
                  type="button"
                  onClick={() => handleTeleportToken(25)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Mid (25)
                </button>
                <button
                  type="button"
                  onClick={() => handleTeleportToken(50)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Entry (50)
                </button>
                <button
                  type="button"
                  onClick={() => handleTeleportToken(53)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Safe (53)
                </button>
                <button
                  type="button"
                  onClick={() => handleTeleportToken(56)}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 text-center font-bold text-slate-300 hover:bg-white/15"
                >
                  Goal (56)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: CUT COMBAT TESTER ================= */}
        {activeTab === "cut" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-300">
              One-click setup for testing rival piece capture mechanics,
              shockwave visual, sound effect, and rewind to yard.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {/* Attacker */}
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 space-y-1">
                <span className="text-[10px] font-black uppercase text-rose-300">
                  Attacker (Hunter)
                </span>
                <select
                  value={cutAttackerIdx}
                  onChange={(e) => setCutAttackerIdx(Number(e.target.value))}
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-2 py-1 text-xs text-white"
                >
                  {state.players.map((p, idx) => (
                    <option key={p.userId} value={idx}>
                      {p.name} ({SEAT_DEFINITIONS[p.color].name})
                    </option>
                  ))}
                </select>
                <div className="flex gap-1 pt-1 font-mono text-[10px]">
                  {[0, 1, 2, 3].map((tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => setCutAttackerToken(tIdx)}
                      className={cn(
                        "flex-1 rounded py-0.5 border text-center font-bold",
                        cutAttackerToken === tIdx
                          ? "border-rose-400 bg-rose-500/30 text-rose-200"
                          : "border-white/10 bg-white/5 text-slate-400",
                      )}
                    >
                      #{tIdx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Defender */}
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-2 space-y-1">
                <span className="text-[10px] font-black uppercase text-sky-300">
                  Defender (Target)
                </span>
                <select
                  value={cutDefenderIdx}
                  onChange={(e) => setCutDefenderIdx(Number(e.target.value))}
                  className="w-full rounded-lg bg-black/40 border border-white/15 px-2 py-1 text-xs text-white"
                >
                  {state.players.map((p, idx) => (
                    <option key={p.userId} value={idx}>
                      {p.name} ({SEAT_DEFINITIONS[p.color].name})
                    </option>
                  ))}
                </select>
                <div className="flex gap-1 pt-1 font-mono text-[10px]">
                  {[0, 1, 2, 3].map((tIdx) => (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => setCutDefenderToken(tIdx)}
                      className={cn(
                        "flex-1 rounded py-0.5 border text-center font-bold",
                        cutDefenderToken === tIdx
                          ? "border-sky-400 bg-sky-500/30 text-sky-200"
                          : "border-white/10 bg-white/5 text-slate-400",
                      )}
                    >
                      #{tIdx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Distance */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white">
                  Distance to Target (Dice):
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {cutDistance} steps
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {DICE_FACES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCutDistance(d)}
                    className={cn(
                      "rounded-lg border py-1 font-mono font-black text-xs transition-all",
                      cutDistance === d
                        ? "border-amber-400 bg-amber-400/25 text-amber-200"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Setup Button */}
            <button
              type="button"
              onClick={handleSetupCutScenario}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-rose-600/30 py-2.5 font-bold text-rose-100 shadow-md hover:bg-rose-600/40 active:scale-98 cursor-pointer"
            >
              <Crosshair className="size-4" /> Setup Piece Cut (Capture
              Scenario)
            </button>
          </div>
        )}

        {/* ================= TAB 4: SOUND STUDIO ================= */}
        {activeTab === "soundboard" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:text-white"
                >
                  {isMuted ? (
                    <VolumeX className="size-4 text-rose-400" />
                  ) : (
                    <Volume2 className="size-4 text-sky-400" />
                  )}
                </button>
                <span className="text-xs font-bold text-white">
                  {isMuted ? "Audio Muted" : "Audio Active"}
                </span>
              </div>
              <div className="flex items-center gap-2 w-32">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={audioSettings.sfxVolume}
                  onChange={(e) => setSfxVolume(Number(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {soundEffects.map((snd) => (
                <button
                  key={snd.id}
                  type="button"
                  onClick={() => snd.action(audioSettings)}
                  className="flex flex-col items-start rounded-xl border border-white/10 bg-white/5 p-2 text-left hover:border-sky-400/40 hover:bg-sky-500/10 active:scale-95 transition-all"
                >
                  <span className="font-bold text-white text-xs">
                    {snd.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    {snd.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 5: PRESETS ================= */}
        {activeTab === "presets" && (
          <div className="space-y-2">
            {[
              {
                id: "near_win",
                title: "Near Win (1 Step Away)",
                desc: "3 pieces in goal, 1 piece at 55. Next roll of 1 wins match.",
                action: () => handleTriggerScenario("near_win"),
                color: "text-amber-300 border-amber-400/40 bg-amber-400/10",
              },
              {
                id: "instant_win",
                title: "Instant Victory",
                desc: "All 4 pieces home, triggers championship modal.",
                action: () => handleTriggerScenario("instant_win"),
                color:
                  "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
              },
              {
                id: "all_track",
                title: "All on Track",
                desc: "Pawn spread on shared ring (steps 0, 8, 16, 24).",
                action: () => handleTriggerScenario("all_track"),
                color: "text-sky-300 border-sky-400/40 bg-sky-400/10",
              },
              {
                id: "scatter",
                title: "Multi-player Scatter",
                desc: "Distributes all players tokens along outer ring.",
                action: () => handleTriggerScenario("scatter"),
                color: "text-purple-300 border-purple-400/40 bg-purple-400/10",
              },
              {
                id: "all_yard",
                title: "Reset All to Yard",
                desc: "Resets all 16 pieces back to base yard.",
                action: () => handleTriggerScenario("all_yard"),
                color: "text-rose-300 border-rose-400/40 bg-rose-400/10",
              },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={p.action}
                className={cn(
                  "flex w-full items-start justify-between rounded-xl border p-2.5 text-left transition-all hover:brightness-125 active:scale-98",
                  p.color,
                )}
              >
                <div>
                  <p className="font-bold text-xs">{p.title}</p>
                  <p className="text-[10px] opacity-80">{p.desc}</p>
                </div>
                <Zap className="size-4 shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        )}

        {/* ================= TAB 6: STATE INSPECTOR ================= */}
        {activeTab === "state" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Turn Control</span>
              <div className="flex gap-1">
                {state.players.map((p, pIdx) => {
                  const isCur = state.currentPlayerIndex === pIdx;
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      onClick={() => handleSwitchTurn(pIdx)}
                      className={cn(
                        "rounded px-2 py-0.5 font-bold font-mono text-[10px] border",
                        isCur
                          ? "border-amber-400 bg-amber-400/20 text-amber-300"
                          : "border-white/10 text-slate-400",
                      )}
                    >
                      P{pIdx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative rounded-xl border border-white/10 bg-black/60 p-2 font-mono text-[10px] text-sky-200">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    JSON.stringify(state, null, 2),
                  );
                  setCopiedJson(true);
                  setTimeout(() => setCopiedJson(false), 1500);
                }}
                className="absolute top-2 right-2 flex items-center gap-1 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:text-white"
              >
                {copiedJson ? (
                  <Check className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3" />
                )}
                <span>{copiedJson ? "Copied" : "Copy"}</span>
              </button>
              <pre className="max-h-[160px] overflow-auto scrollbar-thin">
                {JSON.stringify(
                  {
                    currentPlayerIndex: state.currentPlayerIndex,
                    dice: state.dice,
                    movableTokens: state.movableTokens,
                    winnerId: state.winnerId,
                    lastAction: state.lastAction,
                    players: state.players.map((p) => ({
                      name: p.name,
                      color: p.color,
                      tokens: p.tokens,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <button
              type="button"
              onClick={handleResync}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-400/30 bg-sky-500/20 py-2 font-bold text-sky-200 hover:bg-sky-500/30"
            >
              <RotateCcw className="size-3.5" /> Discard Debug & Resync from
              Server
            </button>
          </div>
        )}
      </div>

      {/* 6. FOOTER */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-3.5 py-2 text-[10px] text-slate-400">
        <span>
          Room {room.code} • User: {userId.slice(0, 8)}
        </span>
        <button
          type="button"
          onClick={onDisableDebug}
          className="text-rose-400 hover:text-rose-300 font-bold transition-colors"
        >
          Exit Debug Mode
        </button>
      </div>
    </div>
  );
}
