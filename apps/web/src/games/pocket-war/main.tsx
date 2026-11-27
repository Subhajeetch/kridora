import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomPlayer } from "@kridora/shared";
import {
  ArrowLeft,
  Award,
  Crown,
  Heart,
  LogOut,
  Maximize2,
  RotateCcw,
  Skull,
  Smartphone,
  Swords,
  Trophy,
} from "lucide-react";
import { useInGameRoom } from "@/games/hooks";
import { describeError, request as socketRequest, socket } from "@/lib/socket";
import { useRealtime } from "@/providers/realtime-context";
import type { GameComponentProps } from "../types";
import { ChatOverlay } from "./components/ChatOverlay";
import { LeaveMatchDialog } from "./components/LeaveMatchDialog";
import { MatchRoomToast } from "./components/MatchRoomToast";
import { PocketWarArena } from "./components/PocketWarArena";
import { SetupScreen } from "./components/SetupScreen";
import { SoundFX } from "./engine/SoundFX";
import styles from "./pocket-war.module.css";
import {
  CHARACTER_CATALOG,
  MAP_CATALOG,
  type PocketWarActionPayload,
  type PocketWarCharacterId,
  type PocketWarMapId,
  type PocketWarState,
} from "./types";

export interface PocketWarMainProps {
  state: PocketWarState;
  currentUserId: string;
  isHost: boolean;
  roomCode: string;
  roomPlayers?: readonly RoomPlayer[];
  request: (
    event: "pocket-war:action",
    payload: PocketWarActionPayload,
  ) => void;
  onRefreshState: () => void;
  onBackToRoom?: () => void;
  onLeaveMatch?: () => Promise<void> | void;
  onKickPlayer?: (targetUserId: string) => Promise<void>;
}

interface LockableScreenOrientation {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>;
  unlock?: () => void;
}

interface VendorFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface VendorFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function isDocumentFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as VendorFullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

async function exitFullscreenSafely(): Promise<void> {
  if (typeof document === "undefined") return;
  const doc = document as VendorFullscreenDocument;
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
      await doc.exitFullscreen();
    } else if (
      doc.webkitFullscreenElement &&
      typeof doc.webkitExitFullscreen === "function"
    ) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore if already exited or unsupported
  }

  try {
    const orientation = screen.orientation as unknown as
      LockableScreenOrientation | undefined;
    orientation?.unlock?.();
  } catch {
    // Orientation unlock unsupported on desktop / iOS Safari
  }
}

export function PocketWarMain({
  state,
  currentUserId,
  isHost,
  roomCode,
  roomPlayers = [],
  request,
  onRefreshState,
  onBackToRoom,
  onLeaveMatch,
  onKickPlayer,
}: PocketWarMainProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [soundInstance] = useState<SoundFX>(() => new SoundFX());
  const [isMobile] = useState<boolean>(detectTouchDevice);
  const [muted, setMuted] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatFocused, setChatFocused] = useState<boolean>(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState<boolean>(false);
  const [isLeavingMatch, setIsLeavingMatch] = useState<boolean>(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] =
    useState<boolean>(isDocumentFullscreen);
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerHeight > window.innerWidth
      : false,
  );
  const [mobileGuardAck, setMobileGuardAck] = useState<boolean>(false);

  useEffect(() => {
    soundInstance.revive();
    return () => {
      soundInstance.destroy();
      void exitFullscreenSafely();
    };
  }, [soundInstance]);

  useEffect(() => {
    const syncViewport = () => {
      setIsFullscreen(isDocumentFullscreen());
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    document.addEventListener("fullscreenchange", syncViewport);
    document.addEventListener("webkitfullscreenchange", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      document.removeEventListener("fullscreenchange", syncViewport);
      document.removeEventListener("webkitfullscreenchange", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  const enterFullscreenLandscape = useCallback(async () => {
    soundInstance.unlock();
    const target = (containerRef.current ??
      document.documentElement) as VendorFullscreenElement;

    try {
      if (!isDocumentFullscreen()) {
        if (typeof target.requestFullscreen === "function") {
          await target.requestFullscreen();
        } else if (typeof target.webkitRequestFullscreen === "function") {
          await target.webkitRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may be unavailable on iOS Safari; allow landscape play gracefully
    }

    try {
      const orientation = screen.orientation as
        LockableScreenOrientation | undefined;
      if (isMobile && orientation?.lock) {
        await orientation.lock("landscape");
      }
    } catch {
      // Orientation lock unsupported on this browser
    }

    setIsFullscreen(isDocumentFullscreen());
    setIsPortrait(window.innerHeight > window.innerWidth);
    setMobileGuardAck(true);
  }, [isMobile, soundInstance]);

  const handleToggleFullscreen = useCallback(() => {
    if (isDocumentFullscreen()) {
      void exitFullscreenSafely().then(() => {
        setIsFullscreen(isDocumentFullscreen());
      });
    } else {
      void enterFullscreenLandscape();
    }
  }, [enterFullscreenLandscape]);

  // Exit fullscreen BEFORE returning to Room view or leaving the active match
  const handleSafeBackToRoom = useCallback(() => {
    if (!onBackToRoom) return;
    void exitFullscreenSafely().finally(() => {
      onBackToRoom();
    });
  }, [onBackToRoom]);

  const handleOpenLeaveDialog = useCallback(() => {
    if (!onLeaveMatch) return;
    soundInstance.unlock();
    soundInstance.playUiClick();
    setLeaveError(null);
    setLeaveDialogOpen(true);
  }, [onLeaveMatch, soundInstance]);

  const handleConfirmLeaveMatch = useCallback(async () => {
    if (!onLeaveMatch || isLeavingMatch) return;
    soundInstance.unlock();
    soundInstance.playUiClick();
    setIsLeavingMatch(true);
    setLeaveError(null);
    try {
      await exitFullscreenSafely();
      await onLeaveMatch();
      setLeaveDialogOpen(false);
    } catch (err) {
      setLeaveError(describeError(err));
    } finally {
      setIsLeavingMatch(false);
    }
  }, [isLeavingMatch, onLeaveMatch, soundInstance]);

  const handleDirectLeaveMatch = useCallback(() => {
    if (!onLeaveMatch || isLeavingMatch) return;
    soundInstance.unlock();
    soundInstance.playUiClick();
    setIsLeavingMatch(true);
    void exitFullscreenSafely()
      .then(() => onLeaveMatch())
      .finally(() => {
        setIsLeavingMatch(false);
      });
  }, [isLeavingMatch, onLeaveMatch, soundInstance]);

  const dispatchAction = useCallback(
    (payload: PocketWarActionPayload) => {
      request("pocket-war:action", payload);
    },
    [request],
  );

  const handleToggleMute = useCallback(() => {
    soundInstance.unlock();
    setMuted((prev) => {
      const next = !prev;
      soundInstance.setMuted(next);
      return next;
    });
  }, [soundInstance]);

  const handleSendChat = useCallback(
    (text: string) => {
      dispatchAction({ type: "send_chat", text });
    },
    [dispatchAction],
  );

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  const handleSelectCharacter = useCallback(
    (characterId: PocketWarCharacterId) => {
      dispatchAction({ type: "select_character", characterId });
    },
    [dispatchAction],
  );

  const handleToggleReady = useCallback(
    (isReady: boolean) => {
      dispatchAction({ type: "toggle_ready", isReady });
    },
    [dispatchAction],
  );

  const handleSelectMap = useCallback(
    (mapId: PocketWarMapId) => {
      if (!isHost) return;
      dispatchAction({ type: "select_map", mapId });
    },
    [dispatchAction, isHost],
  );

  const handleForceStart = useCallback(() => {
    if (!isHost) return;
    dispatchAction({ type: "force_start" });
  }, [dispatchAction, isHost]);

  const handlePlayAgain = useCallback(() => {
    if (!isHost) return;
    soundInstance.unlock();
    soundInstance.playUiConfirm();
    dispatchAction({ type: "play_again" });
  }, [dispatchAction, isHost, soundInstance]);

  const playersList = useMemo(
    () => Object.values(state.players),
    [state.players],
  );
  const selectedMap = MAP_CATALOG[state.settings.mapId];
  const myPlayer = state.players[currentUserId];

  const activeMatchPlayersCount = useMemo(() => {
    if (roomPlayers.length > 0) {
      return roomPlayers.filter((rp) => {
        const sp = state.players[rp.userId];
        return Boolean(sp && !sp.leftMatch && rp.connected);
      }).length;
    }
    const onlineSet = new Set(state.onlineUserIds);
    return playersList.filter(
      (p) => !p.leftMatch && (onlineSet.size === 0 || onlineSet.has(p.userId)),
    ).length;
  }, [playersList, roomPlayers, state.onlineUserIds, state.players]);

  const isLastActivePlayer =
    state.soloWaitEndsAt !== null || activeMatchPlayersCount <= 1;

  // Show mobile landscape/fullscreen entry guard across setup, arena, and game_over
  const showMobileLandscapeGuard =
    isMobile && (isPortrait || (!isFullscreen && !mobileGuardAck));

  const renderPhaseContent = () => {
    if (myPlayer?.leftMatch && state.phase !== "game_over") {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] via-[#152238] to-[#090d16] p-6 text-center text-white">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
            <h2 className="text-xl font-black tracking-wide text-white uppercase">
              You Left the Match
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Other players are still finishing this battle in{" "}
              <strong className="text-white">{selectedMap.name}</strong>. You
              are still in the room and will return to the lobby as soon as the
              match ends.
            </p>
            {onBackToRoom && (
              <button
                type="button"
                onClick={handleSafeBackToRoom}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a95e8] px-5 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-lg shadow-sky-500/25 transition hover:bg-[#2aa5f8] active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Room</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (state.phase === "setup") {
      return (
        <>
          <SetupScreen
            state={state}
            currentUserId={currentUserId}
            isHost={isHost}
            roomCode={roomCode}
            soundFx={soundInstance}
            muted={muted}
            isFullscreen={isFullscreen}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
            onSelectCharacter={handleSelectCharacter}
            onToggleReady={handleToggleReady}
            onSelectMap={handleSelectMap}
            onForceStart={handleForceStart}
            onRefreshState={onRefreshState}
            onBackToRoom={onBackToRoom ? handleSafeBackToRoom : undefined}
            onLeaveMatch={onLeaveMatch ? handleOpenLeaveDialog : undefined}
          />

          <ChatOverlay
            messages={state.chatMessages}
            currentUserId={currentUserId}
            onSendMessage={handleSendChat}
            isOpen={chatOpen}
            onOpenChange={setChatOpen}
            placement="setup"
            isMobile={isMobile}
          />
        </>
      );
    }

    if (state.phase === "game_over") {
      const ranked = [...playersList].sort(
        (a, b) => (a.placement ?? 99) - (b.placement ?? 99),
      );
      const winner = state.winnerUserId
        ? state.players[state.winnerUserId]
        : ranked[0];
      const mvp = state.mvpUserId ? state.players[state.mvpUserId] : null;

      return (
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#0f172a] via-[#132a2e] to-[#090d16] p-3 text-white sm:p-6">
          <div className="w-full max-w-2xl rounded-3xl border border-amber-400/35 bg-slate-900/92 p-4 shadow-2xl backdrop-blur-md sm:p-7">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 shadow-lg shadow-amber-500/15 sm:h-14 sm:w-14">
                <Trophy className="h-7 w-7 text-amber-400 sm:h-8 sm:w-8" />
              </div>
              <span className="text-[10px] font-black tracking-widest text-emerald-300 uppercase sm:text-[11px]">
                {selectedMap.name} • Battle Complete
              </span>
              <h2 className="mt-1 text-xl font-black text-white sm:text-3xl">
                {winner ? `${winner.username} Wins!` : "Match Over"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Rings & XP have been awarded automatically.
              </p>

              {mvp && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-200">
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  <span>
                    Match MVP: {mvp.username} ({mvp.kills} Kills •{" "}
                    {Math.round(mvp.damageDealt)} DMG)
                  </span>
                </div>
              )}
            </div>

            <div className="mb-5 max-h-48 space-y-1.5 overflow-y-auto sm:max-h-64">
              {ranked.map((p, idx) => {
                const charDef = CHARACTER_CATALOG[p.characterId];
                const isMvp = p.userId === state.mvpUserId;
                const isMe = p.userId === currentUserId;
                return (
                  <div
                    key={p.userId}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs sm:text-sm ${
                      idx === 0
                        ? "border-amber-400/60 bg-amber-500/15"
                        : isMe
                          ? "border-sky-400/40 bg-sky-500/10"
                          : "border-white/10 bg-slate-950/65"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono font-black text-amber-300">
                        #{p.placement ?? idx + 1}
                      </span>
                      {idx === 0 && (
                        <Crown className="h-4 w-4 shrink-0 text-amber-400" />
                      )}
                      <span className="font-bold text-white">
                        {p.username}
                        {isMe ? " (You)" : ""}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                        style={{ backgroundColor: charDef.palette.sashColor }}
                      >
                        {charDef.name}
                      </span>
                      {isMvp && (
                        <span className="rounded-full bg-sky-500/25 px-2 py-0.5 text-[10px] font-black text-sky-300">
                          MVP
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span
                        className="flex items-center gap-0.5"
                        title="Lives left"
                      >
                        <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-400" />
                        <span className="font-bold">{p.livesLeft}</span>
                      </span>
                      <span className="flex items-center gap-1 font-bold text-amber-300">
                        <Swords className="h-3.5 w-3.5" />
                        {p.kills}
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Skull className="h-3.5 w-3.5" />
                        {p.deaths}
                      </span>
                      <span className="font-mono text-slate-300">
                        {Math.round(p.damageDealt)} DMG
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="flex items-center gap-2 rounded-xl bg-[#1a95e8] px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-[#2aa5f8] active:scale-95 sm:text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              ) : (
                <div className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-xs font-semibold text-slate-400">
                  Waiting for host to start another match...
                </div>
              )}

              {onBackToRoom && (
                <button
                  type="button"
                  onClick={handleSafeBackToRoom}
                  className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700 sm:text-sm"
                >
                  Return to Room
                </button>
              )}

              {onLeaveMatch && (
                <button
                  type="button"
                  disabled={isLeavingMatch}
                  onClick={handleDirectLeaveMatch}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600/85 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50 sm:text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLeavingMatch ? "Leaving..." : "Leave Match"}</span>
                </button>
              )}
            </div>
          </div>

          <ChatOverlay
            messages={state.chatMessages}
            currentUserId={currentUserId}
            onSendMessage={handleSendChat}
            isOpen={chatOpen}
            onOpenChange={setChatOpen}
            placement="gameover"
            isMobile={isMobile}
          />
        </div>
      );
    }

    return (
      <>
        <PocketWarArena
          state={state}
          currentUserId={currentUserId}
          roomPlayers={roomPlayers}
          isRoomOwner={isHost}
          soundFx={soundInstance}
          muted={muted}
          isMobile={isMobile}
          isFullscreen={isFullscreen}
          chatFocused={chatFocused}
          onToggleMute={handleToggleMute}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenChat={handleOpenChat}
          onBackToRoom={onBackToRoom ? handleSafeBackToRoom : undefined}
          onLeaveMatch={onLeaveMatch ? handleOpenLeaveDialog : undefined}
          onKickPlayer={onKickPlayer}
        />

        <ChatOverlay
          messages={state.chatMessages}
          currentUserId={currentUserId}
          onSendMessage={handleSendChat}
          onFocusChange={setChatFocused}
          isOpen={chatOpen}
          onOpenChange={setChatOpen}
          placement="arena"
          isMobile={isMobile}
        />
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      onPointerDownCapture={() => soundInstance.unlock()}
      onKeyDownCapture={() => soundInstance.unlock()}
      className={`${styles.fullscreenRoot} bg-slate-950`}
    >
      {renderPhaseContent()}

      {/* Ludo-style Room Join / Leave / Disconnect Toasts */}
      {roomPlayers.length > 0 && (
        <MatchRoomToast
          players={roomPlayers}
          matchPlayers={state.players}
          currentUserId={currentUserId}
          soundFx={soundInstance}
        />
      )}

      {/* Ludo-style In-Match Leave Confirmation Modal (never leaves room) */}
      <LeaveMatchDialog
        open={leaveDialogOpen}
        phase={state.phase}
        roomCode={roomCode}
        isLastActivePlayer={isLastActivePlayer}
        isLeaving={isLeavingMatch}
        error={leaveError}
        onCancel={() => {
          if (!isLeavingMatch) setLeaveDialogOpen(false);
        }}
        onConfirm={() => {
          void handleConfirmLeaveMatch();
        }}
      />

      {/* Persistent Mobile Fullscreen & Landscape Entry Guard (active from SetupScreen onward) */}
      {showMobileLandscapeGuard && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/94 p-6 text-center text-white backdrop-blur-md">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 text-sky-300 shadow-lg shadow-sky-500/20">
            <Smartphone className="h-8 w-8 rotate-90" />
          </div>
          <h2 className="text-xl font-black tracking-wide uppercase">
            {isPortrait ? "Rotate to Landscape" : "Enter Fullscreen Landscape"}
          </h2>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-300">
            Pocket War uses dual-stick jetpack controls built for fullscreen
            landscape play. Tap below to lock fullscreen and unlock audio.
          </p>

          <button
            type="button"
            onClick={() => {
              void enterFullscreenLandscape();
            }}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[#1a95e8] px-6 py-3 text-sm font-black tracking-wider text-white uppercase shadow-lg shadow-sky-500/30 transition hover:bg-[#2aa5f8] active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
            <span>
              {isPortrait ? "Lock Fullscreen Landscape" : "Enter Fullscreen"}
            </span>
          </button>

          {!isPortrait && (
            <button
              type="button"
              onClick={() => {
                soundInstance.unlock();
                setMobileGuardAck(true);
              }}
              className="mt-3 text-xs font-bold text-slate-400 underline hover:text-white"
            >
              Continue in browser view
            </button>
          )}

          {onBackToRoom && (
            <button
              type="button"
              onClick={handleSafeBackToRoom}
              className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Room</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PocketWarGame({ room, userId }: GameComponentProps) {
  const { roomCode, owner, onBackToRoom } = useInGameRoom();
  const { setActiveRoom } = useRealtime();
  const isHost = room.ownerId === userId || owner?.userId === userId;

  const [state, setState] = useState<PocketWarState | null>(null);
  const leavingMatchRef = useRef(false);

  const refreshState = useCallback(() => {
    socketRequest("pocket-war:get-state", {})
      .then((s) => {
        if (s) setState(s as PocketWarState);
      })
      .catch((err) => {
        console.warn("Failed to refresh Pocket War state:", err);
      });
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchLatestState = () => {
      socketRequest("pocket-war:get-state", {})
        .then((s) => {
          if (mounted && s) setState(s as PocketWarState);
        })
        .catch((err) => {
          console.warn("Failed to load Pocket War state:", err);
        });
    };

    fetchLatestState();

    const handleState = (nextState: PocketWarState) => {
      if (mounted) setState(nextState);
    };

    socket.on("pocket-war:state", handleState);
    socket.on("connect", fetchLatestState);

    return () => {
      mounted = false;
      socket.off("pocket-war:state", handleState);
      socket.off("connect", fetchLatestState);
    };
  }, []);

  const handleAction = useCallback(
    (_event: "pocket-war:action", payload: PocketWarActionPayload) => {
      socketRequest("pocket-war:action", payload)
        .then((next) => {
          if (next) setState(next as PocketWarState);
        })
        .catch((err) => {
          console.error("Pocket War action error:", err);
        });
    },
    [],
  );

  const handleLeaveMatch = useCallback(async () => {
    if (leavingMatchRef.current) return;
    leavingMatchRef.current = true;
    try {
      const next = await socketRequest("pocket-war:action", {
        type: "leave_match",
      });
      if (next) setState(next as PocketWarState);
    } catch (err) {
      console.error("Failed to leave Pocket War match:", err);
    } finally {
      leavingMatchRef.current = false;
      onBackToRoom();
    }
  }, [onBackToRoom]);

  const handleKickOfflinePlayer = useCallback(
    async (targetUserId: string) => {
      const updated = await socketRequest("room:kick", {
        userId: targetUserId,
      });
      setActiveRoom(updated);
    },
    [setActiveRoom],
  );

  if (!state) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-3 border-sky-400 border-t-transparent" />
          <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
            Entering Emerald Falls...
          </span>
        </div>
      </div>
    );
  }

  return (
    <PocketWarMain
      state={state}
      currentUserId={userId}
      isHost={isHost}
      roomCode={roomCode}
      roomPlayers={room.players}
      request={handleAction}
      onRefreshState={refreshState}
      onBackToRoom={onBackToRoom}
      onLeaveMatch={handleLeaveMatch}
      onKickPlayer={handleKickOfflinePlayer}
    />
  );
}
