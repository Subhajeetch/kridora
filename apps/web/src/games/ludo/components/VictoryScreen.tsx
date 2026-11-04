import { Crown, DoorOpen, Eye, Trophy } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AudioSettings } from "@/lib/audio-settings";
import { cn } from "@/lib/utils";
import type { LudoGameState, LudoPlayerState } from "@kridora/shared";
import { LUDO_HOME_STEP } from "@kridora/shared";
import { ludoAudio } from "../audio";
import { SEAT_DEFINITIONS } from "../constants";

interface VictoryScreenProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LudoGameState;
  userId: string;
  isRoomOwner: boolean;
  playerAvatars: Record<string, string | null | undefined>;
  audioSettings: AudioSettings;
  onEndGame: () => Promise<void> | void;
}

export function VictoryScreen({
  open,
  onOpenChange,
  state,
  userId,
  isRoomOwner,
  playerAvatars,
  audioSettings,
  onEndGame,
}: VictoryScreenProps) {
  const winnerPlayer = state.winnerId
    ? state.players.find((p) => p.userId === state.winnerId)
    : undefined;

  const winnerSeat = winnerPlayer
    ? SEAT_DEFINITIONS[winnerPlayer.color]
    : undefined;

  const isLocalWinner = winnerPlayer?.userId === userId;

  // Ensure victory fanfare plays exactly once per match completion
  const playedSoundRef = useRef<string | null>(null);

  useEffect(() => {
    if (open && state.winnerId && playedSoundRef.current !== state.winnerId) {
      playedSoundRef.current = state.winnerId;
      ludoAudio.victory(audioSettings);
    }
  }, [open, state.winnerId, audioSettings]);

  // Compute standings by home tokens, then by track progress
  const sortedStandings: LudoPlayerState[] = [...state.players].sort((a, b) => {
    const aHome = a.tokens.filter((s) => s === LUDO_HOME_STEP).length;
    const bHome = b.tokens.filter((s) => s === LUDO_HOME_STEP).length;
    if (bHome !== aHome) return bHome - aHome;
    const aProgress = a.tokens.reduce((acc, s) => acc + Math.max(0, s), 0);
    const bProgress = b.tokens.reduce((acc, s) => acc + Math.max(0, s), 0);
    return bProgress - aProgress;
  });

  if (!winnerPlayer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden border border-amber-400/40 bg-[#121422]/98 p-0 text-white shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <DialogCloseButton
          onClick={() => onOpenChange(false)}
          className="z-20 top-4 right-4"
        />

        {/* Ambient Top Glow in Winner Seat Color */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full opacity-35 blur-3xl"
          style={{
            backgroundColor: winnerSeat ? winnerSeat.boardHex : "#fbbf24",
          }}
        />

        {/* Hero Banner Section */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-8 pb-5 text-center">
          {/* Celebratory Floating Sparkles & Confetti Background */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Pulsing Aura Rings */}
            <div className="absolute size-24 animate-ping rounded-full bg-amber-400/20 duration-1000" />
            <div className="absolute size-20 rounded-full bg-gradient-to-tr from-amber-500/30 to-amber-300/40 blur-md" />

            {/* Golden Trophy Medallion */}
            <div className="relative grid size-16 place-items-center rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-400/30 to-amber-600/20 text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.35)]">
              <Trophy className="size-8 drop-shadow-md text-amber-300" />
            </div>

            <Crown className="absolute -top-3.5 size-7 text-amber-400 animate-bounce" />
          </div>

          <DialogTitle className="mt-2 text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isLocalWinner ? "Victory! You Won!" : `${winnerPlayer.name} Wins!`}
          </DialogTitle>

          <DialogDescription className="mt-1 max-w-sm text-xs sm:text-sm text-slate-300">
            {isLocalWinner
              ? "All 4 of your tokens safely conquered the board and entered Home!"
              : `${winnerPlayer.name} guided all 4 tokens into the center goal.`}
          </DialogDescription>

          {/* Champion Spotlight Card */}
          <div
            className="mt-4 flex w-full max-w-sm items-center justify-between rounded-2xl border p-3 shadow-lg"
            style={{
              borderColor: `${winnerSeat?.boardHex ?? "#fbbf24"}55`,
              backgroundColor: `${winnerSeat?.boardHex ?? "#fbbf24"}14`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="relative size-12 shrink-0 overflow-hidden rounded-full border-2 shadow-md"
                style={{
                  borderColor: winnerSeat?.boardHex ?? "#fbbf24",
                }}
              >
                {playerAvatars[winnerPlayer.userId] ? (
                  <img
                    src={playerAvatars[winnerPlayer.userId] ?? undefined}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div
                    className="grid size-full place-items-center text-sm font-black text-white"
                    style={{ backgroundColor: winnerSeat?.boardHex }}
                  >
                    {winnerPlayer.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-base font-bold text-white">
                    {winnerPlayer.name}
                  </p>
                  {isLocalWinner && (
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                    style={{
                      backgroundColor: `${winnerSeat?.boardHex}33`,
                      color: winnerSeat?.boardHex,
                    }}
                  >
                    {winnerSeat?.name} Team
                  </span>
                  <span className="text-[11px] font-semibold text-amber-300">
                    Champion 🏆
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right font-mono font-bold">
              <span className="text-xl text-amber-400">4 / 4</span>
              <p className="text-[10px] font-semibold text-slate-400">
                Finished
              </p>
            </div>
          </div>
        </div>

        {/* Match Final Standings */}
        <div className="border-t border-white/10 bg-black/25 px-5 sm:px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Final Standings
          </p>

          <div className="space-y-2">
            {sortedStandings.map((p, rankIdx) => {
              const seat = SEAT_DEFINITIONS[p.color];
              const homeCount = p.tokens.filter(
                (s) => s === LUDO_HOME_STEP,
              ).length;
              const isWinner = p.userId === state.winnerId;
              const isSelf = p.userId === userId;
              const avatar = playerAvatars[p.userId];

              const rankBadges = [
                {
                  text: "#1",
                  bg: "bg-amber-400 text-slate-950",
                  border: "border-amber-400",
                },
                {
                  text: "#2",
                  bg: "bg-slate-300 text-slate-950",
                  border: "border-slate-300/40",
                },
                {
                  text: "#3",
                  bg: "bg-amber-700/80 text-amber-100",
                  border: "border-amber-700/40",
                },
                {
                  text: "#4",
                  bg: "bg-white/10 text-slate-400",
                  border: "border-white/10",
                },
              ];

              const currentBadge = rankBadges[rankIdx] ?? rankBadges[3]!;

              return (
                <div
                  key={p.userId}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2.5 transition-all",
                    isWinner
                      ? "border-amber-400/60 bg-amber-400/10 text-white shadow-sm"
                      : "border-white/10 bg-white/[0.02] text-slate-200",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-lg text-xs font-black shadow-sm",
                        currentBadge.bg,
                      )}
                    >
                      {currentBadge.text}
                    </span>

                    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-white/30 bg-slate-800">
                      {avatar ? (
                        <img
                          src={avatar ?? undefined}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span
                          className="grid size-full place-items-center text-xs font-bold text-white"
                          style={{ backgroundColor: seat.boardHex }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">
                          {p.name}
                        </span>
                        {isSelf && (
                          <span className="rounded bg-white/15 px-1 text-[9px] font-bold text-slate-200">
                            YOU
                          </span>
                        )}
                        {p.userId === state.winnerId && (
                          <Crown className="size-3 text-amber-400" />
                        )}
                      </div>
                      <span
                        className="rounded px-1 text-[10px] font-bold uppercase"
                        style={{
                          backgroundColor: `${seat.boardHex}33`,
                          color: seat.boardHex,
                        }}
                      >
                        {seat.name}
                      </span>
                    </div>
                  </div>

                  {/* Token dots & Home progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3].map((dotIdx) => (
                        <span
                          key={dotIdx}
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor:
                              dotIdx < homeCount
                                ? seat.boardHex
                                : "rgba(255,255,255,0.15)",
                            boxShadow:
                              dotIdx < homeCount
                                ? `0 0 6px ${seat.boardHex}`
                                : "none",
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-300 min-w-10 text-right">
                      {homeCount} / 4
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 bg-[#0e101a] px-5 sm:px-6 py-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-1.5 rounded-xl border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <Eye className="size-3.5" />
            <span>View Board</span>
          </Button>

          {isRoomOwner ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void onEndGame()}
              className="gap-1.5 rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 shadow-md active:scale-95 transition-all"
            >
              <DoorOpen className="size-4" />
              <span>Return to Lobby</span>
            </Button>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Waiting for host to return to lobby...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
