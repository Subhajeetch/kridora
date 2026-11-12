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

  // Position-specific alignments for compact corner aesthetics
  const isRight = position.includes("right");

  return (
    <div
      className={`relative z-20 flex min-w-[140px] max-w-[210px] items-center gap-2.5 rounded-2xl border p-2.5 shadow-xl transition-all duration-300 sm:min-w-[170px] sm:max-w-[240px] sm:p-3 ${
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
          className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 shadow-md sm:h-11 sm:w-11"
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
              className="flex h-full w-full items-center justify-center text-xs font-black text-white"
            >
              {player.username.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Small Puck Color Dot */}
        <span
          style={{ backgroundColor: player.color }}
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 shadow"
        />
      </div>

      {/* Info Column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isHost && (
            <span title="Room Host" className="inline-flex">
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            </span>
          )}
          <span className="truncate text-xs font-black tracking-tight text-white drop-shadow sm:text-sm">
            {player.username}
          </span>
          {isMe && (
            <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-black uppercase text-emerald-400">
              YOU
            </span>
          )}
        </div>

        {/* Cash and Net Worth */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-1 text-[11px] sm:text-xs">
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
            <span className="text-[10px] font-extrabold text-red-400">
              Bankrupt
            </span>
          ) : player.inJail ? (
            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
              Jail: {remainingJail} round{remainingJail > 1 ? "s" : ""} left
            </span>
          ) : isTurn ? (
            <span className="flex items-center gap-1 text-[10px] font-black text-sky-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              Active Turn
            </span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">
              Tile #{player.position + 1}
            </span>
          )}
        </div>
      </div>

      {/* Floating Emote Bubble */}
      {player.lastEmote && (
        <span
          key={player.lastEmote.timestamp}
          className={`animate-bounce absolute -top-3 ${
            isRight ? "-left-2" : "-right-2"
          } z-30 rounded-full border border-white/20 bg-slate-900 px-2 py-0.5 text-xl shadow-xl`}
        >
          {player.lastEmote.emoji}
        </span>
      )}
    </div>
  );
}
