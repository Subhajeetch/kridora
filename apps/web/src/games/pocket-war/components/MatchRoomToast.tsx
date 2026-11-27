import { useEffect, useRef, useState } from "react";
import type { RoomPlayer } from "@kridora/shared";
import { UserCheck, UserMinus, Wifi, WifiOff } from "lucide-react";
import type { SoundFX } from "../engine/SoundFX";
import type { PocketWarPlayer } from "../types";

interface ToastItem {
  id: string;
  kind: "join" | "leave_room" | "leave_match" | "offline" | "reconnect";
  playerName: string;
  image: string | null;
}

interface MatchRoomToastProps {
  players: readonly RoomPlayer[];
  matchPlayers: Record<string, PocketWarPlayer>;
  currentUserId: string;
  soundFx: SoundFX;
}

const TOAST_TTL_MS = 3800;

interface TrackedPlayerState {
  name: string;
  image: string | null;
  connected: boolean;
  leftMatch: boolean;
}

/**
 * Displays live join, leave, disconnect, and reconnect notifications inside
 * Pocket War while keeping all players informed without blocking gameplay.
 */
export function MatchRoomToast({
  players,
  matchPlayers,
  currentUserId,
  soundFx,
}: MatchRoomToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prevStateRef = useRef<Map<string, TrackedPlayerState> | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());
  const soundRef = useRef(soundFx);

  useEffect(() => {
    soundRef.current = soundFx;
  }, [soundFx]);

  useEffect(() => {
    const timerMap = timersRef.current;
    return () => {
      timerMap.forEach((timerId) => window.clearTimeout(timerId));
      timerMap.clear();
    };
  }, []);

  useEffect(() => {
    const current = new Map<string, TrackedPlayerState>();
    for (const rp of players) {
      current.set(rp.userId, {
        name: rp.name,
        image: rp.image ?? null,
        connected: rp.connected,
        leftMatch: Boolean(matchPlayers[rp.userId]?.leftMatch),
      });
    }

    if (prevStateRef.current === null) {
      prevStateRef.current = current;
      return;
    }

    const prev = prevStateRef.current;
    prevStateRef.current = current;

    const additions: ToastItem[] = [];
    const now = Date.now();

    for (const [uid, info] of current.entries()) {
      if (uid === currentUserId) continue;
      const old = prev.get(uid);
      if (!old) {
        additions.push({
          id: `join-${uid}-${now}`,
          kind: "join",
          playerName: info.name,
          image: info.image,
        });
      } else {
        if (!old.leftMatch && info.leftMatch) {
          additions.push({
            id: `leave-match-${uid}-${now}`,
            kind: "leave_match",
            playerName: info.name,
            image: info.image,
          });
        } else if (old.connected && !info.connected) {
          additions.push({
            id: `offline-${uid}-${now}`,
            kind: "offline",
            playerName: info.name,
            image: info.image,
          });
        } else if (!old.connected && info.connected) {
          additions.push({
            id: `reconnect-${uid}-${now}`,
            kind: "reconnect",
            playerName: info.name,
            image: info.image,
          });
        }
      }
    }

    for (const [uid, old] of prev.entries()) {
      if (uid === currentUserId) continue;
      if (!current.has(uid)) {
        additions.push({
          id: `leave-room-${uid}-${now}`,
          kind: "leave_room",
          playerName: old.name,
          image: old.image,
        });
      }
    }

    if (additions.length === 0) return;

    const hasPositive = additions.some(
      (a) => a.kind === "join" || a.kind === "reconnect",
    );
    if (hasPositive) {
      soundRef.current.playUiClick();
    } else {
      soundRef.current.playUiSwitch();
    }

    queueMicrotask(() => {
      setToasts((existing) => [...existing, ...additions].slice(-4));
      for (const item of additions) {
        const timerId = window.setTimeout(() => {
          timersRef.current.delete(item.id);
          setToasts((existing) => existing.filter((t) => t.id !== item.id));
        }, TOAST_TTL_MS);
        timersRef.current.set(item.id, timerId);
      }
    });
  }, [players, matchPlayers, currentUserId]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-14 right-3 z-50 flex w-64 max-w-[82vw] flex-col gap-1.5 sm:top-16 sm:right-4 sm:w-72">
      {toasts.map((toast) => {
        const styleMap = {
          join: {
            border: "border-emerald-500/45 text-emerald-200",
            badge: "bg-emerald-500/20 text-emerald-400",
            label: "Joined the room",
            icon: <UserCheck className="h-4 w-4" />,
          },
          reconnect: {
            border: "border-sky-400/45 text-sky-200",
            badge: "bg-sky-500/20 text-sky-300",
            label: "Reconnected",
            icon: <Wifi className="h-4 w-4" />,
          },
          offline: {
            border: "border-amber-400/45 text-amber-200",
            badge: "bg-amber-500/20 text-amber-300",
            label: "Went offline",
            icon: <WifiOff className="h-4 w-4" />,
          },
          leave_match: {
            border: "border-amber-500/45 text-amber-100",
            badge: "bg-amber-500/20 text-amber-300",
            label: "Left match (in room)",
            icon: <UserMinus className="h-4 w-4" />,
          },
          leave_room: {
            border: "border-rose-500/45 text-rose-200",
            badge: "bg-rose-500/20 text-rose-400",
            label: "Left the room",
            icon: <UserMinus className="h-4 w-4" />,
          },
        }[toast.kind];

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border bg-slate-950/92 p-2.5 shadow-2xl backdrop-blur-md transition-all ${styleMap.border}`}
          >
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-xl ${styleMap.badge}`}
            >
              {toast.image ? (
                <img
                  src={toast.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                styleMap.icon
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-white">
                {toast.playerName}
              </p>
              <p className="text-[10px] font-semibold opacity-90">
                {styleMap.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
