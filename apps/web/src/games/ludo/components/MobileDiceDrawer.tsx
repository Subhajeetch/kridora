import { Dices } from "lucide-react";
import type { LudoPlayerState } from "@kridora/shared";
import { cn } from "@/lib/utils";
import { DICE_ROTATIONS, SEAT_DEFINITIONS } from "../constants";
import styles from "../ludo.module.css";

interface MobileDiceDrawerProps {
  activePlayer: LudoPlayerState | undefined;
  isMyTurn: boolean;
  canRoll: boolean;
  isRolling: boolean;
  diceValue: number | null;
  movableCount: number;
  onRoll: () => void;
  imageUrl?: string | null;
}

export function MobileDiceDrawer({
  activePlayer,
  isMyTurn,
  canRoll,
  isRolling,
  diceValue,
  movableCount,
  onRoll,
  imageUrl,
}: MobileDiceDrawerProps) {
  if (!activePlayer) return null;

  const seat = SEAT_DEFINITIONS[activePlayer.color];
  const currentDice = diceValue ?? 1;
  const rotation = DICE_ROTATIONS[currentDice] ?? DICE_ROTATIONS[1];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 block sm:hidden px-3 pb-2 pt-1 pointer-events-none">
      <div className="mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border-2 border-sky-400/50 bg-slate-900/95 px-3 py-2 text-white shadow-2xl backdrop-blur-xl pointer-events-auto">
        {/* Left: Active Player Avatar & Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full border-2 border-white/60 bg-slate-800 shadow-md">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <div
                className="grid size-full place-items-center text-sm font-black text-white"
                style={{ backgroundColor: seat.boardHex }}
              >
                {activePlayer.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-black text-white drop-shadow">
                {activePlayer.name}
              </span>
              <span
                className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded"
                style={{
                  backgroundColor: seat.boardHex,
                  color: seat.color === "sunshine" ? "#1e293b" : "#ffffff",
                }}
              >
                {seat.name}
              </span>
            </div>

            <p className="text-[11px] font-semibold text-sky-200/90 truncate">
              {isMyTurn ? (
                canRoll ? (
                  <span className="text-amber-300 font-extrabold animate-pulse">
                    Your Turn! Tap Dice
                  </span>
                ) : movableCount > 0 ? (
                  <span className="text-emerald-300 font-bold">
                    Select a highlighted pawn
                  </span>
                ) : (
                  <span>Rolling...</span>
                )
              ) : (
                <span className="text-slate-400">Waiting for roll...</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: 3D Die Rolling Well & Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={canRoll ? onRoll : undefined}
            disabled={!canRoll}
            aria-label={
              canRoll ? "Tap to roll dice" : `Dice value ${currentDice}`
            }
            className={cn(
              "relative size-12 rounded-xl p-1 transition-all flex items-center justify-center",
              styles.dicePod,
              canRoll && [
                styles.podActive,
                "hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]",
              ],
              !canRoll && "opacity-85 cursor-default",
            )}
          >
            <div className={styles.dicePodWell}>
              <div
                className={cn(styles.podDieCube, isRolling && styles.rolling)}
                style={!isRolling ? { transform: rotation } : undefined}
              >
                {/* Face 1 */}
                <div className={cn(styles.podDieFace, styles.pface1)}>
                  <div />
                  <div />
                  <div />
                  <div />
                  <div className={cn(styles.podPip, styles.pipCenterRed)} />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
                {/* Face 6 */}
                <div className={cn(styles.podDieFace, styles.pface6)}>
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                </div>
                {/* Face 3 */}
                <div className={cn(styles.podDieFace, styles.pface3)}>
                  <div className={styles.podPip} />
                  <div />
                  <div />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div />
                  <div />
                  <div className={styles.podPip} />
                </div>
                {/* Face 4 */}
                <div className={cn(styles.podDieFace, styles.pface4)}>
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                </div>
                {/* Face 2 */}
                <div className={cn(styles.podDieFace, styles.pface2)}>
                  <div className={styles.podPip} />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                  <div className={styles.podPip} />
                </div>
                {/* Face 5 */}
                <div className={cn(styles.podDieFace, styles.pface5)}>
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                  <div />
                  <div className={styles.podPip} />
                </div>
              </div>
            </div>
          </button>

          {canRoll && (
            <button
              type="button"
              onClick={onRoll}
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 py-2.5 text-xs font-black text-amber-950 shadow-lg active:scale-95 cursor-pointer"
            >
              <Dices className="size-4" />
              <span>ROLL</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
