import {
  displayNameSchema,
  getGameDefinition,
  type RoomPreview,
} from "@kridora/shared";
import {
  AlertCircle,
  ArrowRight,
  Crown,
  Loader2,
  LogOut,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AuthDialog, GoogleIcon } from "@/components/AuthDialog";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authClient, startGuestSession } from "@/lib/auth-client";
import { fetchInvitePreview } from "@/lib/room-preview";
import {
  describeError,
  request,
  RequestError,
  waitForSocketConnected,
} from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/providers/realtime-context";

function getInitial(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "P";
  return Array.from(trimmed)[0]?.toUpperCase() || "P";
}

export default function InviteJoinPage() {
  const { token, slug } = useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { setActiveRoom } = useRealtime();

  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [tokenSnapshot, setTokenSnapshot] = useState(token);
  if (token !== tokenSnapshot) {
    setTokenSnapshot(token);
    setLoading(Boolean(token));
    setPreviewError(null);
  }

  const effectivePreviewError = !token
    ? "No invite token provided"
    : previewError;

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | undefined>();
  const [conflictRoom, setConflictRoom] = useState<{
    roomCode: string;
    gameSlug?: string;
  } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    fetchInvitePreview(token, controller.signal)
      .then((data) => {
        setPreview(data);
        setPreviewError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setPreview(null);
        if (err instanceof RequestError && err.code === "ROOM_NOT_FOUND") {
          setPreviewError("This invite link is invalid or has expired.");
        } else {
          setPreviewError(describeError(err));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token]);

  async function performJoin(roomCode: string, gameSlug: string) {
    await waitForSocketConnected();
    const room = await request("room:join", { code: roomCode });
    setActiveRoom(room);
    void navigate(`/${room.gameSlug || gameSlug}/room`);
  }

  async function handleJoinSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !preview) return;

    if (!session) {
      const parsedName = displayNameSchema.safeParse(name);
      if (!parsedName.success) {
        setNameError(parsedName.error.issues[0]?.message);
        return;
      }
    }

    setBusy(true);
    setJoinError(undefined);
    setNameError(undefined);
    setConflictRoom(null);

    try {
      if (!session) {
        await startGuestSession(displayNameSchema.parse(name));
      }
      await performJoin(preview.code, preview.gameSlug);
    } catch (err) {
      if (err instanceof RequestError && err.code === "ALREADY_IN_ROOM") {
        const details = err.details;
        const conflictCode =
          typeof details?.roomCode === "string" ? details.roomCode : undefined;
        const conflictSlug =
          typeof details?.gameSlug === "string" ? details.gameSlug : undefined;

        if (conflictCode === preview.code) {
          void navigate(`/${preview.gameSlug}/room`);
          return;
        }

        if (conflictCode) {
          setConflictRoom({ roomCode: conflictCode, gameSlug: conflictSlug });
          setJoinError(
            `You are already in room "${conflictCode}". Leave it to join this room.`,
          );
          return;
        }
      }

      if (err instanceof RequestError) {
        if (err.code === "ROOM_FULL") {
          setJoinError("This room is full (maximum players reached).");
        } else if (err.code === "ROOM_IN_PROGRESS") {
          setJoinError("A match is currently in progress in this room.");
        } else if (err.code === "BANNED_FROM_ROOM") {
          setJoinError(
            "You were removed from this room by the host and cannot rejoin.",
          );
        } else {
          setJoinError(describeError(err));
        }
      } else {
        setJoinError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveAndJoin() {
    if (busy || !preview) return;
    setBusy(true);
    setJoinError(undefined);
    try {
      await waitForSocketConnected();
      await request("room:leave", {});
      setConflictRoom(null);
      await performJoin(preview.code, preview.gameSlug);
    } catch (err) {
      setJoinError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setJoinError(undefined);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
        errorCallbackURL: `${window.location.origin}/?authError=google`,
      });
      if (res.error) {
        setJoinError(
          res.error.message || "Google sign-in failed. Please try again.",
        );
      }
    } catch (err) {
      setJoinError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const isRoomFull = Boolean(
    preview && preview.playerCount >= preview.maxPlayers,
  );
  const isGameRunning = Boolean(preview && preview.status === "in_progress");
  const canJoin =
    !busy &&
    !isRoomFull &&
    !isGameRunning &&
    (session || name.trim().length > 0);
  const activeGameDef = preview?.gameSlug
    ? getGameDefinition(preview.gameSlug)
    : null;

  if (loading) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-full rounded-3xl border border-white/10 bg-panel/85 p-8 backdrop-blur-2xl shadow-2xl">
          <Loader2 className="mx-auto size-10 animate-spin text-primary" />
          <h2 className="mt-4 font-display text-xl uppercase tracking-wider text-foreground">
            Verifying Invitation...
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connecting to the game room
          </p>
        </div>
      </section>
    );
  }

  if (effectivePreviewError || !preview) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-full rounded-3xl border border-white/10 bg-panel/85 p-8 backdrop-blur-2xl shadow-2xl">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-8" />
          </div>
          <h2 className="mt-4 font-display text-2xl uppercase tracking-wider text-foreground">
            Invite Not Available
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {effectivePreviewError ||
              "This invite link is invalid, expired, or the room has ended."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={slug ? `/${slug}` : "/games"}
              className={buttonVariants({ size: "lg" })}
            >
              {slug ? `Back to ${slug}` : "Browse Games"}
            </Link>
            <Link
              to="/"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg py-12 px-4">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-card/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl"
        style={{
          borderTop: `4px solid ${activeGameDef?.accent || "var(--color-primary)"}`,
        }}
      >
        {/* Host Banner */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative shrink-0">
            {preview.owner.image ? (
              <img
                src={preview.owner.image}
                alt={preview.owner.name}
                className="size-14 rounded-2xl object-cover border border-white/20 shadow-md"
              />
            ) : (
              <div className="grid size-14 place-items-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 font-display text-xl font-bold text-white shadow-lg shadow-violet-500/25">
                {getInitial(preview.owner.name)}
              </div>
            )}
            <span
              title="Room Host"
              className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-amber-400 text-black shadow-xs"
            >
              <Crown className="size-3 fill-current" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {preview.owner.name} invited you!
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>to play</span>
              <strong className="text-foreground font-semibold">
                {preview.gameName}
              </strong>
            </p>
          </div>
        </div>

        {/* Game & Room Status Details */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-panel/75 p-4 shadow-inner">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-11 overflow-hidden rounded-xl border border-white/10">
                <GameThumbnail
                  slug={preview.gameSlug}
                  name={preview.gameName}
                  className="size-full object-cover"
                />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {preview.gameName}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="size-3" />
                  <span>
                    {preview.playerCount}/{preview.maxPlayers} players
                  </span>
                </p>
              </div>
            </div>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                isRoomFull || isGameRunning
                  ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
                  : "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isRoomFull || isGameRunning
                    ? "bg-amber-400"
                    : "bg-emerald-400 animate-pulse",
                )}
              />
              {isGameRunning
                ? "In Progress"
                : isRoomFull
                  ? "Room Full"
                  : "Ready to Join"}
            </span>
          </div>

          {/* Player roster chips */}
          {preview.players.length > 0 && (
            <div className="mt-3.5 border-t border-white/10 pt-3">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                Currently in lobby:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.players.map((p, idx) => (
                  <span
                    key={`${p.name}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-white/10 text-[9px] font-bold overflow-hidden">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        p.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    {p.isOwner && <Crown className="size-3 text-amber-300" />}
                    <span className="truncate max-w-28">{p.name}</span>
                  </span>
                ))}
                {Array.from({
                  length: Math.max(0, preview.maxPlayers - preview.playerCount),
                }).map((_, i) => (
                  <span
                    key={`empty-${i}`}
                    className="inline-flex items-center rounded-xl border border-dashed border-white/10 px-2 py-1 text-xs text-muted-foreground/60"
                  >
                    Open seat
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {isRoomFull && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-400/10 border border-amber-400/20 px-3.5 py-2.5 text-xs text-amber-200"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>
              This room has reached max capacity. Try again later or ask your
              friend for a new match.
            </span>
          </div>
        )}

        {isGameRunning && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-400/10 border border-amber-400/20 px-3.5 py-2.5 text-xs text-amber-200"
          >
            <AlertCircle className="size-4 shrink-0" />
            <span>The match is currently running and cannot be joined.</span>
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="mt-6 space-y-4" noValidate>
          {/* Identity Form */}
          {session ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-neon-violet to-neon-pink font-display text-xs uppercase text-white">
                    {getInitial(session.user.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Joining as</p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {session.user.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                  onClick={() => setAuthOpen(true)}
                >
                  Switch account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pixel-corners-sm border-2 border-white/15 bg-white/5 p-4">
              <Field label="Your display name" error={nameError}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(undefined);
                  }}
                  placeholder="What should players call you?"
                  maxLength={20}
                  autoComplete="nickname"
                  autoFocus
                  aria-invalid={Boolean(nameError)}
                  className="h-11"
                />
              </Field>

              <p className="text-xs text-muted-foreground">
                Join immediately as a guest. No email or password needed.
              </p>
            </div>
          )}

          {/* Join / Conflict Error Banner */}
          {joinError && (
            <div
              role="alert"
              className="rounded-2xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive"
            >
              <p>{joinError}</p>
              {conflictRoom && (
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void handleLeaveAndJoin()}
                  >
                    <LogOut className="size-3.5" /> Leave current & join this
                    room
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigate(`/${conflictRoom.gameSlug || "game"}/room`);
                    }}
                  >
                    Go to existing room
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 active:scale-[0.99] transition-all"
              disabled={!canJoin}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Joining room...</span>
                </>
              ) : (
                <>
                  <Users className="size-4" />
                  <span>
                    {!session
                      ? "Join as Guest"
                      : `Join ${preview.owner.name}'s Room`}
                  </span>
                  <ArrowRight className="size-4 ml-auto" />
                </>
              )}
            </Button>
          </div>

          {/* Account Alternates when not signed in */}
          {!session && (
            <div className="space-y-3 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
                  or sign in first
                </span>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  className="w-full filter drop-shadow-[0_4px_0_#000000] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#000000] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={busy}
                  onClick={() => void handleGoogleLogin()}
                >
                  <div className="pixel-corners-sm bg-black p-[2px]">
                    <div className="pixel-corners-sm bg-white hover:bg-[#f3f4f6] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider h-10 px-4 flex items-center justify-center gap-2.5 transition-colors">
                      <GoogleIcon className="size-4.5 shrink-0" />
                      <span>Continue with Google</span>
                    </div>
                  </div>
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                    onClick={() => setAuthOpen(true)}
                  >
                    Log in with email
                  </button>
                </p>
              </div>
            </div>
          )}
        </form>
      </div>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialMode="login"
        onSuccess={() => {
          setAuthOpen(false);
        }}
      />
    </section>
  );
}
