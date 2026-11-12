import type { BusinessPlayer } from "@kridora/shared";
import { ThreeDice } from "./ThreeDice";

const EMOTES = ["👍", "💀", "😮", "😭", "🔥", "🎉"] as const;

interface MobileBusinessDrawerProps {
  activePlayer: BusinessPlayer | null;
  isMyTurn: boolean;
  canRoll: boolean;
  isRolling: boolean;
  diceValue: number;
  onRoll: () => void;
  onSendEmote: (emoji: string) => void;
}

export function MobileBusinessDrawer({
  activePlayer,
  isMyTurn,
  canRoll,
  isRolling,
  diceValue,
  onRoll,
  onSendEmote,
}: MobileBusinessDrawerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 block lg:hidden pointer-events-none px-2 pb-2">
      <div className="mx-auto flex max-w-md flex-col gap-2 rounded-2xl border border-white/15 bg-[#0d1322]/95 p-2.5 shadow-2xl backdrop-blur-xl pointer-events-auto">
        {/* Top row: Active Player Info on Left + 3D Dice Pod on Right */}
        <div className="flex items-center justify-between gap-3">
          {/* Active player details */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div
                style={{ borderColor: activePlayer?.color ?? "#10b981" }}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 bg-slate-900 shadow"
              >
                {activePlayer?.avatarUrl ? (
                  <img
                    src={activePlayer.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    style={{
                      backgroundColor: activePlayer?.color ?? "#10b981",
                    }}
                    className="flex h-full w-full items-center justify-center text-xs font-black text-white"
                  >
                    {activePlayer?.username.slice(0, 2).toUpperCase() ?? "P"}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-black text-white drop-shadow">
                  {activePlayer?.username ?? "Player"}
                </span>
                {isMyTurn && (
                  <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-black uppercase text-emerald-400">
                    YOU
                  </span>
                )}
              </div>

              <div className="text-[11px] font-bold">
                {isMyTurn ? (
                  canRoll ? (
                    <span className="text-amber-300 animate-pulse font-black">
                      Your Turn! Tap 3D Dice
                    </span>
                  ) : (
                    <span className="text-slate-400">Deciding...</span>
                  )
                ) : (
                  <span className="text-slate-400">
                    Waiting for {activePlayer?.username}...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3D Dice Pod */}
          <div className="relative shrink-0 flex items-center justify-center">
            <ThreeDice
              value={diceValue}
              isRolling={isRolling}
              isMyTurn={isMyTurn}
              canRoll={canRoll}
              onRoll={onRoll}
              size={64}
            />
          </div>
        </div>

        {/* Bottom row: Quick Emote Bar */}
        <div className="flex items-center justify-between gap-1 border-t border-white/10 pt-1.5">
          {EMOTES.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendEmote(emoji)}
              className="flex-1 cursor-pointer rounded-lg py-1 text-center text-base transition hover:bg-white/10 active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
