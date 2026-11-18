import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown } from "lucide-react";
import type { BusinessPlayer } from "@kridora/shared";

interface PlayerCornerCardProps {
  player: BusinessPlayer;
  isMe: boolean;
  isTurn: boolean;
  isHost: boolean;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export function PlayerCornerCard({
  player,
  isMe,
  isTurn,
  isHost,
  position,
}: PlayerCornerCardProps) {
  const remainingJail = Math.max(1, 3 - player.jailTurns);
  const isRight = position.includes("right");

  const [activeEmote, setActiveEmote] = useState<{
    emoji: string;
    timestamp: number;
  } | null>(null);

  // Reaction emote popup: pops up smoothly, floats up, and disappears after 1.5 seconds
  useEffect(() => {
    if (!player.lastEmote) {
      return;
    }
    const age = Date.now() - player.lastEmote.timestamp;
    if (age >= 1500) {
      return;
    }

    const emote = player.lastEmote;
    // Defer state update to next animation frame to prevent cascading render cycles
    const frameId = requestAnimationFrame(() => {
      setActiveEmote(emote);
    });

    const timer = window.setTimeout(() => {
      setActiveEmote(null);
    }, 1500 - age);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timer);
    };
  }, [player.lastEmote]);

  return (
    <div
      className={`relative z-20 flex min-w-0 max-w-[138px] items-center gap-1 rounded-xl border p-1 shadow-xl transition-all duration-300 sm:max-w-[175px] sm:min-w-[130px] sm:gap-2 sm:rounded-xl sm:p-1.5 lg:max-w-[220px] lg:min-w-[155px] lg:gap-2.5 lg:rounded-2xl lg:p-2.5 ${
        player.isBankrupt
          ? "border-red-900/30 bg-[#0b0f19]/70 opacity-40 grayscale"
          : isTurn
            ? "border-sky-400/90 bg-[#141e33] shadow-[0_0_20px_rgba(56,189,248,0.25)] ring-2 ring-sky-400/40 scale-[1.02]"
            : "border-white/10 bg-[#0d1322]/95 hover:border-white/20"
      }`}
    >
      {/* 3D Puck Avatar with Player's Assigned Color Ring */}
      <div className="relative shrink-0">
        <div
          style={{ borderColor: player.color }}
          className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 shadow-md sm:h-8 sm:w-8 lg:h-9 lg:w-9"
        >
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt={player.username}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              style={{ backgroundColor: player.color }}
              className="flex h-full w-full items-center justify-center text-[9px] font-black text-white sm:text-xs"
            >
              {player.username.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Small Puck Color Dot */}
        <span
          style={{ backgroundColor: player.color }}
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-slate-950 shadow sm:h-2.5 sm:w-2.5 sm:border lg:h-3 lg:w-3"
        />
      </div>

      {/* Info Column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 sm:gap-1.5">
          {isHost && (
            <span title="Room Host" className="inline-flex">
              <Crown className="h-2.5 w-2.5 shrink-0 text-amber-400 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5" />
            </span>
          )}
          <span className="truncate text-[10px] font-black tracking-tight text-white drop-shadow sm:text-xs lg:text-[13px]">
            {player.username}
          </span>
          {isMe && (
            <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0 text-[7.5px] font-black uppercase text-emerald-400 sm:py-0.2 sm:text-[8.5px] lg:text-[9px]">
              YOU
            </span>
          )}
        </div>

        {/* Cash and Net Worth */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-1 text-[9px] sm:text-[10px] lg:text-[11px]">
          <span className="font-extrabold text-white">
            ${player.cash.toLocaleString()}
          </span>
          <span
            className="font-black text-[#84cc16]"
            title={`Net Worth: $${player.netWorth.toLocaleString()}`}
          >
            (${player.netWorth.toLocaleString()})
          </span>
        </div>

        {/* Status / Jail Badge */}
        <div className="mt-0.5 flex items-center gap-1">
          {player.isBankrupt ? (
            <span className="text-[8.5px] font-extrabold text-red-400 sm:text-[9.5px] lg:text-[10px]">
              Bankrupt
            </span>
          ) : player.inJail ? (
            <span className="rounded bg-rose-500/20 px-1 py-0 text-[8px] font-bold text-rose-300 sm:px-1.5 sm:py-0.5 sm:text-[8.5px] lg:text-[9px]">
              Jail: {remainingJail}r
            </span>
          ) : isTurn ? (
            <span className="flex items-center gap-1 text-[8.5px] font-black text-sky-400 animate-pulse sm:text-[9.5px] lg:text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Active Turn
            </span>
          ) : (
            <span className="text-[8.5px] font-medium text-slate-400 sm:text-[9.5px] lg:text-[10px]">
              Tile #{player.position + 1}
            </span>
          )}
        </div>
      </div>

      {/* Floating Emote Bubble - smooth 1.5s lifecycle and clean fade out */}
      <AnimatePresence>
        {activeEmote && (
          <motion.span
            key={activeEmote.timestamp}
            initial={{ opacity: 0, scale: 0.3, y: 8 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.3, 1.2, 1, 0.9],
              y: [8, -6, -12, -24],
            }}
            exit={{ opacity: 0, scale: 0.4, y: -28 }}
            transition={{
              duration: 1.5,
              times: [0, 0.15, 0.75, 1],
              ease: "easeOut",
            }}
            className={`pointer-events-none absolute -top-3.5 ${
              isRight ? "-left-2" : "-right-2"
            } z-30 flex items-center justify-center rounded-full border border-white/20 bg-slate-900/95 px-2 py-0.5 text-xl shadow-xl backdrop-blur-md`}
          >
            {activeEmote.emoji}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
