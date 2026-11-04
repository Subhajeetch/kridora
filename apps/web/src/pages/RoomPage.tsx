import {
  getGameDefinition,
  type GameDefinition,
  type GameSlug,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomVisibility,
} from "@kridora/shared";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  Copy,
  Crown,
  Gamepad2,
  Globe,
  Link as LinkIcon,
  Loader2,
  Lock,
  LogOut,
  Play,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChangeGameDialog } from "@/components/games/ChangeGameDialog";
import { GameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameLaunchScreen } from "@/components/games/GameLaunchScreen";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { findEnabledGame } from "@/config/games";
import { gameComponents } from "@/games/registry";
import { useCountdown } from "@/hooks/useCountdown";
import {
  playPlayerJoinSound,
  playPlayerLeaveSound,
  updateAudioSettings,
  useAudioSettings,
} from "@/lib/audio-settings";
import { authClient } from "@/lib/auth-client";
import { describeError, request } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useGameLayout } from "@/providers/game-layout-context";
import { useRealtime } from "@/providers/realtime-context";
import NotFoundPage from "./NotFoundPage";

/** yourdomain.com/<game>/room */
export default function RoomPage() {
  const { slug } = useParams();
  const gameSlug = findEnabledGame(slug);
  if (!gameSlug) return <NotFoundPage />;
  return <RoomEntrance gameSlug={gameSlug} />;
}

/**
 * Manages room entrance and identity checks for active room members.
 * Room state is tracked securely in client/socket state without exposing room codes in the URL.
 */
function RoomEntrance({ gameSlug }: { gameSlug: GameSlug }) {
  const navigate = useNavigate();
  const { connection, activeRoom } = useRealtime();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const hasEnteredRoom = useRef(false);

  const isInThisRoom = Boolean(
    session && activeRoom && activeRoom.gameSlug === gameSlug,
  );

  useEffect(() => {
    if (isInThisRoom) {
      hasEnteredRoom.current = true;
    }
  }, [isInThisRoom]);

  // Room game changed: seamlessly navigate everyone in the room to the new game's room URL
  useEffect(() => {
    if (activeRoom && activeRoom.gameSlug !== gameSlug) {
      void navigate(`/${activeRoom.gameSlug}/room`, { replace: true });
    }
  }, [activeRoom, gameSlug, navigate]);

  // Kicked, or the room was closed: the provider cleared activeRoom, so go back to the game's front door.
  useEffect(() => {
    if (hasEnteredRoom.current && !activeRoom) {
      void navigate(`/${gameSlug}`, { replace: true });
    }
  }, [activeRoom, gameSlug, navigate]);

  // Redirect to game lobby only after session has resolved and user has no session,
  // or after socket has connected and room state is confirmed empty.
  useEffect(() => {
    if (isSessionPending) return;

    if (!session) {
      void navigate(`/${gameSlug}`, { replace: true });
      return;
    }

    if (connection === "connected" && !activeRoom && !hasEnteredRoom.current) {
      void navigate(`/${gameSlug}`, { replace: true });
    }
  }, [isSessionPending, session, connection, activeRoom, gameSlug, navigate]);

  if (activeRoom && activeRoom.gameSlug === gameSlug && session) {
    return <RoomView room={activeRoom} userId={session.user.id} />;
  }

  return <RoomJoiningLoader gameSlug={activeRoom?.gameSlug ?? gameSlug} />;
}

/** Clean retro arcade loading state while room membership is established */
function RoomJoiningLoader({ gameSlug }: { gameSlug: GameSlug }) {
  const game = getGameDefinition(gameSlug);
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center px-4 py-20 text-center">
      <div className="w-full pixel-corners-md bg-white/15 p-[1.5px]">
        <div className="pixel-corners-sm bg-[#12131a] p-7 sm:p-8 flex flex-col items-center">
          <div className="pixel-corners-sm bg-white/15 p-[1.5px] shrink-0">
            <div className="pixel-corners-sm size-16 bg-[#0a0b10] overflow-hidden flex items-center justify-center">
              <GameThumbnail
                slug={gameSlug}
                name={game.name}
                className="size-full object-cover"
              />
            </div>
          </div>

          <h2 className="mt-4 font-retro text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
            {game.name}
          </h2>
          <p className="mt-1 text-xs text-gray-400">Syncing room session...</p>

          <div className="mt-6 w-44 pixel-corners-sm bg-white/15 p-[1px]">
            <div className="w-full pixel-corners-sm bg-[#0a0b10] h-2 overflow-hidden">
              <div className="load-bar h-full w-full bg-gradient-to-r from-[#facc15] to-[#fbbf24]" />
            </div>
          </div>

          <Link
            to={`/${gameSlug}`}
            className="mt-7 inline-flex items-center gap-1.5 text-xs font-retro uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Lobby</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  room,
  isMe,
  canManage,
  onMakeOwner,
  onKick,
  disabled,
}: {
  player: RoomPlayer;
  room: RoomSnapshot;
  isMe: boolean;
  canManage: boolean;
  onMakeOwner: () => void;
  onKick: () => void;
  disabled: boolean;
}) {
  const isOwner = player.userId === room.ownerId;
  const inLobby = room.status === "lobby";
  const isReady = player.isReady || isOwner;

  return (
    <li className="pixel-corners-sm bg-white/[0.08] hover:bg-white/15 p-[1px] transition-colors">
      <div className="pixel-corners-sm bg-[#171822] hover:bg-[#1c1e2a] px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors">
        {/* Left: Avatar & Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="pixel-corners-sm bg-white/15 p-[1px] shrink-0">
            <div
              className={cn(
                "pixel-corners-sm size-10 bg-[#0a0b10] flex items-center justify-center font-retro text-sm font-bold text-[#facc15] overflow-hidden select-none",
                !player.connected && "opacity-45",
              )}
              aria-hidden="true"
            >
              {player.image ? (
                <img
                  src={player.image}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                player.name.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-retro text-xs sm:text-sm font-bold uppercase truncate",
                  player.connected ? "text-white" : "text-gray-400",
                )}
              >
                {player.name}
              </span>

              {isMe && (
                <span className="shrink-0 pixel-corners-sm bg-[#facc15]/40 p-[1px] inline-flex">
                  <span className="pixel-corners-sm bg-[#facc15]/15 px-1.5 py-0.5 font-retro text-[9px] font-bold uppercase text-[#facc15] select-none">
                    YOU
                  </span>
                </span>
              )}
            </div>

            {(isOwner || player.isAnonymous) && (
              <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                {isOwner && (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                    <Crown className="size-3 text-amber-300" />
                    <span>Host</span>
                  </span>
                )}
                {player.isAnonymous && (
                  <span className="text-gray-500">Guest</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Status Pill & Host Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {canManage && !isMe && (
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  "pixel-corners-sm bg-white/10 hover:bg-amber-400/40 p-[1px] transition-colors inline-flex",
                  disabled && "opacity-40 cursor-not-allowed",
                )}
              >
                <button
                  type="button"
                  title="Make Host"
                  aria-label={`Make ${player.name} the room host`}
                  disabled={disabled}
                  onClick={onMakeOwner}
                  className="pixel-corners-sm bg-[#12131a] hover:bg-amber-400/15 text-gray-400 hover:text-amber-300 p-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Crown className="size-3.5" />
                </button>
              </div>

              {inLobby && (
                <div
                  className={cn(
                    "pixel-corners-sm bg-white/10 hover:bg-rose-500/40 p-[1px] transition-colors inline-flex",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <button
                    type="button"
                    title="Kick Player"
                    aria-label={`Remove ${player.name} from room`}
                    disabled={disabled}
                    onClick={onKick}
                    className="pixel-corners-sm bg-[#12131a] hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 p-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <UserX className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {!player.connected ? (
            <span className="pixel-corners-sm bg-amber-400/35 p-[1px] inline-flex">
              <span className="inline-flex items-center gap-1 pixel-corners-sm bg-amber-400/10 px-2 py-1 font-retro text-[9px] uppercase text-amber-300">
                <WifiOff className="size-3" />
                <span>Offline</span>
              </span>
            </span>
          ) : inLobby ? (
            isReady ? (
              <span className="pixel-corners-sm bg-emerald-500/40 p-[1px] inline-flex">
                <span className="inline-flex items-center gap-1 pixel-corners-sm bg-emerald-500/15 px-2.5 py-1 font-retro text-[9px] font-bold uppercase text-emerald-300">
                  <Check className="size-3" />
                  <span>Ready</span>
                </span>
              </span>
            ) : (
              <span className="pixel-corners-sm bg-white/15 p-[1px] inline-flex">
                <span className="inline-flex items-center pixel-corners-sm bg-white/[0.04] px-2.5 py-1 font-retro text-[9px] uppercase text-gray-400">
                  Waiting
                </span>
              </span>
            )
          ) : (
            <span className="pixel-corners-sm bg-[#22e4ff]/40 p-[1px] inline-flex">
              <span className="inline-flex items-center gap-1 pixel-corners-sm bg-[#22e4ff]/15 px-2.5 py-1 font-retro text-[9px] font-bold uppercase text-[#22e4ff]">
                <Gamepad2 className="size-3" />
                <span>Playing</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * In-Game Shell:
 * Low-profile dark arcade HUD bar that keeps visual focus on the active game board.
 */
function InGameContainer({
  room,
  userId,
  game,
  secondsLeft,
  owner,
  successor,
  onBackToRoom,
  onLeave,
  leaveBusy,
}: {
  room: RoomSnapshot;
  userId: string;
  game: GameDefinition;
  secondsLeft: number | null;
  owner: RoomPlayer | undefined;
  successor: RoomPlayer | undefined;
  onBackToRoom: () => void;
  onLeave: () => void;
  leaveBusy: boolean;
}) {
  const audio = useAudioSettings();
  const GameComponent = gameComponents[room.gameSlug];
  const [isLaunching, setIsLaunching] = useState(true);

  // Launch transition so players see the match briefing before the game board renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLaunching(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full py-1 sm:py-2">
      {/* Low-profile In-Game Top Bar */}
      <header className="sticky top-2 z-30 mb-2 mx-auto w-full max-w-[2000px] filter drop-shadow-[0_3px_0_#000000]">
        <div className="pixel-corners-md bg-white/15 p-[1.5px] w-full">
          <div className="pixel-corners-sm bg-[#12131a] px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center justify-between gap-3">
            {/* Back to Room Roster */}
            <div className="pixel-corners-sm bg-white/15 hover:bg-white/25 p-[1px] transition-colors inline-flex">
              <button
                type="button"
                onClick={onBackToRoom}
                aria-label="View room players and settings"
                className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-200 hover:text-white font-retro text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5 text-[#facc15]" />
                <span>Room</span>
                <span className="pixel-corners-sm bg-white/15 p-[1px] inline-flex">
                  <span className="pixel-corners-sm bg-[#0a0b10] px-1.5 py-0.5 font-mono text-[10px] text-[#facc15]">
                    {room.players.length}/{room.maxPlayers}
                  </span>
                </span>
              </button>
            </div>

            {/* Center: Game & Room Code */}
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-flex items-center gap-1.5 font-retro text-xs font-bold uppercase tracking-wide text-white">
                <Gamepad2 className="size-3.5 text-[#facc15]" />
                <span>{game.name}</span>
              </span>
              <span className="pixel-corners-sm bg-white/15 p-[1px] inline-flex">
                <span className="pixel-corners-sm bg-[#0a0b10] px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-[#facc15]">
                  {room.code}
                </span>
              </span>
            </div>

            {/* Right: Audio & Leave */}
            <div className="flex items-center gap-1.5">
              <div className="pixel-corners-sm bg-white/15 hover:bg-white/25 p-[1px] transition-colors inline-flex">
                <button
                  type="button"
                  aria-label={
                    audio.muted ? "Unmute game audio" : "Mute game audio"
                  }
                  onClick={() => updateAudioSettings({ muted: !audio.muted })}
                  className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-300 hover:text-[#facc15] p-1.5 sm:p-2 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {audio.muted ? (
                    <VolumeX className="size-3.5" />
                  ) : (
                    <Volume2 className="size-3.5" />
                  )}
                </button>
              </div>

              <div
                className={cn(
                  "pixel-corners-sm bg-white/15 hover:bg-rose-500/40 p-[1px] transition-colors inline-flex",
                  leaveBusy && "opacity-40 cursor-not-allowed",
                )}
              >
                <button
                  type="button"
                  aria-label="Leave room"
                  title="Leave room"
                  onClick={onLeave}
                  disabled={leaveBusy}
                  className="pixel-corners-sm bg-[#181922] hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 p-1.5 sm:p-2 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Offline Host Countdown Alert */}
      {secondsLeft !== null && owner && (
        <div className="mx-auto mb-3 max-w-5xl px-2">
          <div className="pixel-corners-sm bg-amber-400/35 p-[1px] w-full">
            <div
              role="status"
              className="pixel-corners-sm bg-amber-400/10 px-3.5 py-2.5 text-xs text-amber-200 font-retro flex items-center justify-between gap-3"
            >
              <span>
                Host ({owner.name}) is offline.
                {successor
                  ? ` ${successor.name} becomes host in ${secondsLeft}s.`
                  : " Waiting for host reconnect..."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Game Screen with Error Boundary and Launch Loader */}
      <div className="lg:relative lg:left-1/2 lg:w-[calc(100vw-2rem)] lg:max-w-[2000px] lg:-translate-x-1/2">
        <GameErrorBoundary
          gameName={game.name}
          onBackToRoom={onBackToRoom}
          onLeaveRoom={onLeave}
        >
          {isLaunching ? (
            <GameLaunchScreen
              room={room}
              gameName={game.name}
              onBackToRoom={onBackToRoom}
            />
          ) : (
            <Suspense
              fallback={
                <GameLaunchScreen
                  room={room}
                  gameName={game.name}
                  onBackToRoom={onBackToRoom}
                  statusMessage="Downloading game engine components..."
                />
              }
            >
              <GameComponent room={room} userId={userId} />
            </Suspense>
          )}
        </GameErrorBoundary>
      </div>
    </section>
  );
}

function RoomView({ room, userId }: { room: RoomSnapshot; userId: string }) {
  const navigate = useNavigate();
  const { setActiveRoom, clockOffset } = useRealtime();
  const { setInGameMode } = useGameLayout();
  const game = getGameDefinition(room.gameSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyingLink, setCopyingLink] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [changeGameOpen, setChangeGameOpen] = useState(false);
  const [gameChangeNotice, setGameChangeNotice] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveCountdown, setLeaveCountdown] = useState(3);
  const [publicConfirmOpen, setPublicConfirmOpen] = useState(false);
  const [publicCountdown, setPublicCountdown] = useState(3);
  const prevSlugRef = useRef(room.gameSlug);

  function handleLeaveOpenChange(open: boolean) {
    setLeaveConfirmOpen(open);
    if (open) setLeaveCountdown(3);
  }

  function handlePublicOpenChange(open: boolean) {
    setPublicConfirmOpen(open);
    if (open) setPublicCountdown(3);
  }

  useEffect(() => {
    if (!leaveConfirmOpen) return;
    const interval = setInterval(() => {
      setLeaveCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [leaveConfirmOpen]);

  useEffect(() => {
    if (!publicConfirmOpen) return;
    const interval = setInterval(() => {
      setPublicCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [publicConfirmOpen]);

  // Play retro audio notification when players join or leave the room
  const prevPlayerIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    const currentIds = room.players.map((p) => p.userId);
    if (prevPlayerIdsRef.current !== null) {
      const prevIds = prevPlayerIdsRef.current;
      const joined = currentIds.some((id) => !prevIds.includes(id));
      const left = prevIds.some((id) => !currentIds.includes(id));
      if (joined) {
        playPlayerJoinSound();
      } else if (left) {
        playPlayerLeaveSound();
      }
    }
    prevPlayerIdsRef.current = currentIds;
  }, [room.players]);

  useEffect(() => {
    if (prevSlugRef.current !== room.gameSlug) {
      const oldSlug = prevSlugRef.current;
      prevSlugRef.current = room.gameSlug;
      if (oldSlug) {
        setGameChangeNotice(
          `Switched game to ${game.name}. Confirm ready status to start.`,
        );
        const timer = setTimeout(() => setGameChangeNotice(null), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [room.gameSlug, game.name]);

  // When match is in progress, user can toggle between the game view and the room roster
  const [inGameViewActive, setInGameViewActive] = useState(true);
  const viewMode: "game" | "room" =
    room.status === "in_progress" && inGameViewActive ? "game" : "room";

  // Reset inGameViewActive to true whenever a match transitions to in_progress
  const [prevStatus, setPrevStatus] = useState(room.status);
  if (room.status !== prevStatus) {
    setPrevStatus(room.status);
    if (prevStatus === "lobby" && room.status === "in_progress") {
      setInGameViewActive(true);
    }
  }

  // Synchronize global layout: hide the top header when actively in game mode
  useEffect(() => {
    const isPlayingGame = room.status === "in_progress" && viewMode === "game";
    setInGameMode(isPlayingGame);
    return () => {
      setInGameMode(false);
    };
  }, [room.status, viewMode, setInGameMode]);

  const me = room.players.find((p) => p.userId === userId);
  const owner = room.players.find((p) => p.userId === room.ownerId);
  const isOwner = room.ownerId === userId;

  // Who becomes owner if the current owner stays offline (first joined player who is online).
  const successor = room.players.find(
    (p) => p.userId !== room.ownerId && p.connected,
  );
  const secondsLeft = useCountdown(room.ownerTransferAt, clockOffset);

  async function act(action: () => Promise<RoomSnapshot>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setActiveRoom(await action());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    try {
      await request("room:leave", {});
      setActiveRoom(null);
      void navigate(`/${room.gameSlug}`);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  function requestLeave() {
    setLeaveCountdown(3);
    setLeaveConfirmOpen(true);
  }

  async function copy(kind: "code" | "link") {
    try {
      let text = room.code;
      if (kind === "link") {
        setCopyingLink(true);
        const res = await request("room:get-invite-token", {});
        text = `${window.location.origin}${res.inviteUrl}`;
      }
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch (err) {
      setError(describeError(err) || "Could not copy.");
    } finally {
      setCopyingLink(false);
    }
  }

  async function handleChangeGame(newGameSlug: GameSlug) {
    if (busy || newGameSlug === room.gameSlug) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await request("room:change-game", {
        gameSlug: newGameSlug,
      });
      setActiveRoom(updated);
      setChangeGameOpen(false);
      void navigate(`/${newGameSlug}/room`, { replace: true });
    } catch (err) {
      const msg = describeError(err);
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setBusy(false);
    }
  }

  function handleSetVisibility(next: RoomVisibility) {
    if (busy || room.visibility === next) return;
    if (next === "public") {
      setPublicCountdown(3);
      setPublicConfirmOpen(true);
      return;
    }
    void act(() => request("room:set-visibility", { visibility: next }));
  }

  const emptySeats = Math.max(0, room.maxPlayers - room.players.length);
  const visibleEmptySeats = Math.min(emptySeats, 4);
  const extraEmptySeats = Math.max(0, emptySeats - visibleEmptySeats);

  return (
    <>
      {/*
        In-Game View:
        Kept mounted when match is active so socket subscriptions and state are preserved.
      */}
      {room.status === "in_progress" && (
        <div className={cn(viewMode === "game" ? "block" : "hidden")}>
          <InGameContainer
            room={room}
            userId={userId}
            game={game}
            secondsLeft={secondsLeft}
            owner={owner}
            successor={successor}
            onBackToRoom={() => setInGameViewActive(false)}
            onLeave={requestLeave}
            leaveBusy={busy}
          />
        </div>
      )}

      {/*
        Room / Players Section:
        Visible in lobby mode OR when user clicks the "Room" button during an active game.
      */}
      <div className={cn(viewMode === "room" ? "block" : "hidden")}>
        <section className="mx-auto w-full py-5 sm:py-8">
          {/* Active Match Banner when viewing roster mid-game */}
          {room.status === "in_progress" && (
            <div className="mb-6 pixel-corners-md bg-[#22e4ff]/40 p-[1.5px]">
              <div className="pixel-corners-sm bg-[#12131a] px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div>
                    <h2 className="font-retro text-xs sm:text-sm font-bold uppercase text-white">
                      {game.name} Match Live
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Game is running in the background. Jump back in anytime.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInGameViewActive(true)}
                  className="filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-none transition-all cursor-pointer inline-flex"
                >
                  <div className="pixel-corners-sm bg-black p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs font-bold uppercase tracking-wider px-4 py-2 flex items-center gap-1.5">
                      <Play className="size-3.5 fill-current" />
                      <span>Return to Match</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Clean Room Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="pixel-corners-sm bg-white/15 p-[1.5px] shrink-0">
                <div className="pixel-corners-sm size-13 sm:size-14 bg-[#12131a] overflow-hidden flex items-center justify-center">
                  <GameThumbnail
                    slug={game.slug}
                    name={game.name}
                    className="size-full object-cover"
                  />
                </div>
              </div>

              <div>
                <h1 className="font-retro text-lg sm:text-2xl font-bold uppercase tracking-wide text-white">
                  {game.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-400">
                  <span>
                    {game.minPlayers}–{game.maxPlayers} Players
                  </span>
                  <span className="text-white/20">•</span>
                  <span>{game.playTime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOwner && room.status === "lobby" && (
                <div
                  className={cn(
                    "pixel-corners-md bg-white/15 hover:bg-[#22e4ff]/40 p-[1.5px] transition-colors inline-flex",
                    busy && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setChangeGameOpen(true)}
                    disabled={busy}
                    className="pixel-corners-sm bg-[#161822] hover:bg-[#1e2130] text-gray-200 hover:text-[#22e4ff] font-retro text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-2 flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ArrowLeftRight className="size-3.5 text-[#22e4ff]" />
                    <span>Switch Game</span>
                  </button>
                </div>
              )}
              <div
                className={cn(
                  "pixel-corners-md bg-white/15 hover:bg-rose-500/40 p-[1.5px] transition-colors inline-flex",
                  busy && "opacity-40 cursor-not-allowed",
                )}
              >
                <button
                  type="button"
                  onClick={requestLeave}
                  disabled={busy}
                  className="pixel-corners-sm bg-[#161822] hover:bg-rose-500/15 text-gray-300 hover:text-rose-300 font-retro text-[10px] sm:text-xs font-bold uppercase tracking-wider px-3 py-2 flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <LogOut className="size-3.5" />
                  <span>Leave</span>
                </button>
              </div>
            </div>
          </div>

          {/* Contextual Alerts */}
          {gameChangeNotice && (
            <div className="mb-4 pixel-corners-sm bg-[#22e4ff]/35 p-[1px]">
              <div
                role="status"
                className="pixel-corners-sm bg-[#22e4ff]/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-[#22e4ff]"
              >
                <div className="flex items-center gap-2.5">
                  <Gamepad2 className="size-4 shrink-0" />
                  <span>{gameChangeNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGameChangeNotice(null)}
                  className="font-retro text-[10px] font-bold uppercase hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {secondsLeft !== null && owner && (
            <div className="mb-4 pixel-corners-sm bg-amber-400/35 p-[1px]">
              <div
                role="status"
                className="pixel-corners-sm bg-amber-400/10 px-4 py-3 text-xs text-amber-200"
              >
                Host ({owner.name}) is offline.
                {successor
                  ? ` ${successor.name} becomes host in ${secondsLeft}s.`
                  : " Waiting for host to reconnect."}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 pixel-corners-sm bg-rose-500/35 p-[1px]">
              <div
                role="alert"
                className="pixel-corners-sm bg-rose-500/10 px-4 py-3 text-xs text-rose-300"
              >
                {error}
              </div>
            </div>
          )}

          {/* Main Balanced Grid */}
          <div className="grid items-start gap-5 lg:grid-cols-[1fr_19.5rem]">
            {/* Left Column: Player Roster */}
            <div className="pixel-corners-md bg-white/12 p-[1.5px]">
              <div className="pixel-corners-sm bg-[#12131a] p-4 sm:p-5">
                <div className="mb-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-[#facc15]" />
                    <h2 className="font-retro text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                      Players
                    </h2>
                    <span className="pixel-corners-sm bg-white/15 p-[1px] inline-flex">
                      <span className="pixel-corners-sm bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-[#facc15]">
                        {room.players.length}/{room.maxPlayers}
                      </span>
                    </span>
                  </div>

                  {room.status === "lobby" && (
                    <span className="text-xs text-gray-500">
                      Min {game.minPlayers} required
                    </span>
                  )}
                </div>

                <ul className="space-y-2">
                  {room.players.map((p) => (
                    <PlayerRow
                      key={p.userId}
                      player={p}
                      room={room}
                      isMe={p.userId === userId}
                      canManage={isOwner}
                      disabled={busy}
                      onMakeOwner={() =>
                        void act(() =>
                          request("room:transfer-owner", {
                            userId: p.userId,
                          }),
                        )
                      }
                      onKick={() =>
                        void act(() =>
                          request("room:kick", { userId: p.userId }),
                        )
                      }
                    />
                  ))}

                  {Array.from({ length: visibleEmptySeats }, (_, i) => (
                    <li
                      key={`empty-${i}`}
                      className="pixel-corners-sm bg-white/[0.08] p-[1px] select-none"
                    >
                      <div className="pixel-corners-sm bg-[#0d0e14]/60 px-3.5 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="pixel-corners-sm bg-white/10 p-[1px]">
                            <div className="pixel-corners-sm size-10 bg-white/[0.02]" />
                          </div>
                          <span className="text-xs text-gray-500">
                            Open slot
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-gray-600">
                          #{room.players.length + i + 1}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {extraEmptySeats > 0 && (
                  <p className="mt-2.5 text-center text-xs text-gray-500">
                    +{extraEmptySeats} more open{" "}
                    {extraEmptySeats === 1 ? "slot" : "slots"}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Invite & Primary Match Controls */}
            <div className="space-y-4">
              {/* Primary Action Card */}
              <div className="pixel-corners-md bg-white/12 p-[1.5px]">
                <div className="pixel-corners-sm bg-[#12131a] p-4 sm:p-5 space-y-3.5">
                  {room.status === "in_progress" ? (
                    <>
                      <div className="flex items-center gap-2 font-retro text-xs font-bold uppercase text-emerald-400">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Match In Progress</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setInGameViewActive(true)}
                        className="w-full filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer"
                      >
                        <div className="pixel-corners-sm bg-black p-[2px]">
                          <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider py-3 px-4 flex items-center justify-center gap-2">
                            <Play className="size-4 fill-current" />
                            <span>Return to Game</span>
                          </div>
                        </div>
                      </button>
                    </>
                  ) : isOwner ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !room.start.canStart}
                        onClick={() =>
                          void act(() => request("room:start", {}))
                        }
                        className="w-full filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer disabled:opacity-45 disabled:drop-shadow-none disabled:cursor-not-allowed"
                      >
                        <div className="pixel-corners-sm bg-black p-[2px]">
                          <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider py-3.5 px-4 flex items-center justify-center gap-2">
                            <Play className="size-4 fill-current" />
                            <span>Start Game</span>
                          </div>
                        </div>
                      </button>

                      {!room.start.canStart && room.start.unmet.length > 0 && (
                        <ul className="space-y-1.5 pt-0.5 text-xs text-amber-200/85">
                          {room.start.unmet.map((u) => (
                            <li
                              key={u.code + u.message}
                              className="flex items-start gap-2"
                            >
                              <span className="mt-1.5 size-1 rounded-full bg-amber-400 shrink-0" />
                              <span>{u.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            request("room:set-ready", {
                              ready: !me?.isReady,
                            }),
                          )
                        }
                        className={cn(
                          "w-full transition-all cursor-pointer disabled:opacity-50",
                          me?.isReady
                            ? "filter drop-shadow-[0_4px_0_#064e3b] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#064e3b]"
                            : "filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f]",
                        )}
                      >
                        <div className="pixel-corners-sm bg-black p-[2px]">
                          <div
                            className={cn(
                              "pixel-corners-sm font-retro text-xs sm:text-sm font-bold uppercase tracking-wider py-3.5 px-4 flex items-center justify-center gap-2",
                              me?.isReady
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-[#facc15] hover:bg-[#fbbf24] text-black",
                            )}
                          >
                            {me?.isReady ? (
                              <>
                                <UserCheck className="size-4" />
                                <span>Ready</span>
                              </>
                            ) : (
                              <>
                                <Check className="size-4" />
                                <span>Ready Up</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <p className="text-center text-xs text-gray-400">
                        Waiting for{" "}
                        <span className="text-gray-200 font-medium">
                          {owner?.name ?? "host"}
                        </span>{" "}
                        to start
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Room Invite & Visibility Card */}
              <div className="pixel-corners-md bg-white/12 p-[1.5px]">
                <div className="pixel-corners-sm bg-[#12131a] p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="font-retro text-xs font-bold uppercase tracking-wider text-gray-300">
                      Invite Players
                    </span>

                    {!(isOwner && room.status === "lobby") && (
                      <span
                        className={cn(
                          "pixel-corners-sm p-[1px] inline-flex",
                          room.visibility === "public"
                            ? "bg-emerald-500/35"
                            : "bg-white/15",
                        )}
                      >
                        <span
                          className={cn(
                            "pixel-corners-sm px-2 py-0.5 font-retro text-[9px] uppercase tracking-wider inline-flex items-center gap-1",
                            room.visibility === "public"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/[0.05] text-gray-300",
                          )}
                        >
                          {room.visibility === "public" ? (
                            <Globe className="size-2.5 text-emerald-400" />
                          ) : (
                            <Lock className="size-2.5 text-gray-400" />
                          )}
                          <span>{room.visibility}</span>
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Host Visibility Segmented Toggle */}
                  {isOwner && room.status === "lobby" && (
                    <div
                      role="group"
                      aria-label="Room visibility"
                      className="pixel-corners-sm bg-white/10 p-[1px]"
                    >
                      <div className="grid grid-cols-2 gap-1 pixel-corners-sm bg-[#0a0b10] p-1">
                        <div
                          className={cn(
                            "pixel-corners-sm p-[1px] transition-colors",
                            room.visibility === "public"
                              ? "bg-emerald-500/40"
                              : "bg-transparent",
                          )}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSetVisibility("public")}
                            className={cn(
                              "w-full pixel-corners-sm py-1.5 px-2 font-retro text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50",
                              room.visibility === "public"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "text-gray-400 hover:text-gray-200",
                            )}
                          >
                            <Globe className="size-3" />
                            <span>Public</span>
                          </button>
                        </div>

                        <div
                          className={cn(
                            "pixel-corners-sm p-[1px] transition-colors",
                            room.visibility === "private"
                              ? "bg-white/20"
                              : "bg-transparent",
                          )}
                        >
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleSetVisibility("private")}
                            className={cn(
                              "w-full pixel-corners-sm py-1.5 px-2 font-retro text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50",
                              room.visibility === "private"
                                ? "bg-white/12 text-white"
                                : "text-gray-400 hover:text-gray-200",
                            )}
                          >
                            <Lock className="size-3" />
                            <span>Private</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recessed Room Code + Inline Copy */}
                  <div className="pixel-corners-sm bg-white/10 p-[1px]">
                    <div className="pixel-corners-sm bg-[#0a0b10] pl-3.5 pr-2 py-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xl sm:text-2xl font-bold tracking-[0.22em] text-[#facc15] select-all">
                        {room.code}
                      </span>

                      <div className="pixel-corners-sm bg-white/10 hover:bg-white/20 p-[1px] transition-colors shrink-0">
                        <button
                          type="button"
                          onClick={() => void copy("code")}
                          className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] px-2.5 py-1.5 font-retro text-[10px] font-bold uppercase tracking-wider text-gray-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          {copied === "code" ? (
                            <>
                              <Check className="size-3 text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 text-[#facc15]" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Share Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={cn(
                        "pixel-corners-sm bg-white/10 hover:bg-white/20 p-[1px] transition-colors",
                        copyingLink && "opacity-50",
                      )}
                    >
                      <button
                        type="button"
                        disabled={copyingLink}
                        onClick={() => void copy("link")}
                        className="w-full pixel-corners-sm bg-[#171822] hover:bg-[#202230] text-gray-200 hover:text-white font-retro text-[10px] font-bold uppercase tracking-wider py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {copyingLink ? (
                          <Loader2 className="size-3.5 animate-spin text-[#facc15]" />
                        ) : copied === "link" ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : (
                          <LinkIcon className="size-3.5 text-[#facc15]" />
                        )}
                        <span>
                          {copied === "link" ? "Copied" : "Copy Link"}
                        </span>
                      </button>
                    </div>

                    <div className="pixel-corners-sm bg-white/10 hover:bg-white/20 p-[1px] transition-colors">
                      <button
                        type="button"
                        onClick={() => setInviteDialogOpen(true)}
                        className="w-full pixel-corners-sm bg-[#171822] hover:bg-[#202230] text-gray-200 hover:text-white font-retro text-[10px] font-bold uppercase tracking-wider py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserPlus className="size-3.5 text-[#facc15]" />
                        <span>Invite ID</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isOwner && room.status === "lobby" && (
        <ChangeGameDialog
          open={changeGameOpen}
          onOpenChange={setChangeGameOpen}
          currentSlug={room.gameSlug}
          playerCount={room.players.length}
          onSelectGame={handleChangeGame}
          disabled={busy}
        />
      )}

      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />

      {/* Leave Room Confirmation Dialog */}
      <Dialog open={leaveConfirmOpen} onOpenChange={handleLeaveOpenChange}>
        <DialogContent className="max-w-md border-rose-500">
          <DialogCloseButton onClick={() => setLeaveConfirmOpen(false)} />

          <div className="flex items-center gap-3 pr-6">
            <div className="pixel-corners-sm bg-rose-500/30 p-[1.5px] shrink-0">
              <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-rose-400">
                <LogOut className="size-5" />
              </div>
            </div>
            <div>
              <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                {room.status === "in_progress" ? "Leave Match?" : "Leave Room?"}
              </DialogTitle>
              <p className="text-xs text-rose-400 font-medium">
                {room.status === "in_progress"
                  ? "Active match in progress"
                  : "Exiting the room will forfeit your seat"}
              </p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-sm leading-relaxed text-gray-300">
            {room.status === "in_progress" ? (
              <>
                Leaving the room now will{" "}
                <strong className="font-semibold text-white">
                  permanently remove your game pieces and match progress
                </strong>
                .
              </>
            ) : (
              <>
                Are you sure you want to leave this room? You will exit back to
                the game page and forfeit your seat.
              </>
            )}
          </DialogDescription>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <div
              className={cn(
                "pixel-corners-sm bg-white/10 hover:bg-white/20 p-[1px] transition-colors",
                busy && "opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(false)}
                disabled={busy}
                className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-300 hover:text-white font-retro text-xs font-bold uppercase tracking-wider px-4 h-9 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>

            <button
              type="button"
              disabled={busy || leaveCountdown > 0}
              onClick={() => {
                setLeaveConfirmOpen(false);
                void leave();
              }}
              className={cn(
                "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                leaveCountdown === 0
                  ? "filter drop-shadow-[0_3px_0_#881337] active:translate-y-0.5 active:drop-shadow-none"
                  : "filter drop-shadow-none",
              )}
            >
              <div className="pixel-corners-sm bg-black p-[1.5px]">
                <div
                  className={cn(
                    "pixel-corners-sm font-retro text-xs font-bold uppercase tracking-wider h-9 px-4 flex items-center justify-center gap-1.5 transition-colors",
                    leaveCountdown === 0
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-[#181922] text-gray-400",
                  )}
                >
                  <LogOut className="size-3.5" />
                  <span>
                    {leaveCountdown > 0
                      ? `${room.status === "in_progress" ? "Leave Match" : "Leave Room"} (${leaveCountdown}s)`
                      : room.status === "in_progress"
                        ? "Leave Match"
                        : "Leave Room"}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Make Room Public Confirmation Dialog */}
      <Dialog open={publicConfirmOpen} onOpenChange={handlePublicOpenChange}>
        <DialogContent className="max-w-md">
          <DialogCloseButton onClick={() => setPublicConfirmOpen(false)} />

          <div className="flex items-center gap-3 pr-6">
            <div className="pixel-corners-sm bg-emerald-500/30 p-[1.5px] shrink-0">
              <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-emerald-400">
                <Globe className="size-5" />
              </div>
            </div>
            <div>
              <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                Make Room Public?
              </DialogTitle>
              <p className="text-xs text-emerald-400 font-medium">
                Public Matchmaking Visibility
              </p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-sm leading-relaxed text-gray-300">
            Switching this room to{" "}
            <strong className="font-semibold text-white">Public</strong> allows
            anyone browsing the games lobby to discover and freely join your
            match without requiring an invite link or room code.
          </DialogDescription>

          <div className="mt-4 pixel-corners-sm bg-emerald-500/20 p-[1px]">
            <div className="pixel-corners-sm bg-[#0a0b10] p-3 text-xs text-gray-300 flex items-start gap-2.5">
              <Users className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Open player slots will become available for matchmaking
                immediately.
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <div className="pixel-corners-sm bg-white/10 hover:bg-white/20 p-[1px] transition-colors">
              <button
                type="button"
                onClick={() => setPublicConfirmOpen(false)}
                className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-300 hover:text-white font-retro text-xs font-bold uppercase tracking-wider px-4 h-9 flex items-center justify-center transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <button
              type="button"
              disabled={busy || publicCountdown > 0}
              onClick={() => {
                setPublicConfirmOpen(false);
                void act(() =>
                  request("room:set-visibility", { visibility: "public" }),
                );
              }}
              className={cn(
                "transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                publicCountdown === 0
                  ? "filter drop-shadow-[0_3px_0_#064e3b] active:translate-y-0.5 active:drop-shadow-none"
                  : "filter drop-shadow-none",
              )}
            >
              <div className="pixel-corners-sm bg-black p-[1.5px]">
                <div
                  className={cn(
                    "pixel-corners-sm font-retro text-xs font-bold uppercase tracking-wider h-9 px-4 flex items-center justify-center gap-1.5 transition-colors",
                    publicCountdown === 0
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-[#181922] text-gray-400",
                  )}
                >
                  <Globe className="size-3.5" />
                  <span>
                    {publicCountdown > 0
                      ? `Make Public (${publicCountdown}s)`
                      : "Make Public"}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
