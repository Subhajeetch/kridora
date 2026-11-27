import { useEffect, useState } from "react";
import type { RoomPlayer } from "@kridora/shared";
import { AlertTriangle, Clock, LogOut, UserX, WifiOff } from "lucide-react";
import { POCKET_WAR_LIMITS } from "../types";

export interface OfflineWaitModalProps {
  soloWaitEndsAt: number | null;
  soloBannerDismissed: boolean;
  offlinePlayers: readonly RoomPlayer[];
  totalRoomPlayers: number;
  isRoomOwner: boolean;
  mapName: string;
  onDismissToBanner: () => void;
  onExpandFromBanner: () => void;
  onRequestLeaveMatch: () => void;
  onKickPlayer: (targetUserId: string) => Promise<void>;
}

function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Ludo-inspired offline/solo wait screen for Pocket War.
 * Lets disconnected players hold their seat cleanly while giving remaining
 * players clear Kick (host, 3+ room) and Leave Match (stay in room) controls.
 */
export function OfflineWaitModal({
  soloWaitEndsAt,
  soloBannerDismissed,
  offlinePlayers,
  totalRoomPlayers,
  isRoomOwner,
  mapName,
  onDismissToBanner,
  onExpandFromBanner,
  onRequestLeaveMatch,
  onKickPlayer,
}: OfflineWaitModalProps) {
  const [clockMs, setClockMs] = useState<number>(() => Date.now());
  const [kickTarget, setKickTarget] = useState<RoomPlayer | null>(null);
  const [kickBusy, setKickBusy] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);

  useEffect(() => {
    if (soloWaitEndsAt === null) return;
    const timer = window.setInterval(() => {
      setClockMs(Date.now());
    }, 500);
    return () => window.clearInterval(timer);
  }, [soloWaitEndsAt]);

  if (soloWaitEndsAt === null) return null;

  const msRemaining = Math.max(0, soloWaitEndsAt - clockMs);
  const formatted = formatCountdown(msRemaining);
  const remainingPct = Math.max(
    0,
    Math.min(100, (msRemaining / POCKET_WAR_LIMITS.SOLO_WAIT_GRACE_MS) * 100),
  );
  const primaryOffline = offlinePlayers[0] ?? null;

  async function handleKickConfirm() {
    if (!kickTarget || kickBusy) return;
    setKickBusy(true);
    setKickError(null);
    try {
      await onKickPlayer(kickTarget.userId);
      setKickTarget(null);
    } catch (err) {
      setKickError(
        err instanceof Error && err.message
          ? err.message
          : "Could not remove disconnected player.",
      );
    } finally {
      setKickBusy(false);
    }
  }

  if (soloBannerDismissed) {
    return (
      <div className="pointer-events-auto fixed top-14 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/60 bg-slate-950/92 px-3 py-1 text-[11px] font-bold text-amber-200 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={onExpandFromBanner}
          className="flex items-center gap-1.5 text-amber-200 hover:text-white"
          title="Open wait details"
        >
          <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {primaryOffline
              ? `Waiting for ${primaryOffline.name} (${formatted})`
              : `Waiting for rivals (${formatted})`}
          </span>
        </button>
        <button
          type="button"
          onClick={onRequestLeaveMatch}
          className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black text-white transition hover:bg-rose-500"
        >
          <LogOut className="h-3 w-3" />
          <span>Leave Match</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/76 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-offline-wait-title"
      >
        <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl border-2 border-amber-400/50 bg-slate-900/95 p-5 text-center text-slate-100 shadow-2xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 text-amber-300">
            {primaryOffline ? (
              <WifiOff className="h-6 w-6 animate-pulse" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>

          <h2
            id="pw-offline-wait-title"
            className="text-lg font-black tracking-wide text-white uppercase"
          >
            {offlinePlayers.length > 1
              ? "Opponents Disconnected"
              : primaryOffline
                ? "Opponent Disconnected"
                : "Last Player in Match"}
          </h2>
          <p className="mt-1 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
            {mapName} • Return to Room Without Leaving Room
          </p>

          {primaryOffline && (
            <div className="mt-3.5 space-y-1.5 text-left">
              {offlinePlayers.slice(0, 2).map((rp) => (
                <div
                  key={rp.userId}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-800/70 p-2.5"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-amber-400 bg-slate-700">
                    {rp.image ? (
                      <img
                        src={rp.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-sm font-black text-amber-300">
                        {rp.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {rp.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Connection lost · Waiting to rejoin
                    </p>
                  </div>
                </div>
              ))}
              {offlinePlayers.length > 2 && (
                <p className="text-center text-[11px] text-slate-400">
                  +{offlinePlayers.length - 2} more disconnected
                </p>
              )}
            </div>
          )}

          <div className="mt-3.5 rounded-2xl border border-white/10 bg-black/40 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-semibold">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Auto-return to lobby</span>
              </span>
              <span className="font-mono text-base font-black text-amber-300">
                {formatted}
              </span>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                style={{ width: `${remainingPct}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              {primaryOffline
                ? "Waiting for disconnected player(s) to reconnect. You can wait in the arena or leave the match to return cleanly to the room lobby."
                : "No opponents remain in this match. You can stay in the arena or leave the match to return cleanly to the room lobby."}
            </p>
          </div>

          {kickError && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/80 px-3 py-2 text-xs text-rose-200"
            >
              {kickError}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {isRoomOwner && primaryOffline && totalRoomPlayers > 2 && (
              <button
                type="button"
                onClick={() => {
                  setKickError(null);
                  setKickTarget(primaryOffline);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-black tracking-wide text-rose-200 uppercase transition hover:bg-rose-500/25"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Kick</span>
              </button>
            )}

            <button
              type="button"
              onClick={onDismissToBanner}
              className="flex-1 rounded-xl border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-black tracking-wider text-white uppercase transition hover:bg-slate-700"
            >
              Wait in Arena
            </button>

            <button
              type="button"
              onClick={onRequestLeaveMatch}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black tracking-wider text-white uppercase transition hover:bg-rose-500"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave Match</span>
            </button>
          </div>
        </div>
      </div>

      {/* Host Kick Disconnected Player Confirmation Modal */}
      {kickTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!kickBusy) setKickTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-500/35 bg-slate-900 p-5 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-rose-500/35 bg-rose-500/15 text-rose-300">
                <UserX className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Kick {kickTarget.name}?
                </h3>
                <p className="text-xs text-rose-300">Host action required</p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
              Removing{" "}
              <strong className="font-bold text-white">
                {kickTarget.name}
              </strong>{" "}
              from the room will forfeit their remaining lives so the match can
              continue.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={kickBusy}
                onClick={() => setKickTarget(null)}
                className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={kickBusy}
                onClick={() => void handleKickConfirm()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {kickBusy ? "Removing..." : "Kick Player"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
