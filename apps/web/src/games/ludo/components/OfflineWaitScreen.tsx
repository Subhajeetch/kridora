import { AlertTriangle, Clock, DoorOpen, UserX, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { RoomPlayer } from "@kridora/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface OfflineWaitScreenProps {
  offlinePlayers: RoomPlayer[];
  totalMatchPlayers: number;
  isRoomOwner: boolean;
  onKickPlayer: (targetUserId: string) => Promise<void>;
  onEndGame: () => Promise<void>;
  onTimeout?: (targetUserId: string) => void;
  playerAvatars: Record<string, string | null>;
}

export function OfflineWaitScreen({
  offlinePlayers,
  totalMatchPlayers,
  isRoomOwner,
  onKickPlayer,
  onEndGame,
  onTimeout,
  playerAvatars,
}: OfflineWaitScreenProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(300); // 5 minutes
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [endGameDialogOpen, setEndGameDialogOpen] = useState(false);
  const [endGameCountdown, setEndGameCountdown] = useState(5);
  const [isBusy, setIsBusy] = useState(false);

  const primaryOffline = offlinePlayers[0];
  const avatarUrl = primaryOffline
    ? (playerAvatars[primaryOffline.userId] ?? primaryOffline.image)
    : null;

  // 5-minute countdown timer
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          if (primaryOffline && onTimeout) {
            onTimeout(primaryOffline.userId);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [primaryOffline, onTimeout]);

  // 5-second countdown for End Game dialog button
  useEffect(() => {
    if (!endGameDialogOpen) {
      setEndGameCountdown(5);
      return;
    }

    setEndGameCountdown(5);
    const interval = window.setInterval(() => {
      setEndGameCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [endGameDialogOpen]);

  if (!primaryOffline) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progressPct = ((300 - secondsRemaining) / 300) * 100;

  async function handleKickConfirm() {
    if (isBusy || !primaryOffline) return;
    setIsBusy(true);
    try {
      await onKickPlayer(primaryOffline.userId);
      setKickDialogOpen(false);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEndGameConfirm() {
    if (isBusy || endGameCountdown > 0) return;
    setIsBusy(true);
    try {
      await onEndGame();
      setEndGameDialogOpen(false);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl border-2 border-amber-500/50 bg-slate-900/95 p-6 text-center text-slate-100 shadow-2xl shadow-amber-500/10">
          {/* Header icon and pulse indicator */}
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <WifiOff className="size-7 animate-pulse" />
          </div>

          <h2 className="mt-4 text-xl font-black tracking-tight text-white">
            Player Disconnected
          </h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
            Match is Paused
          </p>

          {/* Offline Player Card */}
          <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-800/60 p-3">
            <div className="size-11 shrink-0 overflow-hidden rounded-full border-2 border-amber-400 bg-slate-700">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center font-black text-amber-300">
                  {primaryOffline.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-left min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {primaryOffline.name}
              </p>
              <p className="text-xs text-slate-400">
                Connection lost · Tab closed or network drop
              </p>
            </div>
          </div>

          {/* 5-Minute Timer Display */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-amber-400" /> Auto-removal in
              </span>
              <span className="font-mono text-base font-black text-amber-300">
                {formattedTime}
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-1000"
                style={{ width: `${100 - progressPct}%` }}
              />
            </div>

            <p className="mt-2.5 text-[11px] text-slate-400">
              Waiting for player to reconnect. If they do not return in 5
              minutes, their pieces will automatically be removed.
            </p>
          </div>

          {/* Room Owner Action Controls */}
          {isRoomOwner ? (
            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                {/* If > 2 players originally in the game, show Kick Player */}
                {totalMatchPlayers > 2 && (
                  <Button
                    variant="outline"
                    onClick={() => setKickDialogOpen(true)}
                    className="flex-1 h-10 gap-1.5 rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-400 text-xs font-bold"
                  >
                    <UserX className="size-4" />
                    <span>Kick Player</span>
                  </Button>
                )}

                {/* End Game Button */}
                <Button
                  variant="outline"
                  onClick={() => setEndGameDialogOpen(true)}
                  className="flex-1 h-10 gap-1.5 rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 text-xs font-bold"
                >
                  <DoorOpen className="size-4" />
                  <span>End Game</span>
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-xs text-slate-400 italic">
              Waiting for room host or player reconnection...
            </p>
          )}
        </div>
      </div>

      {/* 1. KICK PLAYER CONFIRMATION DIALOG */}
      <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <DialogContent className="max-w-md border-rose-500/30 bg-slate-900 text-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-11 shrink-0 overflow-hidden rounded-full border-2 border-rose-400 bg-slate-800">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <span className="grid size-full place-items-center font-black text-rose-300">
                  {primaryOffline.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Kick Player {primaryOffline.name}?
              </DialogTitle>
              <p className="text-xs text-rose-300">Host action required</p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-sm text-slate-300 leading-relaxed">
            If you kick the player,{" "}
            <strong className="font-bold text-white">
              all the pieces will be removed
            </strong>
            . He might join back in 5 min; if he doesn't, their pieces will
            automatically be removed.
          </DialogDescription>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setKickDialogOpen(false)}
              disabled={isBusy}
              className="rounded-xl text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleKickConfirm}
              disabled={isBusy}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-500"
            >
              {isBusy ? "Removing..." : "Kick Player"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. END GAME CONFIRMATION DIALOG (DISABLED FOR 5 SECONDS) */}
      <Dialog open={endGameDialogOpen} onOpenChange={setEndGameDialogOpen}>
        <DialogContent className="max-w-md border-amber-500/30 bg-slate-900 text-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                End Match Early?
              </DialogTitle>
              <p className="text-xs text-amber-300">
                Return all players to lobby
              </p>
            </div>
          </div>

          <DialogDescription className="mt-3 text-sm text-slate-300 leading-relaxed">
            If you end game, all the progress of this game will be removed and
            you'll return to lobby.
          </DialogDescription>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEndGameDialogOpen(false)}
              disabled={isBusy}
              className="rounded-xl text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndGameConfirm}
              disabled={isBusy || endGameCountdown > 0}
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white min-w-[120px]"
            >
              {isBusy
                ? "Ending..."
                : endGameCountdown > 0
                  ? `End Game (${endGameCountdown}s)`
                  : "End Game"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
