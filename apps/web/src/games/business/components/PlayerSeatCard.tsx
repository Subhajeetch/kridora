import {
  formatBusinessCash,
  formatOrdinalRank,
  type BusinessPlayer,
} from "@kridora/shared";
import { Crown, Lock, Trophy } from "lucide-react";
import { isSafeAvatarUrl } from "../utils";

interface PlayerSeatCardProps {
  player: BusinessPlayer;
  isMe: boolean;
  isTurn: boolean;
  isHost: boolean;
  puckSide: "left" | "right";
  compact?: boolean;
}

const RANK_BADGE_STYLE: Record<number, string> = {
  1: "bg-amber-400 text-slate-950 ring-2 ring-amber-200",
  2: "bg-slate-200 text-slate-900 ring-2 ring-white",
  3: "bg-orange-400 text-slate-950 ring-2 ring-orange-200",
};

export function PlayerSeatCard({
  player,
  isMe,
  isTurn,
  isHost,
  puckSide,
  compact = false,
}: PlayerSeatCardProps) {
  const remainingJail = Math.max(1, player.jailTurns);
  const safeAvatar = isSafeAvatarUrl(player.avatarUrl)
    ? player.avatarUrl
    : null;
  const isFinished = player.finishRank !== null;
  const isNegativeCash = !player.isBankrupt && player.cash < 0;
  const isDangerCash = !player.isBankrupt && player.cash <= -400;

  const puck = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-white shadow-[0_3px_0_rgba(148,163,184,0.85),0_5px_10px_rgba(0,0,0,0.3)] ${
        compact
          ? "h-6 w-6 p-[3px] sm:h-7 sm:w-7"
          : "h-7 w-7 p-[3.5px] sm:h-9 sm:w-9 sm:p-[4.5px]"
      }`}
    >
      <div
        style={{ backgroundColor: player.color }}
        className="h-full w-full rounded-full shadow-inner"
      />
    </div>
  );

  return (
    <div
      className={`flex flex-col items-center transition-all duration-300 ${
        player.isBankrupt ? "opacity-45 grayscale" : ""
      }`}
    >
      {/* Avatar + Puck Row */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {puckSide === "left" && puck}

        <div className="relative">
          <div
            style={{
              borderColor: isFinished
                ? "#facc15"
                : isTurn
                  ? "#38bdf8"
                  : isDangerCash
                    ? "#fb7185"
                    : "rgba(255,255,255,0.25)",
            }}
            className={`relative overflow-hidden rounded-full border-[2.5px] bg-slate-800 shadow-lg transition-transform duration-300 ${
              isTurn
                ? "scale-105 ring-4 ring-sky-400/35"
                : isFinished
                  ? "ring-4 ring-amber-400/30"
                  : ""
            } ${
              compact ? "h-9 w-9 sm:h-11 sm:w-11" : "h-11 w-11 sm:h-14 sm:w-14"
            }`}
          >
            {safeAvatar ? (
              <img
                src={safeAvatar}
                alt={player.username}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                style={{ backgroundColor: player.color }}
                className="flex h-full w-full items-center justify-center text-xs font-black text-white sm:text-sm"
              >
                {player.username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {isHost && !isFinished && (
            <span
              title="Room Host"
              className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow sm:h-5 sm:w-5"
            >
              <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </span>
          )}

          {isFinished && player.finishRank !== null && (
            <span
              title={`Finished ${formatOrdinalRank(player.finishRank)} Place`}
              className={`absolute -top-1.5 -right-2 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8.5px] font-black shadow-md sm:text-[9.5px] ${
                RANK_BADGE_STYLE[player.finishRank] ??
                "bg-amber-300 text-slate-900"
              }`}
            >
              <Trophy className="h-2.5 w-2.5" />
              {formatOrdinalRank(player.finishRank)}
            </span>
          )}

          {player.inJail && !player.isBankrupt && !isFinished && (
            <span
              title={`In Jail (${remainingJail} rounds left)`}
              className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow"
            >
              <Lock className="h-2 w-2" />
              {remainingJail}
            </span>
          )}
        </div>

        {puckSide === "right" && puck}
      </div>

      {/* Name / Status Pill */}
      <div className="mt-1 flex flex-col items-center text-center leading-tight">
        {isFinished && player.finishRank !== null ? (
          <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-400/40 sm:text-xs">
            {isMe ? "You" : player.username} •{" "}
            {formatOrdinalRank(player.finishRank)}
          </span>
        ) : isTurn && !player.isBankrupt ? (
          <span className="rounded-full bg-[#1885f2] px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm sm:px-3 sm:text-xs">
            {isMe ? "Your Turn" : player.username}
          </span>
        ) : (
          <div className="flex max-w-[105px] items-center gap-1 sm:max-w-[135px]">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                player.isConnected ? "bg-[#8ee04e]" : "bg-slate-400"
              }`}
            />
            <span className="truncate text-[11px] font-bold text-white sm:text-xs">
              {isMe ? "You" : player.username}
            </span>
          </div>
        )}

        {/* Cash ($NetWorth) */}
        <div className="mt-0.5 flex items-baseline gap-1 text-[10.5px] font-extrabold sm:text-xs">
          {player.isBankrupt ? (
            <span className="text-rose-300">Bankrupt</span>
          ) : isFinished ? (
            <span className="text-[#8ee04e]">
              {formatBusinessCash(player.netWorth)}
            </span>
          ) : (
            <>
              <span
                className={
                  isDangerCash
                    ? "animate-pulse text-rose-400"
                    : isNegativeCash
                      ? "text-rose-300"
                      : "text-white"
                }
                title={
                  isNegativeCash
                    ? "Overdraft active — bankruptcy at -$600"
                    : undefined
                }
              >
                {formatBusinessCash(player.cash)}
              </span>
              <span className="text-[#8ee04e]">
                ({formatBusinessCash(player.netWorth)})
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
