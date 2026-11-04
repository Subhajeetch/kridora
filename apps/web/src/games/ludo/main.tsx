import {
  AlertCircle,
  ArrowLeft,
  Crown,
  DoorOpen,
  Gamepad2,
  LogOut,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  getLudoAutoMoveToken,
  LUDO_HOME_STEP,
  LUDO_YARD_STEP,
  type LudoColor,
  type LudoGameState,
} from "@kridora/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInGameRoom, useGameAudio } from "@/games/hooks";
import { useAudioSettings } from "@/lib/audio-settings";
import { describeError, request, socket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/providers/realtime-context";
import type { GameComponentProps } from "../types";
import { ludoAudio } from "./audio";
import { LeaveConfirmDialog } from "./components/LeaveConfirmDialog";
import { LudoBoard } from "./components/LudoBoard";
import { MobileNocturneDrawer } from "./components/MobileNocturneDrawer";
import { NocturneSidePanel } from "./components/NocturneSidePanel";
import { OfflineWaitScreen } from "./components/OfflineWaitScreen";
import { RoomToast } from "./components/RoomToast";
import { SEAT_DEFINITIONS } from "./constants";
import styles from "./ludo.module.css";

const ROLL_TUMBLE_MS = 460;
const HOP_STEP_MS = 130;
const EMOTE_DURATION_MS = 2000;

export default function LudoGame({ room, userId }: GameComponentProps) {
  const navigate = useNavigate();
  const audio = useAudioSettings();
  const { setActiveRoom } = useRealtime();
  const { onBackToRoom, playerCount, maxPlayers, roomCode, game } =
    useInGameRoom();
  const { isMuted, toggleMute } = useGameAudio();

  const [state, setState] = useState<LudoGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollingColor, setRollingColor] = useState<LudoColor | null>(null);
  const [isBoardAnimating, setIsBoardAnimating] = useState(false);

  // Modals
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [dismissedWinnerKey, setDismissedWinnerKey] = useState<string | null>(
    null,
  );

  // Active Emotes: map of userId -> { emoji, timestamp }
  const [activeEmotes, setActiveEmotes] = useState<
    Record<string, { emoji: string; timestamp: number }>
  >({});

  // Floating HUD Room Code copy feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const handleCopyRoomCode = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedCode(false);
        copyTimerRef.current = null;
      }, 1500);
    }
  }, [roomCode]);

  // Failsafe manual pass button (only visible if auto-pass somehow stalls > 2.5s)
  const [showManualPass, setShowManualPass] = useState(false);
  const manualPassTimerRef = useRef<number | null>(null);

  // Mutable refs to avoid re-subscribing WebSocket listeners or firing duplicate requests
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  const busyRef = useRef(false);
  const rollingUntilRef = useRef(0);
  const rollClearTimerRef = useRef<number | null>(null);
  const delayedStateTimerRef = useRef<number | null>(null);
  const animLockTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const emoteTimersRef = useRef<Map<string, number>>(new Map());

  const stateRef = useRef<LudoGameState | null>(null);
  stateRef.current = state;

  const autoMoveTimerRef = useRef<number | null>(null);
  const autoPassTimerRef = useRef<number | null>(null);
  const lastLandedRollKeyRef = useRef<string | null>(null);
  const prevTokensRef = useRef<Map<string, number> | null>(null);
  const prevTurnUserIdRef = useRef<string | null>(null);

  const showTransientError = useCallback((msg: string) => {
    setError(msg);
    ludoAudio.invalid(audioRef.current);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setError(null);
      errorTimerRef.current = null;
    }, 4500);
  }, []);

  /** Computes board animation duration from token deltas so rolls/modals wait for hops & rewinds. */
  const applyCommittedState = useCallback((next: LudoGameState) => {
    const nextMap = new Map<string, number>();
    for (const p of next.players) {
      p.tokens.forEach((step, idx) => {
        nextMap.set(`${p.userId}:${idx}`, step);
      });
    }

    const prevMap = prevTokensRef.current;
    prevTokensRef.current = nextMap;

    if (prevMap) {
      let forwardMs = 0;
      let rewindMs = 0;

      for (const p of next.players) {
        p.tokens.forEach((step, idx) => {
          const oldStep = prevMap.get(`${p.userId}:${idx}`);
          if (oldStep === undefined || oldStep === step) return;

          if (step > oldStep) {
            const hops = oldStep < 0 ? 1 : step - oldStep;
            forwardMs = Math.max(forwardMs, hops * HOP_STEP_MS + 90);
          } else if (oldStep >= 0 && step === LUDO_YARD_STEP) {
            const stepCount = oldStep + 2;
            const perStep = Math.max(
              18,
              Math.min(42, Math.floor(680 / stepCount)),
            );
            rewindMs = Math.max(rewindMs, 80 + stepCount * perStep + 90);
          }
        });
      }

      const totalAnimMs = forwardMs + rewindMs;
      if (totalAnimMs > 0) {
        setIsBoardAnimating(true);
        if (animLockTimerRef.current) {
          window.clearTimeout(animLockTimerRef.current);
        }
        animLockTimerRef.current = window.setTimeout(() => {
          setIsBoardAnimating(false);
          animLockTimerRef.current = null;
        }, totalAnimMs);
      }
    }

    // Play dice landing sound once per unique roll
    if (next.dice !== null) {
      const rollKey = `${next.updatedAt}:${next.dice}:${next.currentPlayerIndex}`;
      if (lastLandedRollKeyRef.current !== rollKey) {
        lastLandedRollKeyRef.current = rollKey;
        ludoAudio.diceLand(next.dice, audioRef.current);
      }
    }

    setState(next);
  }, []);

  const handlePass = useCallback(async () => {
    const curr = stateRef.current;
    if (
      !curr ||
      curr.winnerId !== null ||
      curr.dice === null ||
      curr.movableTokens.length > 0
    ) {
      return;
    }

    try {
      const next = await request("ludo:pass", {});
      applyCommittedState(next);
    } catch {
      void request("ludo:get-state", {})
        .then(applyCommittedState)
        .catch(() => {});
    }
  }, [applyCommittedState]);

  const startRollVisuals = useCallback((color: LudoColor) => {
    rollingUntilRef.current = performance.now() + ROLL_TUMBLE_MS;
    setRollingColor(color);
    ludoAudio.diceRoll(audioRef.current);

    if (rollClearTimerRef.current) {
      window.clearTimeout(rollClearTimerRef.current);
    }
    rollClearTimerRef.current = window.setTimeout(() => {
      setRollingColor((curr) => (curr === color ? null : curr));
      rollClearTimerRef.current = null;
    }, ROLL_TUMBLE_MS);
  }, []);

  // 1. Initial State Fetch, Reconnect Sync & Realtime Subscriptions
  useEffect(() => {
    let active = true;
    const emoteTimers = emoteTimersRef.current;

    const fetchState = () => {
      void request("ludo:get-state", {})
        .then((initial) => {
          if (!active) return;
          if (initial.dice !== null) {
            lastLandedRollKeyRef.current = `${initial.updatedAt}:${initial.dice}:${initial.currentPlayerIndex}`;
          }
          applyCommittedState(initial);
        })
        .catch((err) => {
          if (active) setError(describeError(err));
        });
    };

    fetchState();

    function onState(next: LudoGameState) {
      if (!active) return;

      if (delayedStateTimerRef.current) {
        window.clearTimeout(delayedStateTimerRef.current);
        delayedStateTimerRef.current = null;
      }

      const remainingTumbleMs = Math.max(
        0,
        Math.ceil(rollingUntilRef.current - performance.now()),
      );

      // Keep 3D cube tumbling until finish if this state is a newly rolled die
      if (next.dice !== null && remainingTumbleMs > 16 && !busyRef.current) {
        delayedStateTimerRef.current = window.setTimeout(() => {
          delayedStateTimerRef.current = null;
          setRollingColor(null);
          applyCommittedState(next);
        }, remainingTumbleMs);
      } else if (!busyRef.current) {
        if (next.dice === null) {
          setRollingColor(null);
        }
        applyCommittedState(next);
      }
    }

    function onRolling(payload: { color: LudoColor; userId: string }) {
      if (payload.userId !== userId) {
        startRollVisuals(payload.color);
      }
    }

    function onEmoteReceived(payload: { userId: string; emoji: string }) {
      ludoAudio.emotePop(audioRef.current);
      const ts = Date.now();
      setActiveEmotes((prev) => ({
        ...prev,
        [payload.userId]: { emoji: payload.emoji, timestamp: ts },
      }));

      const prevTimer = emoteTimers.get(payload.userId);
      if (prevTimer) window.clearTimeout(prevTimer);

      const timer = window.setTimeout(() => {
        emoteTimers.delete(payload.userId);
        setActiveEmotes((prev) => {
          if (prev[payload.userId]?.timestamp !== ts) return prev;
          const next = { ...prev };
          delete next[payload.userId];
          return next;
        });
      }, EMOTE_DURATION_MS);
      emoteTimers.set(payload.userId, timer);
    }

    socket.on("ludo:state", onState);
    socket.on("ludo:rolling", onRolling);
    socket.on("ludo:emote", onEmoteReceived);
    socket.on("connect", fetchState);

    return () => {
      active = false;
      socket.off("ludo:state", onState);
      socket.off("ludo:rolling", onRolling);
      socket.off("ludo:emote", onEmoteReceived);
      socket.off("connect", fetchState);

      if (rollClearTimerRef.current)
        window.clearTimeout(rollClearTimerRef.current);
      if (delayedStateTimerRef.current)
        window.clearTimeout(delayedStateTimerRef.current);
      if (animLockTimerRef.current)
        window.clearTimeout(animLockTimerRef.current);
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      if (autoPassTimerRef.current)
        window.clearTimeout(autoPassTimerRef.current);
      if (manualPassTimerRef.current)
        window.clearTimeout(manualPassTimerRef.current);
      if (autoMoveTimerRef.current)
        window.clearTimeout(autoMoveTimerRef.current);
      if (copyTimerRef.current)
        window.clearTimeout(copyTimerRef.current);
      emoteTimers.forEach((t) => window.clearTimeout(t));
      emoteTimers.clear();
      setActiveEmotes({});
    };
  }, [userId, applyCommittedState, startRollVisuals]);

  // Subtle turn-start notification chime & light haptic tap when turn rotates to local player
  useEffect(() => {
    if (!state || state.winnerId || isBoardAnimating) return;
    const activeTurnUser = state.players[state.currentPlayerIndex]?.userId ?? null;
    const prevTurnUser = prevTurnUserIdRef.current;
    prevTurnUserIdRef.current = activeTurnUser;

    if (
      prevTurnUser !== null &&
      prevTurnUser !== activeTurnUser &&
      activeTurnUser === userId &&
      state.dice === null
    ) {
      ludoAudio.hoverTick(audioRef.current);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(18);
        } catch {
          // Ignore unsupported vibration environments
        }
      }
    }
  }, [state, isBoardAnimating, userId]);

  const playerAvatars = useMemo(() => {
    const map: Record<string, string | null> = {};
    room.players.forEach((p) => {
      map[p.userId] = p.image ?? null;
    });
    return map;
  }, [room.players]);

  const offlinePlayers = useMemo(() => {
    if (!state) return [];
    return room.players.filter(
      (rp) =>
        state.players.some((sp) => sp.userId === rp.userId) && !rp.connected,
    );
  }, [state, room.players]);

  const occupiedColors = useMemo(
    () => new Set(state?.players.map((p) => p.color) ?? []),
    [state?.players],
  );

  const isPaused = offlinePlayers.length > 0;
  const isRoomOwner = room.ownerId === userId;

  // Synchronous + React state action guard preventing double-tap race conditions
  const act = useCallback(
    async (fn: () => Promise<LudoGameState>) => {
      if (busyRef.current || isPaused) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const next = await fn();
        if (delayedStateTimerRef.current) {
          window.clearTimeout(delayedStateTimerRef.current);
          delayedStateTimerRef.current = null;
        }
        applyCommittedState(next);
      } catch (err) {
        showTransientError(describeError(err));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [isPaused, applyCommittedState, showTransientError],
  );

  // Dice Roll Handler with authentic 460ms 3D tumble
  const handleRoll = useCallback(() => {
    if (
      busyRef.current ||
      isPaused ||
      isBoardAnimating ||
      rollingColor !== null ||
      !state ||
      state.winnerId !== null ||
      state.dice !== null
    ) {
      return;
    }

    const active = state.players[state.currentPlayerIndex];
    if (!active || active.userId !== userId) return;

    startRollVisuals(active.color);

    void act(async () => {
      const [next] = await Promise.all([
        request("ludo:roll", {}),
        new Promise<void>((res) => window.setTimeout(res, ROLL_TUMBLE_MS)),
      ]);
      setRollingColor(null);
      return next;
    }).catch(() => {
      setRollingColor(null);
    });
  }, [
    isPaused,
    isBoardAnimating,
    rollingColor,
    state,
    userId,
    startRollVisuals,
    act,
  ]);

  // Token Move Handler
  const handleMoveToken = useCallback(
    (tokenIndex: number) => {
      if (
        busyRef.current ||
        isPaused ||
        !state ||
        state.winnerId !== null ||
        state.dice === null
      ) {
        return;
      }
      if (!state.movableTokens.includes(tokenIndex)) {
        ludoAudio.invalid(audioRef.current);
        return;
      }
      void act(() => request("ludo:move", { tokenIndex }));
    },
    [isPaused, state, act],
  );

  const activePlayer = state ? state.players[state.currentPlayerIndex] : undefined;
  const isMyTurn = activePlayer?.userId === userId;
  const canRoll =
    Boolean(isMyTurn) &&
    Boolean(state) &&
    state!.winnerId === null &&
    state!.dice === null &&
    !busy &&
    !isPaused &&
    !isBoardAnimating &&
    rollingColor === null;

  const canPass =
    showManualPass &&
    Boolean(isMyTurn) &&
    Boolean(state) &&
    state!.winnerId === null &&
    state!.dice !== null &&
    state!.movableTokens.length === 0 &&
    !isPaused &&
    !isBoardAnimating &&
    rollingColor === null;

  // Desktop Spacebar convenience shortcut to roll or pass when it's your turn
  useEffect(() => {
    const canActNow = canRoll || canPass;
    if (!canActNow) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (canRoll) {
        handleRoll();
      } else if (canPass) {
        void handlePass();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRoll, canPass, handleRoll, handlePass]);

  // Smart Auto-Move:
  // 1) Only 1 movable piece, OR
  // 2) Rolled a 6 with all movable pieces in yard, OR
  // 3) 2+ movable pieces stacked on the exact same square and no other movable options
  const autoMoveTokenIdx = useMemo(() => {
    if (
      !state ||
      state.winnerId !== null ||
      isPaused ||
      isBoardAnimating ||
      rollingColor !== null ||
      state.dice === null ||
      !isMyTurn ||
      !activePlayer
    ) {
      return null;
    }
    return getLudoAutoMoveToken(activePlayer, state.movableTokens);
  }, [state, isPaused, isBoardAnimating, rollingColor, isMyTurn, activePlayer]);

  const autoMoveKey =
    autoMoveTokenIdx !== null && state
      ? `${state.updatedAt}:${state.dice}:${state.currentPlayerIndex}:${autoMoveTokenIdx}`
      : null;

  useEffect(() => {
    if (!autoMoveKey || autoMoveTokenIdx === null) {
      if (autoMoveTimerRef.current) {
        window.clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
      return;
    }

    autoMoveTimerRef.current = window.setTimeout(() => {
      autoMoveTimerRef.current = null;
      handleMoveToken(autoMoveTokenIdx);
    }, 380);

    return () => {
      if (autoMoveTimerRef.current) {
        window.clearTimeout(autoMoveTimerRef.current);
        autoMoveTimerRef.current = null;
      }
    };
  }, [autoMoveKey, autoMoveTokenIdx, handleMoveToken]);

  // Automatic turn pass when zero legal moves exist (with peer fallback)
  const isPassState =
    Boolean(state) &&
    state!.winnerId === null &&
    !isPaused &&
    !isBoardAnimating &&
    rollingColor === null &&
    state!.dice !== null &&
    state!.movableTokens.length === 0;

  const passKey =
    isPassState && state
      ? `${state.updatedAt}:${state.dice}:${state.currentPlayerIndex}`
      : null;

  useEffect(() => {
    if (!passKey || !state) {
      setShowManualPass(false);
      if (autoPassTimerRef.current) {
        window.clearTimeout(autoPassTimerRef.current);
        autoPassTimerRef.current = null;
      }
      if (manualPassTimerRef.current) {
        window.clearTimeout(manualPassTimerRef.current);
        manualPassTimerRef.current = null;
      }
      return;
    }

    const active = state.players[state.currentPlayerIndex];
    const isMe = active?.userId === userId;
    const delay = isMe ? 900 : 1800;

    // 1. Automatic turn pass (900ms for active player, 1800ms peer fallback)
    autoPassTimerRef.current = window.setTimeout(() => {
      autoPassTimerRef.current = null;
      void handlePass();
    }, delay);

    // 2. Failsafe manual pass button: only appears if auto-pass stalls past 2.5s
    if (isMe) {
      manualPassTimerRef.current = window.setTimeout(() => {
        manualPassTimerRef.current = null;
        setShowManualPass(true);
      }, 2500);
    }

    return () => {
      if (autoPassTimerRef.current) {
        window.clearTimeout(autoPassTimerRef.current);
        autoPassTimerRef.current = null;
      }
      if (manualPassTimerRef.current) {
        window.clearTimeout(manualPassTimerRef.current);
        manualPassTimerRef.current = null;
      }
    };
  }, [passKey, userId, handlePass]);

  const handleConfirmLeave = useCallback(async () => {
    setIsLeaving(true);
    try {
      await request("room:leave", {});
      setActiveRoom(null);
      void navigate(`/${room.gameSlug}`);
    } catch (err) {
      showTransientError(describeError(err));
      setIsLeaving(false);
      setLeaveConfirmOpen(false);
    }
  }, [navigate, room.gameSlug, setActiveRoom, showTransientError]);

  const handleSendEmote = useCallback(
    (emoji: string) => {
      ludoAudio.emotePop(audioRef.current);
      const ts = Date.now();
      setActiveEmotes((prev) => ({
        ...prev,
        [userId]: { emoji, timestamp: ts },
      }));

      const prevTimer = emoteTimersRef.current.get(userId);
      if (prevTimer) window.clearTimeout(prevTimer);

      const timer = window.setTimeout(() => {
        emoteTimersRef.current.delete(userId);
        setActiveEmotes((prev) => {
          if (prev[userId]?.timestamp !== ts) return prev;
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }, EMOTE_DURATION_MS);
      emoteTimersRef.current.set(userId, timer);

      void request("ludo:emote", { emoji }).catch(() => {});
    },
    [userId],
  );

  const handleKickOffline = useCallback(
    async (targetUserId: string) => {
      try {
        const updated = await request("room:kick", { userId: targetUserId });
        setActiveRoom(updated);
      } catch (err) {
        showTransientError(describeError(err));
      }
    },
    [setActiveRoom, showTransientError],
  );

  const handleEndGame = useCallback(async () => {
    try {
      const updated = await request("room:end-game", {});
      setActiveRoom(updated);
    } catch (err) {
      showTransientError(describeError(err));
    }
  }, [setActiveRoom, showTransientError]);

  if (!state) {
    if (error) {
      return (
        <div className="mx-auto my-12 max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-200">
          <p className="font-semibold text-white">
            Unable to connect to Ludo match
          </p>
          <p className="mt-1 text-xs text-rose-300/80">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void request("ludo:get-state", {})
                .then(applyCommittedState)
                .catch((err) => setError(describeError(err)));
            }}
            className="mt-4 cursor-pointer rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs font-semibold hover:bg-rose-500/30"
          >
            Retry Connection
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto my-16 flex flex-col items-center justify-center gap-3 text-center">
        <div className="size-9 animate-spin rounded-full border-3 border-sky-400 border-t-transparent" />
        <p className="text-xs font-bold uppercase tracking-widest text-sky-200/80">
          Syncing Royal Ludo Arena...
        </p>
      </div>
    );
  }



  const getPlayerDiceValue = (color: LudoColor) => {
    if (state.dice !== null && activePlayer?.color === color) {
      return state.dice;
    }
    const idx = state.players.findIndex((p) => p.color === color);
    return idx !== -1 ? (state.lastRolls[idx] ?? 1) : 1;
  };

  const winnerPlayer = state.winnerId
    ? state.players.find((p) => p.userId === state.winnerId)
    : undefined;
  const winnerKey = state.winnerId
    ? `${room.matchId ?? room.code}:${state.winnerId}`
    : null;
  const showVictoryModal =
    Boolean(winnerPlayer && winnerKey) &&
    !isBoardAnimating &&
    dismissedWinnerKey !== winnerKey;

  const sortedStandings = [...state.players].sort((a, b) => {
    const aHome = a.tokens.filter((s) => s === LUDO_HOME_STEP).length;
    const bHome = b.tokens.filter((s) => s === LUDO_HOME_STEP).length;
    if (bHome !== aHome) return bHome - aHome;
    const aProgress = a.tokens.reduce((acc, s) => acc + Math.max(0, s), 0);
    const bProgress = b.tokens.reduce((acc, s) => acc + Math.max(0, s), 0);
    return bProgress - aProgress;
  });

  return (
    <div
      className={cn(
        styles.nocturneBg,
        "relative flex h-full w-full min-w-full flex-1 flex-col items-center justify-start min-h-0 overflow-hidden pt-16 sm:pt-20 pb-2 select-none",
      )}
    >
      {/* Full-bleed 16:9 Ludo Game Background */}
      <img
        src="/games/ludo/bg.webp"
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="async"
        className={styles.gameBackground}
      />

      {/* Floating In-Game HUD Bar (Floating capsule - does not take space on the game canvas) */}
      <header
        role="region"
        aria-label="In-Game Controls"
        className="absolute top-2.5 sm:top-3.5 left-1/2 -translate-x-1/2 z-30 flex w-[calc(100%-1.25rem)] max-w-2xl items-center justify-between gap-2 rounded-2xl border border-white/12 bg-[#141624]/85 px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.65)] select-none pointer-events-auto"
      >
        {/* Left: Back to Room Roster */}
        <button
          type="button"
          onClick={onBackToRoom}
          aria-label="View room players and settings"
          className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-300 shadow-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95 touch-manipulation cursor-pointer"
        >
          <ArrowLeft className="size-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">Room</span>
          <span className="rounded-md bg-amber-400/15 border border-amber-400/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            {playerCount}/{maxPlayers}
          </span>
        </button>

        {/* Center: Game Name & Room Code */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-200">
            <Gamepad2 className="size-3.5 text-amber-400 shrink-0" />
            <span>{game.name}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyRoomCode}
            title="Click to copy Room Code"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1 text-xs font-bold font-mono tracking-widest text-amber-400 shadow-inner transition-colors hover:border-amber-400/30 active:scale-95 cursor-pointer touch-manipulation"
          >
            <span className="hidden xs:inline text-[10px] uppercase font-sans text-slate-400 font-semibold tracking-normal">
              Code:
            </span>
            <span>{copiedCode ? "COPIED!" : roomCode}</span>
          </button>
        </div>

        {/* Right: Audio Mute & Leave Game */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute game audio" : "Mute game audio"}
            title={isMuted ? "Unmute audio" : "Mute audio"}
            className="flex size-7 sm:size-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 shadow-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-amber-400 active:scale-95 touch-manipulation"
          >
            {isMuted ? (
              <VolumeX className="size-3.5" />
            ) : (
              <Volume2 className="size-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setLeaveConfirmOpen(true)}
            aria-label="Leave match"
            title="Leave match"
            className="flex size-7 sm:size-8 cursor-pointer items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 shadow-sm transition-all hover:border-rose-500/50 hover:bg-rose-900/60 hover:text-rose-200 active:scale-95 touch-manipulation"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Realtime Toasts for Room Joins / Leaves */}
      <RoomToast players={room.players} audioSettings={audio} />

      {/* Non-blocking In-Game Action Error Banner */}
      {error && (
        <div
          role="alert"
          className="relative z-30 mx-auto mb-2.5 flex w-full max-w-md items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-950/90 px-3 py-2 text-xs text-rose-200 shadow-lg"
        >
          <span className="flex items-center gap-1.5 truncate">
            <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
            <span className="truncate">{error}</span>
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="cursor-pointer rounded p-0.5 text-rose-300 hover:bg-white/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Finished Match Banner if player closed Victory Dialog to inspect the board */}
      {winnerPlayer && dismissedWinnerKey === winnerKey && (
        <div className="relative z-20 mx-auto mb-3 flex w-full max-w-lg items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs text-amber-100">
          <div className="flex items-center gap-2 truncate font-bold">
            <Trophy className="size-4 shrink-0 text-amber-400" />
            <span className="truncate">{winnerPlayer.name} won the match!</span>
          </div>
          <Button
            size="xs"
            onClick={() => setDismissedWinnerKey(null)}
            className="rounded-lg bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
          >
            Results
          </Button>
        </div>
      )}

      {/* MAIN LAYOUT: 15x15 LUDO BOARD + NOCTURNE SIDE PANEL */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-start gap-3 md:flex-row md:items-start md:justify-center md:gap-6 lg:gap-8 min-h-0 px-2 mt-[40px] md:mt-[80px]">
        <div className="flex shrink-0 items-center justify-center">
          <LudoBoard
            state={state}
            userId={userId}
            onMoveToken={handleMoveToken}
            audioSettings={audio}
            occupiedColors={occupiedColors}
            playerAvatars={playerAvatars}
          />
        </div>

        <NocturneSidePanel
          state={state}
          room={room}
          userId={userId}
          activePlayer={activePlayer}
          isMyTurn={Boolean(isMyTurn)}
          canRoll={canRoll}
          canPass={canPass}
          rollingColor={rollingColor}
          diceValue={
            activePlayer
              ? getPlayerDiceValue(activePlayer.color)
              : (state.dice ?? 1)
          }
          onRoll={handleRoll}
          onPass={handlePass}
          onEmote={handleSendEmote}
          activeEmotes={activeEmotes}
          playerAvatars={playerAvatars}
        />
      </div>

      {/* MOBILE: Nocturne Bottom Drawer (< md) */}
      <MobileNocturneDrawer
        state={state}
        room={room}
        userId={userId}
        activePlayer={activePlayer}
        isMyTurn={Boolean(isMyTurn)}
        canRoll={canRoll}
        canPass={canPass}
        rollingColor={rollingColor}
        diceValue={
          activePlayer
            ? getPlayerDiceValue(activePlayer.color)
            : (state.dice ?? 1)
        }
        onRoll={handleRoll}
        onPass={handlePass}
        onEmote={handleSendEmote}
        activeEmotes={activeEmotes}
        playerAvatars={playerAvatars}
      />

      {/* OFFLINE WAIT SCREEN */}
      {isPaused && !state.winnerId && (
        <OfflineWaitScreen
          offlinePlayers={offlinePlayers}
          totalMatchPlayers={state.players.length}
          isRoomOwner={isRoomOwner}
          onKickPlayer={handleKickOffline}
          onEndGame={handleEndGame}
          onTimeout={(targetId) => {
            if (isRoomOwner) {
              void handleKickOffline(targetId);
            }
          }}
          playerAvatars={playerAvatars}
        />
      )}

      {/* VICTORY / MATCH COMPLETE DIALOG */}
      <Dialog
        open={showVictoryModal}
        onOpenChange={(open) => {
          if (!open && winnerKey) setDismissedWinnerKey(winnerKey);
        }}
      >
        <DialogContent className="max-w-md border-amber-400/40 bg-slate-900 text-slate-100">
          <div className="flex flex-col items-center text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-amber-400/40 bg-amber-400/15 text-amber-300 shadow-lg">
              <Trophy className="size-7" />
            </div>
            <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-amber-300">
              <Sparkles className="size-3.5" /> Match Complete
            </p>
            <DialogTitle className="mt-1 text-2xl font-black text-white">
              {winnerPlayer?.userId === userId
                ? "Victory! You Won!"
                : `${winnerPlayer?.name ?? "Player"} Wins!`}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-slate-400">
              All 4 pieces safely reached the center home triangle.
            </DialogDescription>
          </div>

          <div className="mt-5 space-y-2">
            {sortedStandings.map((p, rankIdx) => {
              const seat = SEAT_DEFINITIONS[p.color];
              const homeCount = p.tokens.filter(
                (s) => s === LUDO_HOME_STEP,
              ).length;
              const avatar = playerAvatars[p.userId];
              const isWinner = p.userId === state.winnerId;

              return (
                <div
                  key={p.userId}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2.5",
                    isWinner
                      ? "border-amber-400/70 bg-amber-400/10 text-white"
                      : "border-white/10 bg-slate-800/60 text-slate-200",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-lg text-xs font-black",
                        rankIdx === 0
                          ? "bg-amber-400 text-slate-950"
                          : "bg-white/10 text-slate-300",
                      )}
                    >
                      #{rankIdx + 1}
                    </span>
                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-white/40 bg-slate-700">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span
                          className="grid size-full place-items-center text-xs font-bold text-white"
                          style={{ backgroundColor: seat.boardHex }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">
                          {p.name}
                        </span>
                        {p.userId === userId && (
                          <span className="rounded bg-white/15 px-1 text-[9px] font-bold text-slate-200">
                            YOU
                          </span>
                        )}
                      </div>
                      <span
                        className="rounded px-1 text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: `${seat.boardHex}33`,
                          color: seat.boardHex,
                        }}
                      >
                        {seat.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-xs font-bold">
                    <span className="text-sm text-amber-300">{homeCount}</span>
                    <span className="text-slate-400">/ 4</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (winnerKey) setDismissedWinnerKey(winnerKey);
              }}
              className="rounded-xl border-white/20 text-slate-200"
            >
              View Board
            </Button>
            {isRoomOwner && (
              <Button
                size="sm"
                onClick={() => void handleEndGame()}
                className="gap-1.5 rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300"
              >
                <DoorOpen className="size-4" /> Return to Lobby
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* LEAVE CONFIRMATION DIALOG */}
      <LeaveConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        onConfirm={handleConfirmLeave}
        isLeaving={isLeaving}
      />

      {/* MATCH STANDINGS MODAL */}
      <Dialog open={rankingModalOpen} onOpenChange={setRankingModalOpen}>
        <DialogContent className="max-w-md border-amber-500/30 bg-slate-900 text-slate-100">
          <div className="flex items-center gap-2.5">
            <Trophy className="size-6 text-amber-400" />
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Match Standings
              </DialogTitle>
              <p className="text-xs text-amber-300">Room {room.code}</p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-xs text-slate-400">
            Current pieces reached the center home goal (4 needed to win)
          </DialogDescription>

          <div className="mt-4 space-y-2">
            {state.players.map((p) => {
              const seat = SEAT_DEFINITIONS[p.color];
              const homeCount = p.tokens.filter(
                (s) => s === LUDO_HOME_STEP,
              ).length;
              const isTurn = activePlayer?.userId === p.userId;
              const avatar = playerAvatars[p.userId];

              return (
                <div
                  key={p.userId}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2.5",
                    isTurn
                      ? "border-amber-400 bg-amber-400/10 text-white shadow-sm"
                      : "border-white/10 bg-slate-800/60 text-slate-200",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-white/40 bg-slate-700">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span
                          className="grid size-full place-items-center text-xs font-bold"
                          style={{ backgroundColor: seat.boardHex }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">
                          {p.name}
                        </span>
                        {p.userId === room.ownerId && (
                          <Crown className="size-3 text-amber-400" />
                        )}
                      </div>
                      <span
                        className="rounded px-1 text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: `${seat.boardHex}33`,
                          color: seat.boardHex,
                        }}
                      >
                        {seat.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-right font-mono font-bold">
                    <span className="text-base text-amber-400">{homeCount}</span>
                    <span className="text-xs text-slate-400">/ 4 Home</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRankingModalOpen(false)}
              className="rounded-xl border-white/20 text-slate-200"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}