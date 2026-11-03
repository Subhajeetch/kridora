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
  DialogCloseButton,
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
      <DialogContent className="max-w-2xl">
        <DialogCloseButton onClick={() => onOpenChange(false)} />

        <div className="flex items-start justify-between gap-3 pr-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="pixel-corners-sm bg-[#facc15] p-[2px] shrink-0 filter drop-shadow-[0_2px_0_#78350f]">
                <div className="grid size-8 place-items-center pixel-corners-sm bg-[#12131a] text-[#facc15]">
                  <Gamepad2 className="size-5" />
                </div>
              </div>
              <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
                Change Room Game
              </DialogTitle>
            </div>
            <DialogDescription className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Select a game to switch to. All players in the room will stay
              connected and automatically transition to the new game.
            </DialogDescription>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 pixel-corners-sm bg-destructive p-[2px] filter drop-shadow-[0_2px_0_#881337]">
            <div className="flex items-start gap-2.5 pixel-corners-sm bg-[#1a0a0d] px-3.5 py-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
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
              <div
                key={game.slug}
                className={cn(
                  "relative filter transition-all",
                  isCurrent
                    ? "drop-shadow-[0_4px_0_#78350f]"
                    : isSelectable
                      ? "drop-shadow-[0_3px_0_#000000] hover:drop-shadow-[0_4px_0_#78350f]"
                      : "opacity-60",
                )}
              >
                <div
                  className={cn(
                    "pixel-corners-sm p-[2px] transition-colors",
                    isCurrent
                      ? "bg-[#facc15]"
                      : isSelectable
                        ? "bg-white/15 hover:bg-[#facc15]"
                        : "bg-white/5",
                  )}
                >
                  <button
                    type="button"
                    disabled={!isSelectable}
                    onClick={() => void handleSelect(slug)}
                    className="group flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3.5 pixel-corners-sm bg-[#12131a] p-3 sm:p-3.5 text-left outline-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="pixel-corners-sm bg-white/20 p-[1.5px] shrink-0">
                        <div className="relative size-14 overflow-hidden pixel-corners-sm bg-black/60 shadow-md">
                          <GameThumbnail
                            slug={game.slug}
                            name={game.name}
                            className="size-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-base text-foreground tracking-tight">
                            {game.name}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 pixel-corners-sm bg-[#facc15] text-black px-1.5 py-0.5 text-[9px] font-retro font-bold uppercase tracking-wider">
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
                        <span className="text-xs font-retro font-bold text-neon-cyan uppercase">
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
                            "inline-flex items-center gap-1.5 pixel-corners-sm px-3 py-1.5 text-xs font-retro font-bold uppercase transition-all shadow-sm",
                            isPendingThis
                              ? "bg-primary text-primary-foreground"
                              : "bg-white/10 group-hover:bg-[#facc15] group-hover:text-black text-foreground",
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
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="pixel-corners-sm"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
