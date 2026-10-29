import { Crown } from "lucide-react";
import type { LudoPlayerState } from "@kridora/shared";
import { cn } from "@/lib/utils";
import { DICE_ROTATIONS } from "../constants";
import styles from "../ludo.module.css";
import type { LudoSeatDefinition } from "../types";

interface DicePodProps {
  seat: LudoSeatDefinition;
  player: LudoPlayerState | undefined;
  isActive: boolean;
  isMySeat: boolean;
  canRoll: boolean;
  isRolling: boolean;
  diceValue: number;
  onRoll: () => void;
  arrowSide?: "left" | "right";
  dimmed?: boolean;
  imageUrl?: string | null;
  isRoomOwner?: boolean;
}

export function DicePod({
  seat,
  player,
  isActive,
  isMySeat,
  canRoll,
  isRolling,
  diceValue,
  onRoll,
  arrowSide = "left",
  dimmed = false,
  imageUrl,
  isRoomOwner = false,
}: DicePodProps) {
  const homeCount =
    player?.tokens.filter((step) => step === 57).length ?? 0;
  const rotation = DICE_ROTATIONS[diceValue] ?? DICE_ROTATIONS[1];

  // The arrow icon ONLY shows when it's OUR turn and this is OUR seat!
  const shouldShowArrow = isActive && isMySeat;

  const arrowSVG = (
    <div
      className={cn(
        arrowSide === "left" ? styles.turnArrowLeft : styles.turnArrowRight,
        "flex shrink-0 items-center justify-center",
      )}
      aria-hidden="true"
    >
      <svg className="size-8 sm:size-9" viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="goldArrowGrad" x1="4" y1="7" x2="32" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <path
          d="M4 18L16 7V13H32V23H16V29L4 18Z"
          fill="url(#goldArrowGrad)"
          stroke="#78350f"
          strokeWidth="1.8"
        />
      </svg>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 transition-opacity duration-300",
        arrowSide === "right" ? "items-end" : "items-start",
        dimmed && "opacity-35 pointer-events-none select-none",
      )}
    >
      {/* Player header with avatar & name */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-1 max-w-[130px] sm:max-w-[160px]",
          arrowSide === "right" && "flex-row-reverse",
        )}
      >
        <div className="relative size-6 shrink-0 overflow-hidden rounded-full border border-white/40 bg-slate-800 shadow-sm">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <div
              className="grid size-full place-items-center text-[10px] font-black text-white"
              style={{ backgroundColor: seat.boardHex }}
            >
              {player ? player.name.charAt(0).toUpperCase() : "-"}
            </div>
          )}
          {isRoomOwner && (
            <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 p-0.5 text-black">
              <Crown className="size-2 text-amber-950" />
            </span>
          )}
        </div>

        <div className={cn("min-w-0 flex flex-col", arrowSide === "right" && "items-end")}>
          <span className="truncate text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {player ? player.name : "(Empty)"}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded"
            style={{
              backgroundColor: `${seat.boardHex}dd`,
              color: seat.color === "sunshine" ? "#1e293b" : "#ffffff",
            }}
          >
            {seat.name}
          </span>
        </div>
      </div>

      {/* Dice pod and bouncing arrow row */}
      <div
        className={cn(
          "flex items-center gap-2",
          arrowSide === "right" && "flex-row-reverse",
        )}
      >
        <button
          type="button"
          onClick={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          aria-label={
            canRoll
              ? `Roll dice for ${player?.name ?? seat.name}`
              : `${player?.name ?? seat.name} dice (value: ${diceValue})`
          }
          className={cn(
            styles.dicePod,
            isActive && styles.podActive,
            dimmed && styles.dicePodDimmed,
            canRoll && "hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-white/60",
          )}
        >
          <div className={styles.dicePodWell}>
            <div
              className={cn(styles.podDieCube, isRolling && styles.rolling)}
              style={!isRolling ? { transform: rotation } : undefined}
            >
              {/* Face 1 */}
              <div className={cn(styles.podDieFace, styles.pface1)}>
                <div /><div /><div />
                <div /><div className={cn(styles.podPip, styles.pipCenterRed)} /><div />
                <div /><div /><div />
              </div>

              {/* Face 6 */}
              <div className={cn(styles.podDieFace, styles.pface6)}>
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
              </div>

              {/* Face 3 */}
              <div className={cn(styles.podDieFace, styles.pface3)}>
                <div className={styles.podPip} /><div /><div />
                <div /><div className={styles.podPip} /><div />
                <div /><div /><div className={styles.podPip} />
              </div>

              {/* Face 4 */}
              <div className={cn(styles.podDieFace, styles.pface4)}>
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
                <div /><div /><div />
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
              </div>

              {/* Face 2 */}
              <div className={cn(styles.podDieFace, styles.pface2)}>
                <div className={styles.podPip} /><div /><div />
                <div /><div /><div />
                <div /><div /><div className={styles.podPip} />
              </div>

              {/* Face 5 */}
              <div className={cn(styles.podDieFace, styles.pface5)}>
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
                <div /><div className={styles.podPip} /><div />
                <div className={styles.podPip} /><div /><div className={styles.podPip} />
              </div>
            </div>
          </div>
        </button>

        {shouldShowArrow && arrowSVG}
      </div>

      {/* Score / Home Pawns badge */}
      <div
        className={cn(
          "flex items-center gap-1 px-1",
          arrowSide === "right" && "flex-row-reverse",
        )}
      >
        <span className="text-xs" title="Pieces Home">🏆</span>
        <span className="text-xs font-black text-amber-300 drop-shadow">
          {homeCount}/4
        </span>
      </div>
    </div>
  );
}
