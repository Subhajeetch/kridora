import { Crown, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { LudoColor, LudoGameState } from "@kridora/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function LudoGame({ room, userId }: GameComponentProps) {
  const navigate = useNavigate();
  const audio = useAudioSettings();
  const { setActiveRoom } = useRealtime();

  const [state, setState] = useState<LudoGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollingColor, setRollingColor] = useState<LudoColor | null>(null);

  // Leave Confirmation Dialog
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Standings / Ranking Modal
  const [rankingModalOpen, setRankingModalOpen] = useState(false);

  // Active Emotes: map of userId -> { emoji, timestamp }
  const [activeEmotes, setActiveEmotes] = useState<Record<string, { emoji: string; timestamp: number }>>({});

  // Refs to track auto-move, auto-pass, rolling timeout, and dice sound deduplication
  const autoMoveTriggeredRef = useRef<string | null>(null);
  const autoPassTriggeredRef = useRef<string | null>(null);
  const rollTimerRef = useRef<number | null>(null);
  const lastLandedRollKeyRef = useRef<string | null>(null);

  const triggerRollAnimation = useCallback((color: LudoColor) => {
    setRollingColor(color);
    ludoAudio.diceRoll(audio);
  }, [audio]);

  // 1. Initial State Fetch & Realtime Subscription
  useEffect(() => {
    let active = true;

    void request("ludo:get-state", {})
      .then((initial) => {
        if (active) setState(initial);
      })
      .catch((err) => {
        if (active) setError(describeError(err));
      });

    function onState(next: LudoGameState) {
      setState(next);
      if (next.dice !== null) {
        const rollKey = `${next.updatedAt}:${next.dice}:${next.currentPlayerIndex}`;
        if (lastLandedRollKeyRef.current !== rollKey) {
          lastLandedRollKeyRef.current = rollKey;
          window.setTimeout(() => {
            ludoAudio.diceLand(next.dice!, audio);
          }, rollTimerRef.current ? 400 : 0);
        }
      }
    }

    function onRolling(payload: { color: LudoColor; userId: string }) {
      if (payload.userId !== userId) {
        triggerRollAnimation(payload.color);
        if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
        rollTimerRef.current = window.setTimeout(() => {
          setRollingColor((prev) => (prev === payload.color ? null : prev));
          rollTimerRef.current = null;
        }, 460);
      }
    }

    function onEmoteReceived(payload: { userId: string; emoji: string }) {
      ludoAudio.emotePop(audio);
      setActiveEmotes((prev) => ({
        ...prev,
        [payload.userId]: { emoji: payload.emoji, timestamp: Date.now() },
      }));
      window.setTimeout(() => {
        setActiveEmotes((prev) => {
          const current = prev[payload.userId];
          if (current && current.emoji === payload.emoji) {
            const next = { ...prev };
            delete next[payload.userId];
            return next;
          }
          return prev;
        });
      }, 2500);
    }

    socket.on("ludo:state", onState);
    socket.on("ludo:rolling", onRolling);
    socket.on("ludo:emote", onEmoteReceived);

    return () => {
      active = false;
      socket.off("ludo:state", onState);
      socket.off("ludo:rolling", onRolling);
      socket.off("ludo:emote", onEmoteReceived);
      if (rollTimerRef.current) window.clearTimeout(rollTimerRef.current);
    };
  }, [userId, audio, triggerRollAnimation]);

  // Sync avatar map
  const playerAvatars = useMemo(() => {
    const map: Record<string, string | null> = {};
    room.players.forEach((p) => {
      map[p.userId] = p.image ?? null;
    });
    return map;
  }, [room.players]);

  // Check which players are offline
  const offlinePlayers = useMemo(() => {
    if (!state) return [];
    return room.players.filter(
      (rp) =>
        state.players.some((sp) => sp.userId === rp.userId) && !rp.connected,
    );
  }, [state, room.players]);

  const isPaused = offlinePlayers.length > 0;
  const isRoomOwner = room.ownerId === userId;

  // Generic act helper
  const act = useCallback(
    async (fn: () => Promise<LudoGameState>) => {
      if (busy || isPaused) return;
      setBusy(true);
      setError(null);
      try {
        const next = await fn();
        setState(next);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, isPaused],
  );

  // Dice Roll Handler with authentic 3D tumble momentum
  const handleRoll = useCallback(() => {
    if (busy || isPaused || rollingColor !== null || !state) return;
    const active = state.players[state.currentPlayerIndex];
    if (!active || active.userId !== userId) return;

    const myColor = active.color;
    triggerRollAnimation(myColor);

    void act(async () => {
      // Ensure the 3D tumble animation runs for at least 460ms so it feels physical and identical to HTML!
      const [next] = await Promise.all([
        request("ludo:roll", {}),
        new Promise<void>((res) => setTimeout(res, 460)),
      ]);
      setRollingColor(null);
      if (next.dice !== null) {
        const rollKey = `${next.updatedAt}:${next.dice}:${next.currentPlayerIndex}`;
        lastLandedRollKeyRef.current = rollKey;
        ludoAudio.diceLand(next.dice, audio);
      }
      return next;
    }).catch(() => {
      setRollingColor(null);
    });
  }, [busy, isPaused, rollingColor, state, userId, triggerRollAnimation, audio, act]);

  // Token Move Handler
  const handleMoveToken = useCallback(
    (tokenIndex: number) => {
      if (busy || isPaused) return;
      void act(() => request("ludo:move", { tokenIndex }));
    },
    [busy, isPaused, act],
  );

  // Auto-move when only 1 legal piece can move (matching HTML game behavior)
  useEffect(() => {
    if (!state || isPaused || rollingColor !== null) return;
    if (state.dice === null) return;

    const active = state.players[state.currentPlayerIndex];
    const isMe = active?.userId === userId;

    if (!isMe) return;

    if (state.movableTokens.length === 1) {
      const rollKey = `${state.updatedAt}:${state.dice}:${state.currentPlayerIndex}`;
      if (autoMoveTriggeredRef.current === rollKey) return;
      autoMoveTriggeredRef.current = rollKey;

      const tokenIdx = state.movableTokens[0]!;
      const timer = window.setTimeout(() => {
        handleMoveToken(tokenIdx);
      }, 480);

      return () => window.clearTimeout(timer);
    }
  }, [state, isPaused, rollingColor, userId, handleMoveToken]);

  // Handle automatic turn pass when no valid moves are available (matching HTML game behavior)
  useEffect(() => {
    if (!state || isPaused || rollingColor !== null) return;
    if (state.dice === null) return;

    if (state.movableTokens.length === 0) {
      const passKey = `${state.updatedAt}:${state.dice}:${state.currentPlayerIndex}`;
      if (autoPassTriggeredRef.current === passKey) return;
      autoPassTriggeredRef.current = passKey;

      const active = state.players[state.currentPlayerIndex];
      const isMe = active?.userId === userId;
      // Active player passes after 1000ms delay so all players can clearly see the rolled number
      // Fallback: room owner passes after 2200ms if active player disconnected
      const delay = isMe ? 1000 : isRoomOwner ? 2200 : 0;
      if (delay > 0) {
        const timer = window.setTimeout(() => {
          void act(() => request("ludo:pass", {}));
        }, delay);
        return () => window.clearTimeout(timer);
      }
    }
  }, [state, isPaused, rollingColor, userId, isRoomOwner, act]);

  // Leave Room Flow
  const handleConfirmLeave = useCallback(async () => {
    setIsLeaving(true);
    try {
      await request("room:leave", {});
      setActiveRoom(null);
      void navigate(`/${room.gameSlug}`);
    } catch (err) {
      setError(describeError(err));
      setIsLeaving(false);
      setLeaveConfirmOpen(false);
    }
  }, [navigate, room.gameSlug, setActiveRoom]);

  // Emote reaction handler
  const handleSendEmote = useCallback(
    (emoji: string) => {
      ludoAudio.emotePop(audio);
      setActiveEmotes((prev) => ({
        ...prev,
        [userId]: { emoji, timestamp: Date.now() },
      }));
      window.setTimeout(() => {
        setActiveEmotes((prev) => {
          const current = prev[userId];
          if (current && current.emoji === emoji) {
            const next = { ...prev };
            delete next[userId];
            return next;
          }
          return prev;
        });
      }, 2500);

      void request("ludo:emote", { emoji }).catch(() => {});
    },
    [userId, audio],
  );

  // Kick Offline Player
  const handleKickOffline = useCallback(
    async (targetUserId: string) => {
      try {
        const updated = await request("room:kick", { userId: targetUserId });
        setActiveRoom(updated);
      } catch (err) {
        setError(describeError(err));
      }
    },
    [setActiveRoom],
  );

  // End Game
  const handleEndGame = useCallback(async () => {
    try {
      const updated = await request("room:end-game", {});
      setActiveRoom(updated);
    } catch (err) {
      setError(describeError(err));
    }
  }, [setActiveRoom]);

  if (!state) {
    if (error) {
      return (
        <div className="mx-auto my-12 max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-200 backdrop-blur-md">
          <p className="font-semibold text-white">Unable to connect to Ludo match</p>
          <p className="mt-1 text-xs text-rose-300/80">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void request("ludo:get-state", {})
                .then(setState)
                .catch((err) => setError(describeError(err)));
            }}
            className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/20 px-4 py-2 text-xs font-semibold hover:bg-rose-500/30 cursor-pointer"
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

  const activePlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = activePlayer?.userId === userId;
  const canRoll = isMyTurn && state.dice === null && !busy && !isPaused && rollingColor === null;

  const getPlayerDiceValue = (color: LudoColor) => {
    if (state.dice !== null && activePlayer?.color === color) {
      return state.dice;
    }
    const idx = state.players.findIndex((p) => p.color === color);
    return idx !== -1 ? (state.lastRolls[idx] ?? 1) : 1;
  };

  const occupiedColors = new Set(state.players.map((p) => p.color));

  return (
    <div className={cn(styles.nocturneBg, "mx-auto min-h-[calc(100dvh-5.5rem)] w-full max-w-[2000px] rounded-2xl sm:rounded-3xl p-2 sm:p-5 shadow-2xl flex flex-col justify-between select-none relative overflow-hidden pb-36 md:pb-4")}>
      {/* Ambient Nocturne background organic squircle blobs matching reference image */}
      <div className={styles.ambientBlob1} />
      <div className={styles.ambientBlob2} />
      <div className={styles.ambientBlob3} />
      <div className={styles.ambientBlob4} />

      {/* Realtime Toasts for Room Joins / Leaves */}
      <RoomToast players={room.players} audioSettings={audio} />

      {/* 2. MAIN LAYOUT: 15x15 LUDO BOARD (Left/Center) + NOCTURNE SIDE PANEL (Right, side-by-side on md+) */}
      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-center gap-5 md:gap-6 lg:gap-8 my-auto py-1 w-full max-w-[2000px] mx-auto">
        {/* Left / Center: 15x15 Ludo Board */}
        <div className="flex items-center justify-center shrink-0">
          <LudoBoard
            state={state}
            userId={userId}
            onMoveToken={handleMoveToken}
            audioSettings={audio}
            occupiedColors={occupiedColors}
            playerAvatars={playerAvatars}
          />
        </div>

        {/* Tablet & Desktop: Nocturne Side Panel (Side by side on md+) */}
        <NocturneSidePanel
          state={state}
          room={room}
          userId={userId}
          activePlayer={activePlayer}
          isMyTurn={isMyTurn}
          canRoll={canRoll}
          rollingColor={rollingColor}
          diceValue={activePlayer ? getPlayerDiceValue(activePlayer.color) : (state.dice ?? 1)}
          onRoll={handleRoll}
          onEmote={handleSendEmote}
          onLeaveGame={() => setLeaveConfirmOpen(true)}
          activeEmotes={activeEmotes}
          playerAvatars={playerAvatars}
        />
      </div>

      {/* 3. MOBILE: Nocturne Bottom Drawer (visible on phone screens < md) */}
      <MobileNocturneDrawer
        state={state}
        room={room}
        userId={userId}
        activePlayer={activePlayer}
        isMyTurn={isMyTurn}
        canRoll={canRoll}
        rollingColor={rollingColor}
        diceValue={activePlayer ? getPlayerDiceValue(activePlayer.color) : (state.dice ?? 1)}
        onRoll={handleRoll}
        onEmote={handleSendEmote}
        onLeaveGame={() => setLeaveConfirmOpen(true)}
        activeEmotes={activeEmotes}
        playerAvatars={playerAvatars}
      />

      {/* 3. OFFLINE WAIT SCREEN (Pauses match for everyone when someone is disconnected) */}
      {isPaused && (
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

      {/* 7. LEAVE CONFIRMATION DIALOG */}
      <LeaveConfirmDialog
        open={leaveConfirmOpen}
        onOpenChange={setLeaveConfirmOpen}
        onConfirm={handleConfirmLeave}
        isLeaving={isLeaving}
      />

      {/* 8. MATCH STANDINGS MODAL */}
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
              const homeCount = p.tokens.filter((s) => s === 57).length;
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-white/40 bg-slate-700">
                      {avatar ? (
                        <img src={avatar} alt="" className="size-full object-cover" />
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
                        <span className="font-bold text-sm text-white truncate">
                          {p.name}
                        </span>
                        {p.userId === room.ownerId && (
                          <Crown className="size-3 text-amber-400" />
                        )}
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase px-1 rounded"
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
