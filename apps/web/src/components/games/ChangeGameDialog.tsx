import type { GameSlug } from "@kridora/shared";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Gamepad2,
  Loader2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { enabledGames } from "@/config/games";
import { cn } from "@/lib/utils";

interface ChangeGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSlug: GameSlug;
  playerCount: number;
  onSelectGame: (slug: GameSlug) => Promise<void>;
  disabled?: boolean;
}

export function ChangeGameDialog({
  open,
  onOpenChange,
  currentSlug,
  playerCount,
  onSelectGame,
  disabled = false,
}: ChangeGameDialogProps) {
  const [pendingSlug, setPendingSlug] = useState<GameSlug | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(slug: GameSlug) {
    if (disabled || pendingSlug || slug === currentSlug) return;
    setError(null);
    setPendingSlug(slug);
    try {
      await onSelectGame(slug);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to change game. Please try again.",
      );
    } finally {
      setPendingSlug(null);
    }
  }

  const isBusy = disabled || pendingSlug !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(34,228,255,0.2)]">
                <Gamepad2 className="size-5" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                Change Room Game
              </DialogTitle>
            </div>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Select a game to switch to. All players in the room will stay
              connected and automatically transition to the new game.
            </DialogDescription>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Games List */}
        <div className="mt-5 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {enabledGames.map((game) => {
            const slug = game.slug as GameSlug;
            const isCurrent = slug === currentSlug;
            const tooManyPlayers = playerCount > game.maxPlayers;
            const isPendingThis = pendingSlug === slug;
            const isSelectable = !isCurrent && !tooManyPlayers && !isBusy;

            return (
              <button
                type="button"
                key={game.slug}
                disabled={!isSelectable}
                onClick={() => void handleSelect(slug)}
                className={cn(
                  "group relative flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border p-3.5 sm:p-4 text-left transition-all outline-none",
                  isCurrent
                    ? "border-neon-cyan/50 bg-neon-cyan/5 shadow-[0_0_16px_rgba(34,228,255,0.08)] cursor-default"
                    : tooManyPlayers
                      ? "border-white/5 bg-background/20 opacity-60 cursor-not-allowed"
                      : "border-white/10 bg-background/40 hover:border-neon-cyan/40 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer active:scale-[0.99]",
                )}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-md">
                    <GameThumbnail
                      slug={game.slug}
                      name={game.name}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base text-foreground tracking-tight">
                        {game.name}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/40 bg-neon-cyan/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-neon-cyan">
                          <Check className="size-3" /> Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {game.tagline}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3 text-neon-pink" />
                        <span>
                          {game.minPlayers}–{game.maxPlayers} players
                        </span>
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>{game.playTime}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-neon-cyan">
                      Playing Now
                    </span>
                  ) : tooManyPlayers ? (
                    <span className="text-xs font-medium text-amber-400 text-right">
                      Max {game.maxPlayers} players
                      <br />
                      <span className="text-[11px] text-muted-foreground">
                        ({playerCount} currently in room)
                      </span>
                    </span>
                  ) : (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all shadow-sm",
                        isPendingThis
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 group-hover:bg-primary group-hover:text-primary-foreground text-foreground",
                      )}
                    >
                      {isPendingThis ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Switching...</span>
                        </>
                      ) : (
                        <>
                          <span>Select</span>
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
