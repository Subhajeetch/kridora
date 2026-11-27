import { useEffect } from "react";
import { DoorOpen, LogOut } from "lucide-react";
import type { PocketWarPhase } from "../types";

export interface LeaveMatchDialogProps {
  open: boolean;
  phase: PocketWarPhase;
  roomCode: string;
  isLastActivePlayer: boolean;
  isLeaving: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * In-match leave confirmation modal modeled after Ludo's LeaveConfirmDialog.
 * Renders cleanly inside Pocket War's fullscreen container and strictly exits
 * only the match while keeping the player inside the room.
 */
export function LeaveMatchDialog({
  open,
  phase,
  roomCode,
  isLastActivePlayer,
  isLeaving,
  error,
  onCancel,
  onConfirm,
}: LeaveMatchDialogProps) {
  useEffect(() => {
    if (!open || isLeaving) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, isLeaving, onCancel]);

  if (!open) return null;

  let description: string;
  if (isLastActivePlayer) {
    description =
      "You are the last active player in this match. Leaving will end the match immediately and return everyone to the room lobby — you will stay in the room.";
  } else if (phase === "setup") {
    description =
      "You will leave pre-match setup and return to the room view. You will stay in the room.";
  } else {
    description =
      "You will forfeit this battle and return to the room. Remaining players will finish the match, and you will stay in the room.";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-leave-match-title"
      onClick={() => {
        if (!isLeaving) onCancel();
      }}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-500/35 bg-slate-900/95 p-5 text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="pw-leave-match-title"
              className="text-base font-black tracking-wide text-white uppercase sm:text-lg"
            >
              Leave Match?
            </h2>
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
              <DoorOpen className="h-3.5 w-3.5" />
              <span>Stay in Room {roomCode}</span>
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
          {description}
        </p>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-500/40 bg-rose-950/80 px-3 py-2 text-xs text-rose-200"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLeaving}
            onClick={onCancel}
            className="rounded-xl border border-white/15 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Stay in Match
          </button>
          <button
            type="button"
            disabled={isLeaving}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black tracking-wide text-white uppercase transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLeaving ? "Leaving Match..." : "Leave Match"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
