import { AnimatePresence, motion } from "framer-motion";
import { UserCheck, UserMinus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RoomPlayer } from "@kridora/shared";
import type { AudioSettings } from "@/lib/audio-settings";
import { ludoAudio } from "../audio";

interface ToastMessage {
  id: string;
  type: "join" | "leave";
  playerName: string;
  avatarUrl?: string | null;
}

interface RoomToastProps {
  players: readonly RoomPlayer[];
  audioSettings?: AudioSettings;
}

export function RoomToast({ players, audioSettings }: RoomToastProps) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const previousPlayersRef = useRef<Map<string, RoomPlayer> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const currentMap = new Map<string, RoomPlayer>();
    players.forEach((p) => currentMap.set(p.userId, p));

    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPlayersRef.current = currentMap;
      return;
    }

    const prevMap = previousPlayersRef.current ?? new Map<string, RoomPlayer>();
    previousPlayersRef.current = currentMap;

    const newToasts: ToastMessage[] = [];

    // Detect players who joined
    for (const [userId, player] of currentMap.entries()) {
      if (!prevMap.has(userId)) {
        newToasts.push({
          id: `join-${userId}-${Date.now()}`,
          type: "join",
          playerName: player.name,
          avatarUrl: player.image,
        });
        ludoAudio.roomJoin(audioSettings);
      }
    }

    // Detect players who left
    for (const [userId, player] of prevMap.entries()) {
      if (!currentMap.has(userId)) {
        newToasts.push({
          id: `leave-${userId}-${Date.now()}`,
          type: "leave",
          playerName: player.name,
          avatarUrl: player.image,
        });
        ludoAudio.roomLeave(audioSettings);
      }
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts]);
    }
  }, [players, audioSettings]);

  // Auto-dismiss toasts after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className={`flex items-center gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl pointer-events-auto ${
              toast.type === "join"
                ? "border-emerald-500/40 bg-slate-900/90 text-emerald-200"
                : "border-rose-500/40 bg-slate-900/90 text-rose-200"
            }`}
          >
            <div
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                toast.type === "join"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/20 text-rose-400"
              }`}
            >
              {toast.type === "join" ? (
                <UserCheck className="size-5" />
              ) : (
                <UserMinus className="size-5" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">
                {toast.playerName}
              </p>
              <p className="text-[11px] font-medium opacity-80">
                {toast.type === "join" ? "joined the room" : "left the room"}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
