import {
  getGameDefinition,
  type GameSlug,
  type RoomSnapshot,
} from "@kridora/shared";
import type { TruthAndDareAgeGroup, TruthAndDareMode } from "@kridora/shared";
import { Check, Copy, DoorOpen, Hash, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AuthDialog } from "@/components/AuthDialog";
import { JoinRoomDialog } from "@/components/JoinRoomDialog";
import { Button } from "@/components/ui/button";
import { findEnabledGame } from "@/config/games";
import { authClient } from "@/lib/auth-client";
import {
  describeError,
  request,
  RequestError,
  waitForSocketConnected,
} from "@/lib/socket";
import { useRealtime } from "@/providers/realtime-context";
import { TruthAndDareLanding } from "@/games/truth-and-dare/landing";
import NotFoundPage from "./NotFoundPage";

/** yourdomain.com/<game>: the game's front door with "Join a public room", "Join with code" and "Create room". */
export default function GameLobbyPage() {
  const { slug } = useParams();
  const gameSlug = findEnabledGame(slug);
  if (!gameSlug) return <NotFoundPage />;
  return <GameEntrance slug={gameSlug} />;
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
  const [pendingPartySettings, setPendingPartySettings] = useState<{
    ageGroup: TruthAndDareAgeGroup;
    mode: TruthAndDareMode;
  } | null>(null);

  // Join Room with Code / Invite modal state
  const [userOpenedJoin, setUserOpenedJoin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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

  function createPrivateRoom(partySettings?: {
    ageGroup: TruthAndDareAgeGroup;
    mode: TruthAndDareMode;
  }) {
    void enter("create", async () => {
      await waitForSocketConnected();
      const room = await request("room:create", {
        gameSlug: slug,
        visibility: "private",
      });
      setActiveRoom(room);
      if (slug === "truth-and-dare" && partySettings) {
        await request("truth-and-dare:configure", {
          ...partySettings,
          spinner: "bottle",
        });
      }
      return room;
    });
  }

  function handleCreateRoom(partySettings?: {
    ageGroup: TruthAndDareAgeGroup;
    mode: TruthAndDareMode;
  }) {
    if (!session) {
      setPendingAction("create");
      setPendingPartySettings(partySettings ?? null);
      setAuthOpen(true);
      return;
    }
    createPrivateRoom(partySettings);
  }

  function handlePlay(partySettings: {
    ageGroup: TruthAndDareAgeGroup;
    mode: TruthAndDareMode;
  }) {
    if (activeRoom?.gameSlug === slug) {
      void navigate(`/${slug}/room`);
      return;
    }
    handleCreateRoom(partySettings);
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
    const partySettings = pendingPartySettings;
    setPendingAction(null);
    setPendingPartySettings(null);
    if (action === "create") {
      createPrivateRoom(partySettings ?? undefined);
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
      // Fallback
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

  const dialogs = (
    <>
      <AuthDialog
        open={authOpen}
        onOpenChange={(open) => {
          setAuthOpen(open);
          if (!open) {
            setPendingAction(null);
            setPendingPartySettings(null);
          }
        }}
        onSuccess={handleAuthSuccess}
      />

      <JoinRoomDialog
        open={joinOpen}
        onOpenChange={handleJoinOpenChange}
        defaultCode={initialJoinCode}
        defaultGameSlug={slug}
      />
    </>
  );

  if (slug === "truth-and-dare") {
    return (
      <>
        <TruthAndDareLanding
          onPlay={handlePlay}
          onExit={() => void navigate("/games")}
          onJoinCode={() => setUserOpenedJoin(true)}
          onJoinPublic={handleJoinPublic}
          playDisabled={busy !== null || (session ? !connected : false)}
          publicDisabled={busy !== null || (session ? !connected : false)}
          isBusy={busy === "create"}
          hasRoom={activeRoom?.gameSlug === slug}
          errorMessage={error?.message ?? null}
          players={
            activeRoom?.gameSlug === slug
              ? activeRoom.players.map((player) => ({
                  userId: player.userId,
                  name: player.name,
                  image: player.image ?? null,
                }))
              : []
          }
          currentUserName={session?.user.name ?? "You"}
        />
        {dialogs}
      </>
    );
  }

  return (
    <section className="mx-auto max-w-xl py-10 px-4">
      <div
        className="rounded-3xl border border-white/10 bg-card/70 p-6 sm:p-8 backdrop-blur-xl shadow-2xl"
        style={{ borderTop: `4px solid ${game.accent}` }}
      >
        <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
        <p className="mt-2 text-muted-foreground">{game.description}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" /> {game.minPlayers} to {game.maxPlayers}{" "}
          players
        </p>

        {/* Active room card with quick return and share actions */}
        {activeRoom && activeRoom.gameSlug === slug && (
          <div className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                  Active Room
                </p>
                <p className="text-sm text-foreground">
                  You are in room{" "}
                  <strong className="font-mono text-base font-bold tracking-widest">
                    {activeRoom.code}
                  </strong>{" "}
                  ({activeRoom.players.length}/{activeRoom.maxPlayers} players)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void navigate(`/${slug}/room`)}
                  className="gap-1.5"
                >
                  <DoorOpen className="size-3.5" /> Return to room
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleCopyInvite()}
                  className="gap-1.5"
                >
                  {copiedLink ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedLink ? "Link Copied!" : "Share link"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Action Grid: Create Room, Join with Code, Join Public Room */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Button
            size="lg"
            className="h-12 text-sm sm:text-base font-semibold shadow-md shadow-primary/20"
            disabled={busy !== null || (session ? !connected : false)}
            onClick={() => handleCreateRoom()}
          >
            <Plus className="size-4" />{" "}
            {busy === "create" ? "Creating..." : "Create room"}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="h-12 text-sm sm:text-base font-medium"
            onClick={() => setUserOpenedJoin(true)}
          >
            <Hash className="size-4" /> Join with code
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-12 text-sm sm:text-base font-medium border-white/15"
            disabled={busy !== null || (session ? !connected : false)}
            onClick={handleJoinPublic}
          >
            <DoorOpen className="size-4" />{" "}
            {busy === "public" ? "Looking..." : "Join public"}
          </Button>
        </div>

        {session && !connected && (
          <p className="mt-4 text-sm text-muted-foreground animate-pulse">
            Connecting to the game server...
          </p>
        )}

        {error && !existingRoom && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error.message}
            {error instanceof RequestError &&
              error.code === "NO_PUBLIC_ROOM" &&
              " Create a room and make it public to start one."}
          </p>
        )}

        {existingRoom && existingCode && (
          <div
            role="alert"
            className="mt-4 space-y-3 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
          >
            <p>
              You are already in room{" "}
              <strong className="tracking-widest">{existingCode}</strong>. Leave
              it before joining another.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void navigate(`/${existingSlug}/room`)}
              >
                Go to that room
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void leaveCurrentRoom()}
              >
                Leave it
              </Button>
            </div>
          </div>
        )}
      </div>

      {dialogs}
    </section>
  );
}
