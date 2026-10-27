import {
  displayNameSchema,
  roomCodeSchema,
  ROOM_CODE_LENGTH,
  type RoomSnapshot,
} from "@kridora/shared";
import { ArrowRight, DoorOpen, Loader2, LogOut, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { authClient, startGuestSession } from "@/lib/auth-client";
import {
  describeError,
  request,
  RequestError,
  waitForSocketConnected,
} from "@/lib/socket";
import { useRealtime } from "@/providers/realtime-context";

interface JoinRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCode?: string;
  defaultGameSlug?: string;
  onJoined?: (room: RoomSnapshot) => void;
}

function getInitial(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "P";
  return Array.from(trimmed)[0]?.toUpperCase() || "P";
}

/**
 * Join with Room Code Dialog:
 * Secure by design — does NOT reveal who is playing or leak room rosters.
 * Players simply enter the room code shared by their friend and join directly.
 */
export function JoinRoomDialog({
  open,
  onOpenChange,
  defaultCode,
  defaultGameSlug,
  onJoined,
}: JoinRoomDialogProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { setActiveRoom } = useRealtime();
  const { googleEnabled } = usePublicConfig();

  const [code, setCode] = useState(
    defaultCode ? defaultCode.toUpperCase() : "",
  );
  const [prevDefaultCode, setPrevDefaultCode] = useState(defaultCode);
  if (defaultCode !== prevDefaultCode) {
    setPrevDefaultCode(defaultCode);
    if (defaultCode) {
      setCode(defaultCode.toUpperCase());
    }
  }

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [authOpen, setAuthOpen] = useState(false);
  const [conflictRoom, setConflictRoom] = useState<{
    roomCode: string;
    gameSlug?: string;
  } | null>(null);

  async function performJoin(roomCode: string) {
    await waitForSocketConnected();
    const room = await request("room:join", { code: roomCode });
    setActiveRoom(room);
    onJoined?.(room);
    onOpenChange(false);
    void navigate(`/${room.gameSlug}/room`);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const parsedCode = roomCodeSchema.safeParse(code.trim().toUpperCase());
    if (!parsedCode.success) {
      setError(parsedCode.error.issues[0]?.message);
      return;
    }

    if (!session) {
      const parsedName = displayNameSchema.safeParse(name);
      if (!parsedName.success) {
        setNameError(parsedName.error.issues[0]?.message);
        return;
      }
    }

    setBusy(true);
    setError(undefined);
    setNameError(undefined);
    setConflictRoom(null);

    try {
      if (!session) {
        await startGuestSession(displayNameSchema.parse(name));
      }
      await performJoin(parsedCode.data);
    } catch (err) {
      if (err instanceof RequestError && err.code === "ALREADY_IN_ROOM") {
        const details = err.details;
        const conflictCode =
          typeof details?.roomCode === "string" ? details.roomCode : undefined;
        const conflictSlug =
          typeof details?.gameSlug === "string" ? details.gameSlug : undefined;

        if (conflictCode === parsedCode.data) {
          onOpenChange(false);
          void navigate(`/${conflictSlug || defaultGameSlug || "game"}/room`);
          return;
        }

        if (conflictCode) {
          setConflictRoom({ roomCode: conflictCode, gameSlug: conflictSlug });
          setError(
            `You are already in room "${conflictCode}". Leave it to join this room.`,
          );
          return;
        }
      }

      if (err instanceof RequestError) {
        if (err.code === "ROOM_NOT_FOUND") {
          setError(`Room "${parsedCode.data}" does not exist or has expired.`);
        } else if (err.code === "ROOM_FULL") {
          setError("This room is already full (maximum players reached).");
        } else if (err.code === "ROOM_IN_PROGRESS") {
          setError("A match is currently in progress in this room.");
        } else if (err.code === "BANNED_FROM_ROOM") {
          setError(
            "You were removed from this room by the host and cannot rejoin.",
          );
        } else {
          setError(describeError(err));
        }
      } else {
        setError(describeError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveAndJoin() {
    if (busy || !code) return;
    setBusy(true);
    setError(undefined);
    try {
      await waitForSocketConnected();
      await request("room:leave", {});
      setConflictRoom(null);
      await performJoin(code.trim().toUpperCase());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
      });
      if (res.error) {
        setError(
          res.error.message || "Google sign-in failed. Please try again.",
        );
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(undefined);
      setNameError(undefined);
      setConflictRoom(null);
      setCode("");
    }
    onOpenChange(next);
  }

  const canJoin =
    !busy &&
    code.trim().length === ROOM_CODE_LENGTH &&
    (session || name.trim().length > 0);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md overflow-hidden border border-white/15 bg-card/95 p-6 backdrop-blur-2xl shadow-2xl sm:p-7">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            className="absolute top-4 right-4 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground z-20"
            onClick={() => handleOpenChange(false)}
          >
            <X className="size-4" />
          </Button>

          {/* Dialog Header */}
          <div className="pr-6">
            <DialogTitle className="mt-2 text-2xl font-bold tracking-tight">
              Join a room
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Enter the {ROOM_CODE_LENGTH}-character room code your friend gave
              you.
            </DialogDescription>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field
              label="Room code"
              error={error && !conflictRoom ? error : undefined}
            >
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(undefined);
                  setConflictRoom(null);
                }}
                placeholder="ABCD"
                maxLength={ROOM_CODE_LENGTH}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Room code"
                aria-invalid={Boolean(error && !conflictRoom)}
                className="h-12 text-center text-xl font-bold tracking-[0.35em] uppercase font-mono"
              />
            </Field>

            {/* Identity: When Signed in vs Not Signed in */}
            {session ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-neon-violet to-neon-pink font-display text-xs uppercase text-white overflow-hidden">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        getInitial(session.user.name)
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Playing as
                      </p>
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
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
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
                    aria-invalid={Boolean(nameError)}
                    className="h-11"
                  />
                </Field>

                <p className="text-xs text-muted-foreground">
                  Joining as a guest lets you play immediately without
                  passwords.
                </p>
              </div>
            )}

            {/* Conflict Error Banner */}
            {error && conflictRoom && (
              <div
                role="alert"
                className="rounded-2xl bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-sm text-destructive"
              >
                <p>{error}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void handleLeaveAndJoin()}
                  >
                    <LogOut className="size-3.5" /> Leave current & join
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      void navigate(
                        `/${conflictRoom.gameSlug || defaultGameSlug || "game"}/room`,
                      );
                    }}
                  >
                    Go to room
                  </Button>
                </div>
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
                    <DoorOpen className="size-4" />
                    <span>{!session ? "Join as Guest" : "Join room"}</span>
                    <ArrowRight className="size-4 ml-auto" />
                  </>
                )}
              </Button>
            </div>

            {/* Alternates when not signed in */}
            {!session && (
              <div className="space-y-3 pt-1">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">
                    or with an account
                  </span>
                </div>

                <div className="grid gap-2">
                  {googleEnabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      className="w-full h-10 border-white/15 hover:border-primary/50 text-sm"
                      disabled={busy}
                      onClick={() => void handleGoogleLogin()}
                    >
                      Continue with Google
                    </Button>
                  )}

                  <p className="text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline underline-offset-4 hover:text-primary transition-colors"
                      onClick={() => setAuthOpen(true)}
                    >
                      Log in to account
                    </button>
                  </p>
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialMode="login"
        onSuccess={() => {
          setAuthOpen(false);
        }}
      />
    </>
  );
}
