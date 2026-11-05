import { Crown, Dices } from "lucide-react";
import { memo } from "react";
import {
  getLudoAutoMoveToken,
  LUDO_HOME_STEP,
  type LudoColor,
  type LudoGameState,
  type LudoPlayerState,
  type RoomSnapshot,
} from "@kridora/shared";
import { cn } from "@/lib/utils";
import { DICE_ROTATIONS, SEAT_DEFINITIONS } from "../constants";
import styles from "../ludo.module.css";

const EMOTES = ["👍", "💀", "😮", "😭", "🔥", "🎉"] as const;

interface NocturneSidePanelProps {
  state: LudoGameState;
  room: RoomSnapshot;
  userId: string;
  activePlayer: LudoPlayerState | undefined;
  isMyTurn: boolean;
  canRoll: boolean;
  canPass?: boolean;
  rollingColor: LudoColor | null;
  diceValue: number;
  onRoll: () => void;
  onPass?: () => void;
  onEmote: (emoji: string) => void;
  activeEmotes: Record<string, { emoji: string; timestamp: number }>;
  playerAvatars: Record<string, string | null>;
}

export const NocturneSidePanel = memo(function NocturneSidePanel({
  state,
  room,
  userId,
  activePlayer,
  isMyTurn,
  canRoll,
  canPass = false,
  rollingColor,
  diceValue,
  onRoll,
  onPass,
  onEmote,
  activeEmotes,
  playerAvatars,
}: NocturneSidePanelProps) {
  const isRolling = rollingColor !== null;
  const activeSeat = activePlayer
    ? SEAT_DEFINITIONS[activePlayer.color]
    : SEAT_DEFINITIONS.coral;
  const rotation =
    DICE_ROTATIONS[diceValue] ??
    DICE_ROTATIONS[1] ??
    "rotateX(0deg) rotateY(0deg)";

  const winnerPlayer = state.winnerId
    ? state.players.find((p) => p.userId === state.winnerId)
    : undefined;

  const isAutoMoving =
    isMyTurn &&
    state.dice !== null &&
    activePlayer !== undefined &&
    getLudoAutoMoveToken(activePlayer, state.movableTokens) !== null;

  const getDiceHeadline = () => {
    if (winnerPlayer) {
      return winnerPlayer.userId === userId
        ? "You won the match!"
        : `${winnerPlayer.name} won!`;
    }
    if (isRolling) return "Rolling...";
    if (state.dice !== null) return `Rolled a ${state.dice}`;
    if (canRoll) return "Roll now";
    if (canPass) return "No moves";
    if (isMyTurn) return "Select a piece";
    return `Waiting for ${activePlayer?.name ?? "player"}...`;
  };

  const getDiceHint = () => {
    if (winnerPlayer) return "All 4 pieces safely reached home.";
    if (isRolling) return "Tumbling the die...";
    if (state.dice !== null) {
      if (state.movableTokens.length === 0)
        return "No valid moves — passing turn";
      if (isMyTurn) {
        return state.dice === 6
          ? "Tap a highlighted pawn · Bonus roll!"
          : "Tap a highlighted pawn";
      }
      return state.dice === 6
        ? "A six gives an extra turn!"
        : `${activePlayer?.name ?? "Player"} is choosing a piece`;
    }
    if (canRoll)
      return "A 1 or 6 starts a piece; only a 6 gives an extra roll.";
    return "Roll a 1 or 6 to start a piece.";
  };

  return (
    <div className="hidden w-full md:flex md:w-[320px] lg:w-[350px] xl:w-[370px] shrink-0 flex-col gap-3 select-none">
      {/* Dice Card */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-[#161822]/90 p-3.5 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          aria-label={canRoll ? "Tap to roll die" : `Die value ${diceValue}`}
          className={cn(
            "relative flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-slate-950 p-1 shadow-inner transition-transform",
            styles.dicePod,
            canRoll && [
              styles.podActive,
              "ring-2 ring-rose-400 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.4)]",
            ],
            !canRoll && "cursor-default opacity-90",
          )}
        >
          <div className={styles.dicePodWell}>
            <div
              className={cn(styles.podDieCube, isRolling && styles.rolling)}
              style={!isRolling ? { transform: rotation } : undefined}
            >
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

        <div className="min-w-0 flex-1 leading-tight">
          <span
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: activeSeat.boardHex }}
          >
            {winnerPlayer
              ? "Match Complete"
              : isMyTurn
                ? "Your turn"
                : `${activePlayer?.name ?? "Player"}'s turn`}
          </span>
          <h3 className="mt-0.5 truncate text-base font-black text-white">
            {getDiceHeadline()}
          </h3>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
            {getDiceHint()}
          </p>
        </div>
      </div>

      {/* Roll / Pass Action Button */}
      <button
        type="button"
        onClick={canRoll ? onRoll : canPass ? onPass : undefined}
        disabled={!canRoll && !canPass}
        className={cn(
          "relative flex h-12 w-full sm:h-13 items-center justify-center gap-2 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-150 select-none",
          canRoll
            ? "cursor-pointer bg-gradient-to-r from-[#ff4d64] to-[#ff6b81] text-white shadow-[0_4px_0_#c9253d,0_8px_20px_rgba(255,77,100,0.35)] hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_#c9253d]"
            : canPass
              ? "cursor-pointer bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_4px_0_#b45309,0_8px_20px_rgba(245,158,11,0.35)] hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_#b45309]"
              : "cursor-not-allowed border border-white/5 bg-slate-800/60 text-slate-500 shadow-none",
        )}
      >
        <Dices className="size-5" />
        <span>
          {winnerPlayer
            ? "Match Finished"
            : isRolling
              ? "Rolling..."
              : canRoll
                ? "Roll the die"
                : canPass
                  ? "Pass Turn"
                  : isMyTurn
                    ? state.dice === null
                      ? "Moving..."
                      : isAutoMoving
                        ? "Auto-moving..."
                        : state.movableTokens.length > 0
                          ? "Select a piece"
                          : "Turn passing..."
                    : `Waiting for ${activePlayer?.name ?? "player"}...`}
        </span>
      </button>

      {/* Players List */}
      <div className="flex flex-col gap-2">
        {state.players.map((p) => {
          const seat = SEAT_DEFINITIONS[p.color];
          const isActive = !winnerPlayer && activePlayer?.userId === p.userId;
          const isMe = p.userId === userId;
          const homeCount = p.tokens.filter((s) => s === LUDO_HOME_STEP).length;
          const runningCount = p.tokens.filter(
            (s) => s >= 0 && s < LUDO_HOME_STEP,
          ).length;
          const avatar = playerAvatars[p.userId];
          const emoteEntry = activeEmotes[p.userId];

          return (
            <div
              key={p.userId}
              className={cn(
                "relative flex items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all duration-300",
                isActive
                  ? "border border-white/25 bg-[#272b3d]/80 text-white shadow-lg shadow-black/30"
                  : "border border-white/6 bg-[#161822]/80 text-slate-200 backdrop-blur-md hover:border-white/10",
              )}
            >
              <div className="relative flex min-w-0 items-center gap-3">
                <div className="relative size-10 shrink-0">
                  <div
                    className={cn(
                      "size-full overflow-hidden rounded-full border-2 bg-slate-800 shadow-sm",
                      isActive ? "border-white" : "border-slate-700",
                    )}
                    style={
                      !isActive
                        ? { borderColor: `${seat.boardHex}aa` }
                        : undefined
                    }
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div
                        className="grid size-full place-items-center text-xs font-black text-white"
                        style={{ backgroundColor: seat.boardHex }}
                      >
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {p.userId === room.ownerId && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 p-0.5 text-black shadow">
                      <Crown className="size-2.5 text-amber-950" />
                    </span>
                  )}

                  {emoteEntry && (
                    <div
                      key={`${emoteEntry.emoji}-${emoteEntry.timestamp}`}
                      className={styles.floatingEmote}
                    >
                      {emoteEntry.emoji}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-black text-white">
                      {p.name}
                    </span>
                    {isMe && (
                      <span
                        className={cn(
                          "rounded px-1 text-[9px] font-bold",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-white/10 text-slate-300",
                        )}
                      >
                        YOU
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      "truncate text-[11px] font-semibold",
                      isActive ? "text-white/90" : "text-slate-400",
                    )}
                  >
                    {p.userId === state.winnerId
                      ? "Winner 🏆"
                      : isActive
                        ? isMe
                          ? "Your turn"
                          : "Their turn"
                        : `${homeCount} home · ${runningCount} running`}
                  </p>
                </div>
              </div>

              {/* 4 Home Dots */}
              <div
                className="flex shrink-0 items-center gap-1.5 pl-2"
                title={`${homeCount}/4 pieces home`}
              >
                {[0, 1, 2, 3].map((dotIdx) => {
                  const isHome = dotIdx < homeCount;
                  if (isActive) {
                    return (
                      <span
                        key={dotIdx}
                        className={cn(
                          "size-2.5 rounded-full transition-all duration-300",
                          isHome
                            ? "scale-110 bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
                            : "border border-white/40 bg-white/25",
                        )}
                      />
                    );
                  }
                  return (
                    <span
                      key={dotIdx}
                      className={cn(
                        "size-2.5 rounded-full transition-all duration-300",
                        isHome
                          ? "scale-110 shadow-[0_0_8px_currentColor]"
                          : "border border-white/15 bg-white/10",
                      )}
                      style={
                        isHome
                          ? {
                              backgroundColor: seat.boardHex,
                              color: seat.boardHex,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Emotes Bar */}
      <div className="mt-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Emotes
          </span>
        </div>

        <div className="rounded-2xl border border-white/6 bg-[#161822]/80 p-2 backdrop-blur-md">
          <div className="flex items-center justify-between gap-1">
            {EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onEmote(emoji)}
                aria-label={`Send ${emoji} emote`}
                className="flex size-10 sm:size-11 cursor-pointer items-center justify-center rounded-xl bg-white/5 text-xl sm:text-2xl transition-transform hover:bg-white/15 hover:shadow-md active:scale-90 touch-manipulation"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
