import {
  displayNameSchema,
  roomCodeSchema,
  ROOM_CODE_LENGTH,
  type RoomSnapshot,
} from "@kridora/shared";
import { ArrowRight, Loader2, LogOut, Users } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { AuthDialog, GoogleIcon } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { authClient, startGuestSession } from "@/lib/auth-client";
import {
  describeError,
  request,
  RequestError,
  waitForSocketConnected,
} from "@/lib/socket";
import { useRealtime } from "@/providers/realtime-context";
import { cn } from "@/lib/utils";

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

const OTP_PLACEHOLDERS = ["A", "B", "C", "9"];

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  disabled?: boolean;
}

function OtpCodeInput({
  value,
  onChange,
  hasError,
  disabled,
}: OtpCodeInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const chars = Array.from({ length: 4 }, (_, i) => value[i] || "");

  useEffect(() => {
    // Automatically focus the first input so user can type immediately on open
    const timer = setTimeout(() => {
      inputsRef.current[0]?.focus();
      inputsRef.current[0]?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  function handleCharChange(index: number, rawInput: string) {
    const clean = rawInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) {
      const next = [...chars];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    if (clean.length > 1) {
      handlePasteString(clean, index);
      return;
    }

    const char = clean.slice(-1);
    const next = [...chars];
    next[index] = char;
    onChange(next.join(""));

    if (index < 3) {
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace") {
      if (!chars[index] && index > 0) {
        e.preventDefault();
        const next = [...chars];
        next[index - 1] = "";
        onChange(next.join(""));
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
      inputsRef.current[index - 1]?.select();
    } else if (e.key === "ArrowRight" && index < 3) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
      inputsRef.current[index + 1]?.select();
    }
  }

  function handlePasteString(pasted: string, startIndex: number = 0) {
    const clean = pasted.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) return;

    const next = [...chars];
    let nextFocus = startIndex;
    for (let i = 0; i < clean.length && startIndex + i < 4; i++) {
      next[startIndex + i] = clean[i]!;
      nextFocus = startIndex + i;
    }
    onChange(next.join(""));
    const targetFocus = Math.min(3, nextFocus + 1);
    inputsRef.current[targetFocus]?.focus();
    inputsRef.current[targetFocus]?.select();
  }

  function handlePaste(
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
  ) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    handlePasteString(text, index);
  }

  return (
    <div className="flex items-center justify-between gap-2.5 sm:gap-3.5 w-full">
      {Array.from({ length: 4 }).map((_, i) => {
        const isFocused = focusedIndex === i;
        const isFilled = Boolean(chars[i]);

        return (
          <div
            key={i}
            className={cn(
              "relative flex-1 filter transition-all",
              hasError
                ? "drop-shadow-[0_4px_0_#881337]"
                : isFocused
                  ? "drop-shadow-[0_4px_0_#78350f]"
                  : isFilled
                    ? "drop-shadow-[0_3px_0_#78350f]"
                    : "drop-shadow-[0_2px_0_#000000]",
            )}
          >
            <div
              className={cn(
                "pixel-corners-sm p-[2.5px] transition-colors",
                hasError
                  ? "bg-destructive"
                  : isFocused
                    ? "bg-[#facc15]"
                    : isFilled
                      ? "bg-[#facc15]/70 hover:bg-[#facc15]"
                      : "bg-white/20 hover:bg-[#facc15]/40",
              )}
            >
              <div className="pixel-corners-sm bg-[#12131a] flex items-center justify-center h-14 sm:h-16 w-full">
                <input
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="text"
                  autoFocus={i === 0}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={4}
                  value={chars[i]}
                  onChange={(e) => handleCharChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={(e) => handlePaste(e, i)}
                  onFocus={(e) => {
                    setFocusedIndex(i);
                    e.target.select();
                  }}
                  onBlur={() => setFocusedIndex(null)}
                  disabled={disabled}
                  placeholder={isFocused ? "" : OTP_PLACEHOLDERS[i]}
                  className="size-full bg-transparent text-center font-mono text-2xl sm:text-3xl font-bold uppercase text-[#facc15] placeholder:text-gray-600 outline-none caret-[#facc15]"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
    void navigate(`/${room.gameSlug}/room`);
    onOpenChange(false);
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
        errorCallbackURL: `${window.location.origin}/?authError=google`,
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
        <DialogContent className="max-w-md">
          <DialogCloseButton onClick={() => handleOpenChange(false)} />

          {/* Dialog Header */}
          <div className="flex items-center gap-3 pr-6">
            <div className="pixel-corners-sm bg-[#facc15] p-[2px] shrink-0 filter drop-shadow-[0_2px_0_#78350f]">
              <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-[#facc15]">
                <Users className="size-5" />
              </div>
            </div>
            <div>
              <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                Join a Room
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Enter the {ROOM_CODE_LENGTH}-character room code your friend
                gave you.
              </DialogDescription>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field
              label="Room code"
              error={error && !conflictRoom ? error : undefined}
            >
              <OtpCodeInput
                value={code}
                onChange={(val) => {
                  setCode(val);
                  setError(undefined);
                  setConflictRoom(null);
                }}
                hasError={Boolean(error && !conflictRoom)}
                disabled={busy}
              />
            </Field>

            {/* Identity: When Signed in vs Not Signed in */}
            {session ? (
              <div className="pixel-corners-sm bg-white/20 p-[2px] filter drop-shadow-[0_2px_0_#000000]">
                <div className="pixel-corners-sm bg-[#12131a] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="pixel-corners-sm bg-[#facc15] p-[1.5px] shrink-0">
                        <span className="grid size-8 place-items-center pixel-corners-sm bg-linear-to-br from-amber-400 to-amber-600 font-display text-xs uppercase text-black font-bold overflow-hidden">
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
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-retro font-bold uppercase tracking-wider text-muted-foreground">
                          Playing as
                        </p>
                        <p className="truncate text-sm font-semibold text-white">
                          {session.user.name}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-retro font-bold text-[#facc15] hover:text-white uppercase transition-colors"
                      onClick={() => setAuthOpen(true)}
                    >
                      Switch
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pixel-corners-sm bg-white/20 p-[2px] filter drop-shadow-[0_2px_0_#000000]">
                <div className="space-y-3 pixel-corners-sm bg-[#12131a] p-4">
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
              </div>
            )}

            {/* Conflict Error Banner */}
            {error && conflictRoom && (
              <div className="pixel-corners-sm bg-destructive p-[2px] filter drop-shadow-[0_2px_0_#881337]">
                <div className="pixel-corners-sm bg-[#1a0a0d] p-3.5 text-sm text-destructive">
                  <p>{error}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void handleLeaveAndJoin()}
                      className="pixel-corners-sm"
                    >
                      <LogOut className="size-3.5" /> Leave current & join
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="pixel-corners-sm"
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
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!canJoin}
                className="w-full filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <div className="pixel-corners-sm bg-black p-[2px]">
                  <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider h-11 flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin text-black" />
                        <span>Joining room...</span>
                      </>
                    ) : (
                      <>
                        <Users className="size-4" />
                        <span>{!session ? "Join as Guest" : "Join room"}</span>
                        <ArrowRight className="size-4 ml-1" />
                      </>
                    )}
                  </div>
                </div>
              </button>
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
