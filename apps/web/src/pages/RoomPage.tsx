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
  Plus,
  Play,
  QrCode,
  UserPlus,
  Users,
  UserX,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useNavigate, useParams } from "react-router";
import { ChangeGameDialog } from "@/components/games/ChangeGameDialog";
import { GameErrorBoundary } from "@/components/games/GameErrorBoundary";
import { GameLaunchScreen } from "@/components/games/GameLaunchScreen";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { findEnabledGame } from "@/config/games";
import { gameComponents } from "@/games/registry";
import { TruthAndDareRoomSetup } from "@/games/truth-and-dare/room-setup";
import { useCountdown } from "@/hooks/useCountdown";
import { updateAudioSettings, useAudioSettings } from "@/lib/audio-settings";
import { authClient } from "@/lib/auth-client";
import { describeError, request } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useGameLayout } from "@/providers/game-layout-context";
import { useRealtime } from "@/providers/realtime-context";
import roomStyles from "./room-retro.module.css";
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

/** Professional loading state while room membership is established */
function RoomJoiningLoader({ gameSlug }: { gameSlug: GameSlug }) {
  const game = getGameDefinition(gameSlug);
  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-full rounded-3xl border border-white/10 bg-panel/85 p-8 backdrop-blur-2xl shadow-2xl">
        <div className="relative mx-auto size-16 overflow-hidden rounded-2xl border border-neon-cyan/40 p-2 shadow-[0_0_20px_rgba(34,228,255,0.25)]">
          <GameThumbnail
            slug={gameSlug}
            name={game.name}
            className="size-full object-cover rounded-xl"
          />
        </div>
        <h2 className="mt-4 font-display text-2xl uppercase tracking-wider text-foreground">
          Connecting to {game.name}
        </h2>
        <p className="mt-1 font-mono text-sm tracking-widest text-muted-foreground">
          SYNCING ROOM SESSION...
        </p>
        <div className="mt-6 flex flex-col items-center gap-2.5">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
            <div className="load-bar h-full w-full rounded-full bg-linear-to-r from-neon-cyan to-neon-pink" />
          </div>
          <span className="animate-pulse text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Entering Room...
          </span>
        </div>
        <div className="mt-6">
          <Link
            to={`/${gameSlug}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="size-3.5" /> Return to Lobby
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
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-3 py-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-violet-500/20 text-sm font-semibold overflow-hidden",
          !player.connected && "opacity-50",
        )}
        aria-hidden="true"
      >
        {player.image ? (
          <img src={player.image} alt="" className="size-full object-cover" />
        ) : (
          player.name.charAt(0).toUpperCase()
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          <span className="truncate">{player.name}</span>
          {isMe && (
            <span className="text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
          {isOwner && (
            <Crown
              className="size-4 shrink-0 text-amber-300"
              aria-label="Room owner"
            />
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {!player.connected ? (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <WifiOff className="size-3" /> Offline
            </span>
          ) : isOwner ? (
            "Owner"
          ) : inLobby ? (
            player.isReady ? (
              <span className="text-emerald-300">Ready</span>
            ) : (
              "Not ready"
            )
          ) : (
            "Playing"
          )}
          {player.isAnonymous ? " (guest)" : ""}
        </p>
      </div>
      {canManage && !isMe && (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Make owner"
            aria-label={`Make ${player.name} the owner`}
            disabled={disabled}
            onClick={onMakeOwner}
          >
            <Crown />
          </Button>
          {inLobby && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remove from room"
              aria-label={`Remove ${player.name}`}
              disabled={disabled}
              onClick={onKick}
            >
              <UserX />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Premade In-Game Shell:
 * Replaces the top header with a sleek in-game bar featuring a Back button to the room roster.
 * Pre-configured for all games by default so individual games don't need to rebuild it.
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

  // Polished launch transition so players see the match briefing before the game board renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLaunching(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full py-1 sm:py-2">
      {/* Dedicated In-Game Top Bar: Back button to room section, match info, audio toggle */}
      <header className="sticky top-2 z-30 mb-2 mx-auto flex w-full max-w-[2000px] items-center justify-between gap-2 rounded-2xl border border-white/10 bg-panel/90 px-3 py-2.5 backdrop-blur-xl shadow-xl shadow-black/40">
        {/* Back Button leading to the Room section where all players are displayed */}
        <Button
          variant="outline"
          size="sm"
          onClick={onBackToRoom}
          className="h-9 gap-2 rounded-xl border-white/15 bg-white/5 hover:border-primary/60 hover:bg-white/10 text-foreground transition-all active:scale-95 shadow-sm"
          aria-label="View room players and settings"
        >
          <ArrowLeft className="size-4" />
          <span className="font-medium text-xs sm:text-sm">Room</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            <Users className="size-3 text-neon-pink" />
            {room.players.length}
          </span>
        </Button>

        {/* Center: Game & Room Identifier */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 font-display text-sm uppercase tracking-wide text-foreground">
            <Gamepad2 className="size-4 text-neon-cyan" />
            {game.name}
          </span>
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-muted-foreground">
            {room.code}
          </span>
        </div>

        {/* Right: Audio Control & Leave Room */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-xl border-white/10 bg-white/5 hover:border-primary/60 hover:text-primary"
            aria-label={audio.muted ? "Unmute game audio" : "Mute game audio"}
            onClick={() => updateAudioSettings({ muted: !audio.muted })}
          >
            {audio.muted ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Leave room"
            title="Leave room"
            onClick={onLeave}
            disabled={leaveBusy}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      {/* Offline Host Countdown Alert */}
      {secondsLeft !== null && owner && (
        <div className="mx-auto mb-4 max-w-5xl px-2">
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-xs sm:text-sm text-amber-200 backdrop-blur-md"
          >
            <span>
              The owner (<strong>{owner.name}</strong>) is offline.
              {successor
                ? ` ${successor.name} becomes owner in ${secondsLeft}s.`
                : " Waiting for host to reconnect."}
            </span>
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
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [inviteQrUrl, setInviteQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [changeGameOpen, setChangeGameOpen] = useState(false);
  const [gameChangeNotice, setGameChangeNotice] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const prevSlugRef = useRef(room.gameSlug);

  useEffect(() => {
    if (prevSlugRef.current !== room.gameSlug) {
      const oldSlug = prevSlugRef.current;
      prevSlugRef.current = room.gameSlug;
      if (oldSlug) {
        setGameChangeNotice(
          `Room game switched to ${game.name}! Please confirm you are ready.`,
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
    if (room.status === "in_progress") {
      setLeaveConfirmOpen(true);
    } else {
      void leave();
    }
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

  async function showInviteQr() {
    if (qrLoading) return;
    setQrLoading(true);
    setError(null);
    try {
      const result = await request("room:get-invite-token", {});
      setInviteQrUrl(`${window.location.origin}${result.inviteUrl}`);
      setQrDialogOpen(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setQrLoading(false);
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

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="relative size-14 overflow-hidden rounded-2xl border border-white/10 shrink-0 shadow-lg">
          <GameThumbnail
            slug={game.slug}
            name={game.name}
            className="size-full object-cover"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              {game.name}
            </h1>
            {isOwner && room.status === "lobby" && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 hover:border-neon-cyan text-xs font-semibold shadow-[0_0_12px_rgba(34,228,255,0.15)] transition-all"
                onClick={() => setChangeGameOpen(true)}
                disabled={busy}
              >
                <ArrowLeftRight className="size-3.5" />
                <span>Change Game</span>
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
            <span>Room {room.code}</span>
            <span>·</span>
            <span className="capitalize">{room.visibility}</span>
            <span>·</span>
            <span>
              {game.minPlayers}–{game.maxPlayers} players
            </span>
            <span>·</span>
            <span>{game.playTime}</span>
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={requestLeave} disabled={busy}>
        <LogOut /> Leave room
      </Button>
    </div>
  );

  const emptySeats = Math.max(0, room.maxPlayers - room.players.length);
  const localInviteOrigin =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  return (
    <>
      {/* 
        In-Game View:
        Kept mounted when match is active so socket subscriptions and state are preserved.
        Hidden when player presses "Room & Players" back button.
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
        Visible in lobby mode OR when user clicks the "Room & Players" back button during an active game.
      */}
      <div className={cn(viewMode === "room" ? "block" : "hidden")}>
        <section
          className={cn(
            "py-6",
            room.gameSlug === "truth-and-dare" && roomStyles.roomSkin,
          )}
        >
          {/* Active Game Notice Banner when toggling to Room view while game is in progress */}
          {room.status === "in_progress" && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-neon-cyan/40 bg-panel/90 p-4 sm:p-5 backdrop-blur-xl shadow-xl shadow-neon-cyan/5">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-neon-cyan/15 text-neon-cyan shadow-[0_0_16px_rgba(34,228,255,0.2)]">
                  <Gamepad2 className="size-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <h2 className="font-display text-lg sm:text-xl uppercase tracking-wide text-foreground">
                      {game.name} Match Active
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Match #{room.matchId?.slice(0, 8) ?? room.code} is currently
                    in progress.
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => setInGameViewActive(true)}
                className="gap-2 rounded-2xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all"
              >
                <Play className="size-4 fill-current" />
                <span>Return to Game</span>
              </Button>
            </div>
          )}

          {header}

          {room.status === "lobby" && room.gameSlug === "truth-and-dare" && (
            <TruthAndDareRoomSetup />
          )}

          {gameChangeNotice && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan backdrop-blur-md"
            >
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="size-4 shrink-0" />
                <span>{gameChangeNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setGameChangeNotice(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {secondsLeft !== null && owner && (
            <p
              role="status"
              className="mb-4 rounded-2xl bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200"
            >
              The owner ({owner.name}) is offline.
              {successor
                ? ` ${successor.name} becomes owner in ${secondsLeft}s.`
                : " Waiting for them to come back."}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            {/* Players Roster */}
            {room.gameSlug === "truth-and-dare" ? (
              <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">
                      Players ({room.players.length}/{room.maxPlayers})
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {room.status === "lobby"
                        ? `${emptySeats} open ${emptySeats === 1 ? "seat" : "seats"} · Share the code or QR to invite friends.`
                        : `${room.players.length} players at this table.`}
                    </p>
                  </div>
                </div>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-x-3 gap-y-4 sm:grid-cols-[repeat(auto-fill,minmax(124px,1fr))]">
                  {room.players.map((player) => {
                    const isMe = player.userId === userId;
                    const isPlayerOwner = player.userId === room.ownerId;
                    return (
                      <li key={player.userId} className="min-w-0">
                        <div
                          className={cn(
                            "relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-[26px] border bg-background/40 px-2 py-4 text-center transition-colors",
                            player.connected
                              ? "border-white/12 hover:border-fuchsia-300/40"
                              : "border-white/8 opacity-65",
                          )}
                        >
                          {isPlayerOwner && (
                            <Crown
                              className="absolute right-2 top-2 size-4 text-amber-300"
                              aria-label="Room owner"
                            />
                          )}
                          <span
                            className={cn(
                              "grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-violet-500/20 text-xl font-bold text-white shadow-[0_0_20px_rgba(167,115,255,0.2)]",
                              player.connected
                                ? "border-fuchsia-300/50"
                                : "border-white/15",
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
                          </span>
                          <span className="max-w-full truncate text-sm font-semibold text-foreground">
                            {player.name}
                          </span>
                          {isMe && (
                            <span className="-mt-1 text-[11px] text-muted-foreground">
                              You
                            </span>
                          )}
                          {!player.connected && (
                            <span className="-mt-1 text-[11px] text-amber-200">
                              Offline
                            </span>
                          )}
                          {isOwner && !isMe && (
                            <div className="mt-auto flex gap-1 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Make owner"
                                aria-label={`Make ${player.name} the owner`}
                                disabled={busy}
                                onClick={() =>
                                  void act(() =>
                                    request("room:transfer-owner", {
                                      userId: player.userId,
                                    }),
                                  )
                                }
                              >
                                <Crown />
                              </Button>
                              {room.status === "lobby" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Remove from room"
                                  aria-label={`Remove ${player.name}`}
                                  disabled={busy}
                                  onClick={() =>
                                    void act(() =>
                                      request("room:kick", {
                                        userId: player.userId,
                                      }),
                                    )
                                  }
                                >
                                  <UserX />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {room.status === "lobby" && emptySeats > 0 && (
                    <li className="min-w-0">
                      <button
                        type="button"
                        className="group flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-fuchsia-200/30 bg-fuchsia-300/[0.035] px-2 py-4 text-center text-muted-foreground transition hover:border-fuchsia-200/70 hover:bg-fuchsia-300/[0.08] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-200"
                        onClick={() => setInviteDialogOpen(true)}
                        aria-label="Invite another player"
                      >
                        <span className="grid size-16 place-items-center rounded-full border border-dashed border-fuchsia-200/40 bg-fuchsia-300/[0.08] text-fuchsia-100 transition group-hover:scale-105">
                          <Plus className="size-7" />
                        </span>
                        <span className="text-sm font-semibold">Add player</span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
                <h2 className="mb-3 font-semibold">
                  Players ({room.players.length}/{room.maxPlayers})
                </h2>
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
                          request("room:transfer-owner", { userId: p.userId }),
                        )
                      }
                      onKick={() =>
                        void act(() => request("room:kick", { userId: p.userId }))
                      }
                    />
                  ))}
                  {Array.from({ length: emptySeats }, (_, i) => (
                    <li
                      key={`empty-${i}`}
                      className="rounded-2xl border border-dashed border-white/10 px-3 py-3 text-sm text-muted-foreground"
                    >
                      Waiting for a player...
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Room Details & Actions */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
                <p className="text-sm text-muted-foreground">Room code</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-3xl font-bold tracking-[0.25em]">
                    {room.code}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      room.visibility === "public"
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-white/5 text-muted-foreground",
                    )}
                  >
                    {room.visibility === "public" ? (
                      <Globe className="size-3" />
                    ) : (
                      <Lock className="size-3" />
                    )}
                    {room.visibility === "public" ? "Public" : "Private"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copy("code")}
                  >
                    {copied === "code" ? <Check /> : <Copy />}{" "}
                    {copied === "code" ? "Copied" : "Copy code"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={copyingLink}
                    onClick={() => void copy("link")}
                  >
                    {copyingLink ? (
                      <Loader2 className="animate-spin" />
                    ) : copied === "link" ? (
                      <Check />
                    ) : (
                      <LinkIcon />
                    )}{" "}
                    {copied === "link" ? "Copied" : "Copy invite link"}
                  </Button>
                  {room.status === "lobby" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={qrLoading}
                      onClick={() => void showInviteQr()}
                    >
                      {qrLoading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <QrCode />
                      )}
                      Show QR
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInviteDialogOpen(true)}
                  >
                    <UserPlus className="size-3.5" /> Invite with ID
                  </Button>
                </div>
                {isOwner && room.status === "lobby" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => {
                      const next: RoomVisibility =
                        room.visibility === "public" ? "private" : "public";
                      void act(() =>
                        request("room:set-visibility", { visibility: next }),
                      );
                    }}
                  >
                    {room.visibility === "public"
                      ? "Make private"
                      : "Make public"}
                  </Button>
                )}
              </div>

              {/* Match / Lobby Controls */}
              <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
                {room.status === "in_progress" ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Match In Progress</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      The match is currently running. Switch back to the board
                      anytime.
                    </p>
                    <Button
                      size="lg"
                      className="h-12 w-full text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setInGameViewActive(true)}
                    >
                      <Play className="size-4 fill-current" /> Return to game
                    </Button>
                  </>
                ) : isOwner ? (
                  <>
                    <Button
                      size="lg"
                      className="h-12 w-full text-base"
                      disabled={busy || !room.start.canStart}
                      onClick={() => void act(() => request("room:start", {}))}
                    >
                      <Play /> Start game
                    </Button>
                    {!room.start.canStart && (
                      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {room.start.unmet.map((u) => (
                          <li key={u.code + u.message}>{u.message}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant={me?.isReady ? "secondary" : "default"}
                      className="h-12 w-full text-base"
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          request("room:set-ready", { ready: !me?.isReady }),
                        )
                      }
                    >
                      {me?.isReady ? "Not ready" : "I am ready"}
                    </Button>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Waiting for {owner?.name ?? "the owner"} to start the
                      game.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
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

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm border-fuchsia-300/20 bg-card text-card-foreground">
          <div className="text-center">
            <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-100">
              <QrCode className="size-5" />
            </div>
            <DialogTitle className="text-xl font-bold">
              Scan to join the party
            </DialogTitle>
            <DialogDescription className="mt-1">
              Open the invite link on another device, or share this room code.
            </DialogDescription>
          </div>
          {inviteQrUrl && (
            <div className="mx-auto mt-2 rounded-2xl bg-white p-3 shadow-[0_10px_32px_rgba(0,0,0,0.25)]">
              <QRCodeSVG
                value={inviteQrUrl}
                size={216}
                level="H"
                title={`Invite QR code for room ${room.code}`}
              />
            </div>
          )}
          {localInviteOrigin ? (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Local testing: open Kridora with your computer’s network address
              for friends to scan this QR. Room code <strong className="font-bold tracking-[0.2em] text-foreground">{room.code}</strong> also works.
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Room code <strong className="ml-1 font-bold tracking-[0.2em] text-foreground">{room.code}</strong>
            </p>
          )}
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy("code")}
            >
              {copied === "code" ? <Check /> : <Copy />}
              {copied === "code" ? "Copied" : "Copy code"}
            </Button>
            <Button type="button" onClick={() => setQrDialogOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveConfirmOpen} onOpenChange={setLeaveConfirmOpen}>
        <DialogContent className="max-w-md border-rose-500">
          <DialogCloseButton onClick={() => setLeaveConfirmOpen(false)} />

          <div className="flex items-center gap-3 pr-6">
            <div className="pixel-corners-sm bg-rose-500 p-[2px] shrink-0 filter drop-shadow-[0_2px_0_#881337]">
              <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-rose-400">
                <LogOut className="size-5" />
              </div>
            </div>
            <div>
              <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                Leave Match & Room?
              </DialogTitle>
              <p className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
                Match in progress
              </p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-sm leading-relaxed text-gray-300">
            If you intentionally leave the room now,{" "}
            <strong className="font-bold text-white">
              all your game pieces and match progress will be permanently
              removed
            </strong>
            .
          </DialogDescription>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeaveConfirmOpen(false)}
              disabled={busy}
              className="pixel-corners-sm"
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => {
                setLeaveConfirmOpen(false);
                void leave();
              }}
              disabled={busy}
              className="filter drop-shadow-[0_4px_0_#881337] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#881337] transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="pixel-corners-sm bg-black p-[2px]">
                <div className="pixel-corners-sm bg-rose-600 hover:bg-rose-500 text-white font-retro text-xs font-bold uppercase tracking-wider h-9 px-4 flex items-center justify-center">
                  Leave Match
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
