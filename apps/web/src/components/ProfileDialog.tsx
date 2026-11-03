import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from "@kridora/shared";
import {
  Check,
  Coins,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Pencil,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useProfile";
import { API_URL } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAuth?: (mode?: "login" | "signup") => void;
}

function getInitial(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "P";
  return Array.from(trimmed)[0]?.toUpperCase() || "P";
}

export function ProfileDialog({
  open,
  onOpenChange,
  onOpenAuth,
}: ProfileDialogProps) {
  const { data: rawSession, refetch: refetchSession } = authClient.useSession();
  const session =
    rawSession &&
    typeof rawSession === "object" &&
    "user" in rawSession &&
    rawSession.user
      ? rawSession
      : null;
  const { me, refresh: refreshProfile } = useProfile();
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit Name State
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!session?.user) return null;

  const currentName = me?.user.name || session.user.name || "Player";
  const isGuest = Boolean(session.user.isAnonymous ?? me?.user.isAnonymous);
  const isVerified = Boolean(
    !isGuest && (me?.user.emailVerified ?? session.user.emailVerified),
  );
  const numericId = me?.user.numericId || me?.profile.numericId || null;

  const gamesPlayed = me?.profile.gamesPlayed ?? 0;
  const gamesWon = me?.profile.gamesWon ?? 0;
  const winRate =
    gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setIsEditing(false);
      setNameError(null);
    }
    onOpenChange(nextOpen);
  }

  function handleStartEdit() {
    setNameInput(currentName);
    setNameError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setNameError(null);
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user) return;
    const trimmed = nameInput.trim();

    // Client-side validation against shared schema
    const validation = displayNameSchema.safeParse(trimmed);
    if (!validation.success) {
      setNameError(
        validation.error.issues[0]?.message || "Invalid display name format",
      );
      return;
    }

    if (trimmed === currentName) {
      setIsEditing(false);
      return;
    }

    setSavingName(true);
    setNameError(null);

    try {
      const res = await fetch(`${API_URL}/api/me/name`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId: session.user.id,
          name: trimmed,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          (res.status === 401
            ? "Please sign in first"
            : res.status === 403
              ? "You do not have permission to modify this profile"
              : res.status === 429
                ? "You are changing your name too quickly. Please wait a minute."
                : "Failed to update display name");
        setNameError(errorMsg);
        setSavingName(false);
        return;
      }

      // Synchronously refresh session state and game profile
      await Promise.all([
        refetchSession?.().catch(() => {}),
        refreshProfile().catch(() => {}),
      ]);

      setIsEditing(false);
    } catch {
      setNameError("Network connection error. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleCopyId() {
    if (!numericId) return;
    try {
      await navigator.clipboard.writeText(numericId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      onOpenChange(false);
      window.location.href = "/";
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogCloseButton onClick={() => handleOpenChange(false)} />

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 pr-6">
          <div className="relative shrink-0">
            <div className="pixel-corners-sm bg-[#facc15] p-[2px] filter drop-shadow-[0_3px_0_#78350f]">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={currentName}
                  className="size-16 pixel-corners-sm object-cover bg-black"
                />
              ) : (
                <div className="grid size-16 place-items-center pixel-corners-sm bg-linear-to-br from-amber-400 to-amber-600 font-display text-2xl font-bold text-black">
                  {getInitial(currentName)}
                </div>
              )}
            </div>
            {isVerified && (
              <span
                title="Verified Player"
                className="absolute -bottom-1 -right-1 grid size-5 place-items-center pixel-corners-sm bg-emerald-400 text-black shadow-xs"
              >
                <ShieldCheck className="size-3.5 fill-current" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <form onSubmit={handleSaveName} className="space-y-1">
                <DialogTitle className="sr-only">Edit Display Name</DialogTitle>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    disabled={savingName}
                    autoFocus
                    placeholder="Enter name"
                    className="h-8 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingName || !nameInput.trim()}
                    className="h-8 px-3 pixel-corners-sm text-xs font-semibold gap-1 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm active:scale-95 transition-all"
                  >
                    {savingName ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={savingName}
                    onClick={handleCancelEdit}
                    title="Cancel"
                    aria-label="Cancel"
                    className="size-8 pixel-corners-sm text-muted-foreground hover:bg-white/10 hover:text-foreground shrink-0"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {nameError && (
                  <p className="text-[11px] font-medium text-rose-400 leading-tight">
                    {nameError}
                  </p>
                )}
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white truncate">
                  {currentName}
                </DialogTitle>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  title="Edit display name"
                  aria-label="Edit display name"
                  className="inline-flex items-center justify-center size-7 pixel-corners-sm text-muted-foreground hover:text-[#facc15] hover:bg-white/10 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] shrink-0"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            )}
            <DialogDescription className="mt-0.5 text-xs">
              {isGuest ? (
                <span className="inline-flex items-center gap-1 text-amber-300 font-semibold uppercase tracking-wider">
                  Guest Session
                </span>
              ) : isVerified ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold uppercase tracking-wider">
                  Verified Account
                </span>
              ) : (
                <span className="text-muted-foreground">Unverified Player</span>
              )}
            </DialogDescription>
          </div>
        </div>

        {/* User ID Box (Numeric ID for Friends) */}
        <div className="mt-5 pixel-corners-sm bg-white/20 p-[2px] filter drop-shadow-[0_2px_0_#000000]">
          <div className="pixel-corners-sm bg-[#12131a] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-retro font-bold uppercase tracking-wider text-muted-foreground">
                  Player User ID
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-[#facc15]">
                  {numericId ?? "------"}
                </p>
              </div>
              {numericId && (
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer"
                >
                  <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#12131a] hover:bg-[#1a1b24] text-[#facc15] font-retro text-[10px] font-bold uppercase tracking-wider h-8 px-3 flex items-center gap-1.5 transition-colors">
                      {copied ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span>{copied ? "Copied!" : "Copy ID"}</span>
                    </div>
                  </div>
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Share this numeric ID with your friends so they can invite you
              directly from any game room.
            </p>
          </div>
        </div>

        {/* Player Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="pixel-corners-sm bg-white/20 hover:bg-[#facc15]/60 p-[2px] transition-colors filter drop-shadow-[0_2px_0_#000000]">
            <div className="pixel-corners-sm bg-[#12131a] p-3 text-center h-full">
              <Coins className="mx-auto size-4 text-coin mb-1" />
              <p className="text-lg font-bold tabular-nums text-foreground">
                {me?.profile.rings ?? 0}
              </p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Rings
              </p>
            </div>
          </div>

          <div className="pixel-corners-sm bg-white/20 hover:bg-[#facc15]/60 p-[2px] transition-colors filter drop-shadow-[0_2px_0_#000000]">
            <div className="pixel-corners-sm bg-[#12131a] p-3 text-center h-full">
              <Trophy className="mx-auto size-4 text-neon-pink mb-1" />
              <p className="text-lg font-bold tabular-nums text-foreground">
                {gamesWon}
              </p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Victories
              </p>
            </div>
          </div>

          <div className="pixel-corners-sm bg-white/20 hover:bg-[#facc15]/60 p-[2px] transition-colors filter drop-shadow-[0_2px_0_#000000]">
            <div className="pixel-corners-sm bg-[#12131a] p-3 text-center h-full">
              <Crown className="mx-auto size-4 text-neon-cyan mb-1" />
              <p className="text-lg font-bold tabular-nums text-foreground">
                {winRate}%
              </p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                Win Rate
              </p>
            </div>
          </div>
        </div>

        {/* Guest Warning / Upgrade Button */}
        {isGuest && (
          <div className="mt-4 pixel-corners-sm bg-amber-400/40 p-[2px] filter drop-shadow-[0_3px_0_#78350f]">
            <div className="pixel-corners-sm bg-[#161208] p-3.5 text-xs text-amber-200">
              <p className="font-retro font-bold text-amber-300 uppercase tracking-wide">
                Guest sessions are temporary
              </p>
              <p className="mt-1 text-muted-foreground">
                Guest profiles inactive for 5 days are automatically removed.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleOpenChange(false);
                  onOpenAuth?.("signup");
                }}
                className="mt-3 w-full filter drop-shadow-[0_4px_0_#78350f] hover:drop-shadow-[0_5px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer"
              >
                <div className="pixel-corners-sm bg-black p-[2px]">
                  <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs font-bold uppercase tracking-wider h-10 px-4 flex items-center justify-center gap-2">
                    <UserIcon className="size-4" />
                    <span>Create account to keep stats</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleSignOut}
            className="filter drop-shadow-[0_3px_0_#881337] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#881337] transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="pixel-corners-sm bg-rose-500 p-[1.5px]">
              <div className="pixel-corners-sm bg-[#12131a] hover:bg-rose-950/40 text-rose-300 hover:text-white font-retro text-xs font-bold uppercase tracking-wider h-8 px-3.5 flex items-center gap-1.5 transition-colors">
                <LogOut className="size-3.5" />
                <span>{loggingOut ? "Signing out..." : "Sign Out"}</span>
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
