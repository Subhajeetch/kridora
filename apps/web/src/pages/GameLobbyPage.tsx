import {
  getGameDefinition,
  type GameSlug,
  type RoomSnapshot,
} from "@kridora/shared";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DoorOpen,
  Hash,
  Plus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AuthDialog } from "@/components/AuthDialog";
import { JoinRoomDialog } from "@/components/JoinRoomDialog";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { findEnabledGame } from "@/config/games";
import { authClient } from "@/lib/auth-client";
import { getGameThumbnailSrc } from "@/lib/game-art";
import {
  describeError,
  request,
  RequestError,
  waitForSocketConnected,
} from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/providers/realtime-context";
import NotFoundPage from "./NotFoundPage";

export default function GameLobbyPage() {
  const { slug } = useParams();
  const gameSlug = findEnabledGame(slug);
  if (!gameSlug) return <NotFoundPage />;
  return <GameEntrance key={gameSlug} slug={gameSlug} />;
}

function GameEntrance({ slug }: { slug: GameSlug }) {
  const game = getGameDefinition(slug);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCode = searchParams.get("room") || searchParams.get("join") || "";

  const { data: session } = authClient.useSession();
  const { connection, activeRoom, setActiveRoom } = useRealtime();

  const [busy, setBusy] = useState<"create" | "public" | null>(null);
  const [error, setError] = useState<RequestError | Error | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "create" | "public" | null
  >(null);

  const [userOpenedJoin, setUserOpenedJoin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const screenshots = game.screenshots ?? [];
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const previewShot =
    previewIndex !== null ? (screenshots[previewIndex] ?? null) : null;

  useEffect(() => {
    if (previewIndex === null) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (screenshots.length > 1 && e.key === "ArrowRight") {
        setPreviewIndex((i) =>
          i !== null ? (i + 1) % screenshots.length : null,
        );
      }
      if (screenshots.length > 1 && e.key === "ArrowLeft") {
        setPreviewIndex((i) =>
          i !== null ? (i - 1 + screenshots.length) % screenshots.length : null,
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewIndex, screenshots.length]);

  const joinOpen = Boolean(queryCode) || userOpenedJoin;
  const initialJoinCode = queryCode || "";

  const connected = connection === "connected";
  const existingRoom =
    error instanceof RequestError && error.code === "ALREADY_IN_ROOM"
      ? error
      : null;
  const existingCode =
    typeof existingRoom?.details?.roomCode === "string"
      ? existingRoom.details.roomCode
      : null;
  const existingSlug =
    typeof existingRoom?.details?.gameSlug === "string"
      ? existingRoom.details.gameSlug
      : slug;

  async function enter(
    kind: "create" | "public",
    action: () => Promise<RoomSnapshot>,
  ) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      const room = await action();
      setActiveRoom(room);
      void navigate(`/${room.gameSlug}/room`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(describeError(err)));
    } finally {
      setBusy(null);
    }
  }

  function handleCreateRoom() {
    if (!session) {
      setPendingAction("create");
      setAuthOpen(true);
      return;
    }
    void enter("create", async () => {
      await waitForSocketConnected();
      return request("room:create", { gameSlug: slug, visibility: "private" });
    });
  }

  function handleJoinPublic() {
    if (!session) {
      setPendingAction("public");
      setAuthOpen(true);
      return;
    }
    void enter("public", async () => {
      await waitForSocketConnected();
      return request("room:join-public", { gameSlug: slug });
    });
  }

  function handleAuthSuccess() {
    const action = pendingAction;
    setPendingAction(null);
    if (action === "create") {
      void enter("create", async () => {
        await waitForSocketConnected();
        return request("room:create", {
          gameSlug: slug,
          visibility: "private",
        });
      });
    } else if (action === "public") {
      void enter("public", async () => {
        await waitForSocketConnected();
        return request("room:join-public", { gameSlug: slug });
      });
    }
  }

  async function leaveCurrentRoom() {
    try {
      await request("room:leave", {});
      setActiveRoom(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(describeError(err)));
    }
  }

  async function handleCopyInvite() {
    try {
      const res = await request("room:get-invite-token", {});
      const url = `${window.location.origin}${res.inviteUrl}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }

  function handleJoinOpenChange(open: boolean) {
    if (!open) {
      setUserOpenedJoin(false);
      if (
        (searchParams.has("room") || searchParams.has("join")) &&
        window.location.pathname.endsWith(`/${slug}`)
      ) {
        const next = new URLSearchParams(searchParams);
        next.delete("room");
        next.delete("join");
        setSearchParams(next, { replace: true });
      }
    } else {
      setUserOpenedJoin(true);
    }
  }

  const actionsDisabled = busy !== null || (session ? !connected : false);

  return (
    <section className="w-full pt-3 sm:pt-6 pb-20 space-y-10 sm:space-y-12">
      {/* Back navigation */}
      <div>
        <Link
          to="/games"
          className="inline-flex items-center gap-2 font-retro text-[11px] uppercase tracking-wider text-gray-400 hover:text-[#facc15] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>All Games</span>
        </Link>
      </div>

      {/* Hero: Game Logo + Name + Basic Details + Actions */}
      <div className="space-y-7">
        <div className="flex items-start sm:items-center gap-4 sm:gap-6">
          <div className="pixel-corners-sm bg-white/15 p-[1.5px] shrink-0">
            <div className="pixel-corners-sm size-16 sm:size-20 bg-[#12131a] overflow-hidden flex items-center justify-center">
              {!logoError ? (
                <img
                  src={getGameThumbnailSrc(slug)}
                  alt={game.name}
                  onError={() => setLogoError(true)}
                  className="size-full object-cover"
                />
              ) : (
                <span className="font-retro text-lg font-bold text-[#facc15] uppercase">
                  {game.name.slice(0, 2)}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <h1 className="font-retro text-2xl sm:text-4xl font-bold uppercase tracking-tight text-white">
              {game.name}
            </h1>

            <p className="max-w-2xl text-sm sm:text-base text-gray-400 leading-relaxed">
              {game.tagline}
            </p>

            <div className="pt-0.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-gray-300">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5 text-[#facc15]" />
                {game.minPlayers}–{game.maxPlayers} Players
              </span>

              <span className="text-white/20">•</span>

              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#facc15]" />
                {game.playTime}
              </span>

              {game.difficulty && (
                <>
                  <span className="text-white/20">•</span>
                  <span>{game.difficulty}</span>
                </>
              )}

              {game.genre?.[0] && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-gray-400">{game.genre[0]}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Active Room Banner */}
        {activeRoom && activeRoom.gameSlug === slug && (
          <div className="pixel-corners-sm bg-[#facc15]/40 p-[1.5px]">
            <div className="pixel-corners-sm bg-[#12131a] px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-200">
                Active room{" "}
                <strong className="font-mono text-base font-bold tracking-widest text-[#facc15] ml-1">
                  {activeRoom.code}
                </strong>
                <span className="text-gray-400 ml-2 text-xs">
                  ({activeRoom.players.length}/{activeRoom.maxPlayers} players)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void navigate(`/${slug}/room`)}
                  className="filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer inline-flex"
                >
                  <div className="pixel-corners-sm bg-black p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 flex items-center gap-1.5">
                      <DoorOpen className="size-3.5" />
                      <span>Return to Room</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyInvite()}
                  className="active:translate-y-0.5 transition-all cursor-pointer inline-flex"
                >
                  <div className="pixel-corners-sm bg-white/15 p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-200 font-retro text-[11px] font-bold uppercase tracking-wider px-3.5 py-2 flex items-center gap-1.5">
                      {copiedLink ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span>{copiedLink ? "Copied" : "Copy Invite"}</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conflict Alert: Already in another game's room */}
        {existingRoom && existingCode && (
          <div
            role="alert"
            className="pixel-corners-sm bg-amber-400/40 p-[1.5px]"
          >
            <div className="pixel-corners-sm bg-[#12131a] px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-amber-200">
                You are currently in room{" "}
                <strong className="font-mono tracking-widest text-white">
                  {existingCode}
                </strong>
                . Leave it first to start a new match.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void navigate(`/${existingSlug}/room`)}
                  className="filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer inline-flex"
                >
                  <div className="pixel-corners-sm bg-black p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5">
                      Go to Room
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void leaveCurrentRoom()}
                  className="active:translate-y-0.5 transition-all cursor-pointer inline-flex"
                >
                  <div className="pixel-corners-sm bg-white/15 p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#181922] hover:bg-[#222432] text-gray-200 font-retro text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5">
                      Leave Room
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            {/* Create Room */}
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={handleCreateRoom}
              className="filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex"
            >
              <div className="pixel-corners-sm bg-black p-[2px] w-full">
                <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider px-6 py-3 flex items-center justify-center gap-2 transition-colors">
                  <Plus className="size-4" />
                  <span>
                    {busy === "create" ? "Creating..." : "Create Room"}
                  </span>
                </div>
              </div>
            </button>

            {/* Join Public */}
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={handleJoinPublic}
              className="filter drop-shadow-[0_4px_0_#000000] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#000000] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex"
            >
              <div className="pixel-corners-sm bg-white/20 hover:bg-white/35 p-[1.5px] w-full transition-colors">
                <div className="pixel-corners-sm bg-[#12131a] hover:bg-[#1a1c26] text-white font-retro text-xs sm:text-sm font-bold uppercase tracking-wider px-5 py-3 flex items-center justify-center gap-2 transition-colors">
                  <Users className="size-4 text-[#facc15]" />
                  <span>
                    {busy === "public" ? "Searching..." : "Join Public"}
                  </span>
                </div>
              </div>
            </button>

            {/* Join with Code */}
            <button
              type="button"
              onClick={() => setUserOpenedJoin(true)}
              className="filter drop-shadow-[0_4px_0_#000000] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#000000] transition-all cursor-pointer inline-flex"
            >
              <div className="pixel-corners-sm bg-white/20 hover:bg-white/35 p-[1.5px] w-full transition-colors">
                <div className="pixel-corners-sm bg-[#12131a] hover:bg-[#1a1c26] text-gray-200 font-retro text-xs sm:text-sm font-bold uppercase tracking-wider px-5 py-3 flex items-center justify-center gap-2 transition-colors">
                  <Hash className="size-4 text-gray-400" />
                  <span>Enter Code</span>
                </div>
              </div>
            </button>
          </div>

          {session && !connected && (
            <p className="text-xs text-gray-400">Connecting to server...</p>
          )}

          {error && !existingRoom && (
            <p role="alert" className="text-xs sm:text-sm text-red-400">
              {error.message}
              {error instanceof RequestError &&
                error.code === "NO_PUBLIC_ROOM" &&
                " — create a room and switch it to Public to start one."}
            </p>
          )}
        </div>
      </div>

      {/* Compact Screenshots Strip */}
      {screenshots.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-retro text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Screenshots
          </h2>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4">
            {screenshots.map((shot, idx) => (
              <button
                key={shot.url}
                type="button"
                onClick={() => setPreviewIndex(idx)}
                className="group sm:w-56 text-left cursor-pointer focus:outline-none"
              >
                <div className="pixel-corners-sm bg-white/15 group-hover:bg-[#facc15] p-[1.5px] transition-colors">
                  <div className="pixel-corners-sm aspect-video w-full overflow-hidden bg-[#0a0b10]">
                    <img
                      src={shot.url}
                      alt={shot.title}
                      loading="lazy"
                      className="size-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Game Info: Spacious 2-Column Details */}
      <div className="border-t border-white/10 pt-10 grid gap-10 lg:grid-cols-12">
        {/* Left Column: About & How to Play */}
        <div className="lg:col-span-7 space-y-10">
          <div className="space-y-3">
            <h2 className="font-retro text-xs font-bold uppercase tracking-widest text-gray-400">
              About
            </h2>
            <div className="space-y-3 text-sm sm:text-base text-gray-300 leading-relaxed">
              {game.overview && game.overview.length > 0 ? (
                game.overview.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))
              ) : (
                <p>{game.description}</p>
              )}
            </div>
          </div>

          {game.howToPlay && game.howToPlay.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-retro text-xs font-bold uppercase tracking-widest text-gray-400">
                How to Play
              </h2>
              <ol className="space-y-4">
                {game.howToPlay.map((item) => (
                  <li key={item.step} className="flex items-baseline gap-3.5">
                    <span className="font-retro text-xs font-bold text-[#facc15] shrink-0">
                      0{item.step}
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right Column: Rules & Controls */}
        <div className="lg:col-span-5 space-y-10">
          {game.rulesSummary && game.rulesSummary.length > 0 && (
            <div className="space-y-3.5">
              <h2 className="font-retro text-xs font-bold uppercase tracking-widest text-gray-400">
                Rules
              </h2>
              <ul className="space-y-2.5">
                {game.rulesSummary.map((rule, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-gray-300 leading-relaxed"
                  >
                    <span className="text-[#facc15] select-none mt-0.5">•</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {game.controls && game.controls.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-retro text-xs font-bold uppercase tracking-widest text-gray-400">
                Controls
              </h2>
              <div className="divide-y divide-white/5 border-y border-white/10">
                {game.controls.map((ctrl, idx) => (
                  <div
                    key={idx}
                    className="py-2.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
                  >
                    <span className="text-gray-400">{ctrl.action}</span>
                    <kbd className="pixel-corners-sm bg-[#12131a] border border-white/15 px-2 py-0.5 font-mono text-xs text-gray-200">
                      {ctrl.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Lightbox Dialog */}
      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewIndex(null);
        }}
      >
        {previewShot && (
          <DialogContent className="max-w-4xl p-4 sm:p-6">
            <DialogCloseButton onClick={() => setPreviewIndex(null)} />

            {/* Header: Title, index counter, caption */}
            <div className="pr-10 space-y-1">
              <div className="flex items-center gap-2.5">
                <DialogTitle className="font-retro text-xs sm:text-sm font-bold uppercase text-white truncate">
                  {previewShot.title}
                </DialogTitle>
                {screenshots.length > 1 && (
                  <span className="font-retro text-[10px] text-[#facc15] bg-[#12131a] px-2 py-0.5 pixel-corners-sm border border-[#facc15]/30 shrink-0">
                    0{previewIndex! + 1} / 0{screenshots.length}
                  </span>
                )}
              </div>

              {previewShot.caption && (
                <DialogDescription className="text-xs text-gray-400 mt-0.5">
                  {previewShot.caption}
                </DialogDescription>
              )}
            </div>

            {/* Main Image Container */}
            <div className="relative mt-3.5 w-full aspect-video max-h-[65vh] bg-[#090a0f] pixel-corners-sm overflow-hidden flex items-center justify-center border border-white/10 scanlines">
              <img
                src={previewShot.url}
                alt={previewShot.title}
                className="size-full object-contain select-none"
              />

              {screenshots.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewIndex(
                        (previewIndex! - 1 + screenshots.length) %
                          screenshots.length,
                      )
                    }
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 pixel-corners-sm bg-black/80 hover:bg-[#facc15] text-white hover:text-black p-2 transition-colors cursor-pointer filter drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]"
                    aria-label="Previous screenshot"
                  >
                    <ChevronLeft className="size-4 sm:size-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPreviewIndex((previewIndex! + 1) % screenshots.length)
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 pixel-corners-sm bg-black/80 hover:bg-[#facc15] text-white hover:text-black p-2 transition-colors cursor-pointer filter drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]"
                    aria-label="Next screenshot"
                  >
                    <ChevronRight className="size-4 sm:size-5" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation Strip */}
            {screenshots.length > 1 && (
              <div className="mt-3 flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
                {screenshots.map((shot, idx) => {
                  const active = idx === previewIndex;
                  return (
                    <button
                      key={shot.url}
                      type="button"
                      onClick={() => setPreviewIndex(idx)}
                      className={cn(
                        "group relative aspect-video w-20 sm:w-24 shrink-0 cursor-pointer transition-all",
                        active
                          ? "ring-2 ring-[#facc15] -translate-y-0.5 filter drop-shadow-[0_3px_0_#78350f]"
                          : "opacity-60 hover:opacity-100",
                      )}
                    >
                      <div className="pixel-corners-sm overflow-hidden bg-black size-full">
                        <img
                          src={shot.url}
                          alt={shot.title}
                          className="size-full object-cover"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      <AuthDialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) setPendingAction(null);
        }}
        onSuccess={handleAuthSuccess}
      />

      <JoinRoomDialog
        open={joinOpen}
        onOpenChange={handleJoinOpenChange}
        defaultCode={initialJoinCode}
        defaultGameSlug={slug}
      />
    </section>
  );
}
