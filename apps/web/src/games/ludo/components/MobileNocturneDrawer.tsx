import { ChevronDown, ChevronUp, Crown, Dices, Smile } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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

interface MobileNocturneDrawerProps {
  state: LudoGameState;
  room: RoomSnapshot;
  userId: string;
  activePlayer: LudoPlayerState | undefined;
  isMyTurn: boolean;
  canRoll: boolean;
  rollingColor: LudoColor | null;
  diceValue: number;
  onRoll: () => void;
  onEmote: (emoji: string) => void;
  activeEmotes: Record<string, { emoji: string; timestamp: number }>;
  playerAvatars: Record<string, string | null>;
}

const StaticDieFaces = memo(function StaticDieFaces() {
  return (
    <>
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
    </>
  );
});

export const MobileNocturneDrawer = memo(function MobileNocturneDrawer({
  state,
  room,
  userId,
  activePlayer,
  isMyTurn,
  canRoll,
  rollingColor,
  diceValue,
  onRoll,
  onEmote,
  activeEmotes,
  playerAvatars,
}: MobileNocturneDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [emojiDropdownOpen, setEmojiDropdownOpen] = useState(false);
  const emojiDropdownRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Derive newest active emote without extra state/timers (parent clears entries after 2.5s)
  const latestIncomingEmote = useMemo(() => {
    let newest: { userId: string; emoji: string; timestamp: number } | null =
      null;
    for (const [uId, entry] of Object.entries(activeEmotes)) {
      if (!newest || entry.timestamp > newest.timestamp) {
        newest = {
          userId: uId,
          emoji: entry.emoji,
          timestamp: entry.timestamp,
        };
      }
    }
    return newest;
  }, [activeEmotes]);

  useEffect(() => {
    if (!emojiDropdownOpen) return;

    function handlePointerOutside(e: PointerEvent) {
      const target = e.target as Node | null;
      if (
        target &&
        emojiDropdownRef.current &&
        !emojiDropdownRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setEmojiDropdownOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerOutside);
    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside);
    };
  }, [emojiDropdownOpen]);

  const isRolling = rollingColor !== null;
  const activeSeat = activePlayer
    ? SEAT_DEFINITIONS[activePlayer.color]
    : SEAT_DEFINITIONS.coral;
  const rotation =
    DICE_ROTATIONS[diceValue] ?? DICE_ROTATIONS[1] ?? "rotateX(0deg) rotateY(0deg)";

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
    if (isMyTurn) return "Finishing move...";
    return `Waiting for ${activePlayer?.name ?? "player"}...`;
  };

  const getDiceHint = () => {
    if (winnerPlayer) return "All 4 pieces safely reached home.";
    if (isRolling) return "Tumbling the die...";
    if (state.dice !== null) {
      if (state.movableTokens.length === 0) return "No valid moves — passing turn";
      if (isMyTurn) {
        if (isAutoMoving) return "Moving piece automatically...";
        return state.dice === 6
          ? "Tap a highlighted pawn · Bonus roll!"
          : "Tap a highlighted pawn";
      }
      return state.dice === 6
        ? "A six gives an extra turn!"
        : `${activePlayer?.name ?? "Player"} is choosing a piece`;
    }
    if (canRoll) return "A six unlocks a piece & gives an extra roll.";
    return "A six starts a piece.";
  };

  const latestSender = latestIncomingEmote
    ? state.players.find((p) => p.userId === latestIncomingEmote.userId)
    : null;
  const latestSenderSeat = latestSender
    ? SEAT_DEFINITIONS[latestSender.color]
    : null;
  const latestSenderAvatar = latestSender
    ? playerAvatars[latestSender.userId]
    : null;

  return (
    <>
      {/* 1. FLOATING MOBILE REACTION CARD */}
      {latestIncomingEmote && latestSender && latestSenderSeat && (
        <div
          key={`${latestIncomingEmote.userId}-${latestIncomingEmote.timestamp}`}
          className="pointer-events-none fixed bottom-[152px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/20 bg-[#161828] px-3.5 py-1.5 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200 md:hidden"
        >
          <div
            className="size-7 shrink-0 overflow-hidden rounded-full border-2 bg-slate-800 shadow"
            style={{ borderColor: latestSenderSeat.boardHex }}
          >
            {latestSenderAvatar ? (
              <img
                src={latestSenderAvatar}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div
                className="grid size-full place-items-center text-[10px] font-black text-white"
                style={{ backgroundColor: latestSenderSeat.boardHex }}
              >
                {latestSender.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="max-w-[100px] truncate text-xs font-black text-white">
            {latestSender.name}
          </span>
          <span className="animate-bounce text-2xl">
            {latestIncomingEmote.emoji}
          </span>
        </div>
      )}

      {/* 2. MOBILE BOTTOM DRAWER (GPU-friendly solid surface, zero nested backdrop-filter) */}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl rounded-b-none border-t border-white/10 bg-[#13151f] px-3.5 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_32px_rgba(0,0,0,0.85)] select-none md:hidden">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />

        {/* Turn & 3D Dice Card */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#181a26] p-2.5 shadow-md">
          <button
            type="button"
            onClick={canRoll ? onRoll : undefined}
            disabled={!canRoll}
            aria-label={canRoll ? "Tap to roll die" : `Die value ${diceValue}`}
            className={cn(
              "relative flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950 p-0.5 shadow-inner",
              styles.dicePod,
              canRoll && [
                styles.podActive,
                "cursor-pointer ring-2 ring-rose-400 active:scale-95",
              ],
              !canRoll && "cursor-default opacity-90",
            )}
          >
            <div className={styles.dicePodWell}>
              <div
                className={cn(styles.podDieCube, isRolling && styles.rolling)}
                style={!isRolling ? { transform: rotation } : undefined}
              >
                <StaticDieFaces />
              </div>
            </div>
          </button>

          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className="rounded px-1 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{
                  backgroundColor: `${activeSeat.boardHex}25`,
                  color: activeSeat.boardHex,
                }}
              >
                {winnerPlayer
                  ? "Match Complete"
                  : isMyTurn
                    ? "Your turn"
                    : `${activePlayer?.name ?? "Player"}'s turn`}
              </span>
            </div>
            <h4 className="mt-0.5 truncate text-sm font-black text-white">
              {getDiceHeadline()}
            </h4>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {getDiceHint()}
            </p>
          </div>
        </div>

        {/* Action Row: Roll Button + Reaction Emoji Menu */}
        <div className="relative mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={canRoll ? onRoll : undefined}
            disabled={!canRoll}
            className={cn(
              "relative flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-black uppercase tracking-wider transition-transform duration-150 select-none touch-manipulation",
              canRoll
                ? "cursor-pointer bg-gradient-to-r from-[#ff4d64] to-[#ff6b81] text-white shadow-[0_4px_0_#c9253d,0_8px_18px_rgba(255,77,100,0.3)] active:translate-y-1 active:shadow-none"
                : "cursor-not-allowed border border-white/5 bg-slate-800/70 text-slate-500",
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
                    : isMyTurn
                      ? state.dice === null
                        ? "Moving..."
                        : isAutoMoving
                          ? "Auto-moving..."
                          : state.movableTokens.length > 0
                            ? "Select piece"
                            : "Turn passing..."
                      : "Waiting..."}
            </span>
          </button>

          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setEmojiDropdownOpen((prev) => !prev)}
              aria-label={
                emojiDropdownOpen ? "Close emoji menu" : "Reaction emojis"
              }
              className={cn(
                "flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-white/10 shadow-md transition-transform active:scale-95 touch-manipulation",
                emojiDropdownOpen
                  ? "border-amber-400/50 bg-[#282d40] text-slate-200"
                  : "bg-[#1e2230] text-amber-400 hover:bg-[#282d40]",
              )}
            >
              {emojiDropdownOpen ? (
                <ChevronDown className="size-5 text-slate-300" />
              ) : (
                <Smile className="size-5 text-amber-400" />
              )}
            </button>

            {emojiDropdownOpen && (
              <div
                ref={emojiDropdownRef}
                className="absolute right-0 bottom-14 z-50 flex w-12 flex-col items-center gap-1 rounded-2xl border border-white/15 bg-[#141624] p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              >
                {EMOTES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onEmote(emoji);
                      setEmojiDropdownOpen(false);
                    }}
                    className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-2xl transition-transform hover:bg-white/15 active:scale-90 touch-manipulation"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Players Expand/Collapse Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mx-auto flex cursor-pointer items-center justify-center gap-1 pt-2 pb-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-white select-none touch-manipulation"
        >
          <span>Players ({state.players.length})</span>
          {isExpanded ? (
            <ChevronUp className="size-3.5 text-slate-300" />
          ) : (
            <ChevronDown className="size-3.5 text-slate-300" />
          )}
        </button>

        {/* Collapsible Players Roster */}
        {isExpanded && (
          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto pt-1 pb-2">
            {state.players.map((p) => {
              const seat = SEAT_DEFINITIONS[p.color];
              const isActive =
                !winnerPlayer && activePlayer?.userId === p.userId;
              const isMe = p.userId === userId;
              const homeCount = p.tokens.filter(
                (s) => s === LUDO_HOME_STEP,
              ).length;
              const runningCount = p.tokens.filter(
                (s) => s >= 0 && s < LUDO_HOME_STEP,
              ).length;
              const avatar = playerAvatars[p.userId];
              const emoteEntry = activeEmotes[p.userId];

              return (
                <div
                  key={p.userId}
                  className={cn(
                    "relative flex items-center justify-between rounded-xl px-3 py-2",
                    isActive
                      ? "border border-white/25 bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-md"
                      : "border border-white/6 bg-[#181a26] text-slate-200",
                  )}
                >
                  <div className="relative flex min-w-0 items-center gap-2.5">
                    <div className="relative size-8 shrink-0">
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
                            className="grid size-full place-items-center text-[10px] font-black text-white"
                            style={{ backgroundColor: seat.boardHex }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {p.userId === room.ownerId && (
                        <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 p-0.5 text-black shadow">
                          <Crown className="size-2 text-amber-950" />
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
                        <span className="truncate text-xs font-black text-white">
                          {p.name}
                        </span>
                        {isMe && (
                          <span
                            className={cn(
                              "rounded px-1 text-[8px] font-bold",
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
                          "truncate text-[10px] font-semibold",
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
                              "size-2.5 rounded-full",
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
                            "size-2.5 rounded-full",
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
        )}
      </div>
    </>
  );
});