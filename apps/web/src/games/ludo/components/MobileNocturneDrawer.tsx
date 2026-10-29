import { ChevronDown, ChevronUp, Crown, Dices, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LudoColor, LudoGameState, LudoPlayerState, RoomSnapshot } from "@kridora/shared";
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

export function MobileNocturneDrawer({
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

  // Latest incoming emote notification for mobile (floating card above bottom edge)
  const [latestIncomingEmote, setLatestIncomingEmote] = useState<{
    userId: string;
    emoji: string;
    timestamp: number;
  } | null>(null);

  // Track new incoming emotes
  useEffect(() => {
    const entries = Object.entries(activeEmotes);
    if (entries.length === 0) return;

    // Find the newest timestamp
    let newest: { userId: string; emoji: string; timestamp: number } | null = null;
    for (const [uId, entry] of entries) {
      if (!newest || entry.timestamp > newest.timestamp) {
        newest = { userId: uId, emoji: entry.emoji, timestamp: entry.timestamp };
      }
    }

    if (newest) {
      setLatestIncomingEmote(newest);
      const timer = window.setTimeout(() => {
        setLatestIncomingEmote((curr) => (curr?.timestamp === newest?.timestamp ? null : curr));
      }, 2400);
      return () => window.clearTimeout(timer);
    }
  }, [activeEmotes]);

  // Click outside to close vertical emoji dropdown
  useEffect(() => {
    if (!emojiDropdownOpen) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        emojiDropdownRef.current &&
        !emojiDropdownRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setEmojiDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [emojiDropdownOpen]);

  const isRolling = rollingColor !== null;
  const activeSeat = activePlayer ? SEAT_DEFINITIONS[activePlayer.color] : SEAT_DEFINITIONS.coral;
  const rotation = DICE_ROTATIONS[diceValue] ?? DICE_ROTATIONS[1];

  const getDiceHeadline = () => {
    if (isRolling) return "Rolling...";
    if (state.dice !== null) return `Rolled a ${state.dice}`;
    if (canRoll) return "Roll now";
    if (isMyTurn && state.movableTokens.length > 0) return "Select a piece";
    if (isMyTurn && state.movableTokens.length === 0 && state.dice !== null) return "No valid moves";
    return `Waiting for ${activePlayer?.name ?? "player"}...`;
  };

  const getDiceHint = () => {
    if (state.dice === 6) return "A six gives an extra turn!";
    if (canRoll) return "A six starts a piece.";
    if (isMyTurn && state.movableTokens.length > 0) return "Tap a highlighted pawn";
    if (isMyTurn && state.movableTokens.length === 0 && state.dice !== null) return "Turn passes shortly";
    return "A six starts a piece.";
  };

  // Find sender player for incoming emote card
  const latestSender = latestIncomingEmote
    ? state.players.find((p) => p.userId === latestIncomingEmote.userId)
    : null;
  const latestSenderSeat = latestSender ? SEAT_DEFINITIONS[latestSender.color] : null;

  return (
    <>
      {/* 1. FLOATING MOBILE REACTION CARD: Reveals from bottom edge when any user sends an emote */}
      {latestIncomingEmote && latestSender && latestSenderSeat && (
        <div
          key={`${latestIncomingEmote.userId}-${latestIncomingEmote.timestamp}`}
          className="fixed z-50 left-1/2 -translate-x-1/2 bottom-[148px] md:hidden flex items-center gap-2.5 rounded-2xl border border-white/20 bg-[#161828]/95 px-3.5 py-1.5 text-white shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-8 fade-in duration-300 pointer-events-none"
        >
          <div
            className="size-7 shrink-0 overflow-hidden rounded-full border-2 bg-slate-800 shadow"
            style={{ borderColor: latestSenderSeat.boardHex }}
          >
            {playerAvatars[latestSender.userId] ? (
              <img
                src={playerAvatars[latestSender.userId]!}
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
          <span className="truncate text-xs font-black text-white max-w-[100px]">
            {latestSender.name}
          </span>
          <span className="text-2xl animate-bounce drop-shadow">
            {latestIncomingEmote.emoji}
          </span>
        </div>
      )}

      {/* 2. THE MOBILE BOTTOM DRAWER: Anchored to the very bottom, no bottom rounded corners */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden rounded-t-3xl rounded-b-none border-t border-white/10 bg-[#13151f]/98 px-3.5 pt-1.5 pb-2 shadow-[0_-12px_45px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-300 ease-in-out select-none">
        {/* Subtle drag handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />

        {/* ALWAYS VISIBLE 1: Turn & 3D Dice Card */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#181a26]/90 p-2.5 backdrop-blur-md shadow-md">
          {/* 3D Die Well */}
          <button
            type="button"
            onClick={canRoll ? onRoll : undefined}
            disabled={!canRoll}
            aria-label={canRoll ? "Tap to roll die" : `Die value ${diceValue}`}
            className={cn(
              "relative size-12 shrink-0 rounded-xl bg-slate-950/80 p-0.5 flex items-center justify-center border border-white/10 shadow-inner transition-transform",
              styles.dicePod,
              canRoll && [
                styles.podActive,
                "hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]",
              ],
              !canRoll && "opacity-90 cursor-default",
            )}
          >
            <div className={styles.dicePodWell}>
              <div
                className={cn(styles.podDieCube, isRolling && styles.rolling)}
                style={!isRolling ? { transform: rotation } : undefined}
              >
                {/* 6 Faces of 3D die */}
                <div className={cn(styles.podDieFace, styles.pface1)}>
                  <div /><div /><div />
                  <div /><div className={cn(styles.podPip, styles.pipCenterRed)} /><div />
                  <div /><div /><div />
                </div>
                <div className={cn(styles.podDieFace, styles.pface6)}>
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                </div>
                <div className={cn(styles.podDieFace, styles.pface3)}>
                  <div className={styles.podPip} /><div /><div />
                  <div /><div className={styles.podPip} /><div />
                  <div /><div /><div className={styles.podPip} />
                </div>
                <div className={cn(styles.podDieFace, styles.pface4)}>
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                  <div /><div /><div />
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                </div>
                <div className={cn(styles.podDieFace, styles.pface2)}>
                  <div className={styles.podPip} /><div /><div />
                  <div /><div /><div />
                  <div /><div /><div className={styles.podPip} />
                </div>
                <div className={cn(styles.podDieFace, styles.pface5)}>
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                  <div /><div className={styles.podPip} /><div />
                  <div className={styles.podPip} /><div /><div className={styles.podPip} />
                </div>
              </div>
            </div>
          </button>

          {/* Dice status text */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[10px] font-black uppercase tracking-wider px-1 py-0.2 rounded"
                style={{
                  backgroundColor: `${activeSeat.boardHex}25`,
                  color: activeSeat.boardHex,
                }}
              >
                {isMyTurn ? "Your turn" : `${activePlayer?.name ?? "Player"}'s turn`}
              </span>
            </div>
            <h4 className="truncate text-sm font-black text-white mt-0.5">
              {getDiceHeadline()}
            </h4>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {getDiceHint()}
            </p>
          </div>
        </div>

        {/* ALWAYS VISIBLE 2: Action Row (Roll Button + Smile Emoji Button) */}
        <div className="relative mt-2 flex items-center gap-2">
          {/* Big "Roll the die" Action Button */}
          <button
            type="button"
            onClick={canRoll ? onRoll : undefined}
            disabled={!canRoll}
            className={cn(
              "relative h-12 flex-1 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 select-none",
              canRoll
                ? "bg-gradient-to-r from-[#ff4d64] to-[#ff6b81] text-white shadow-[0_4px_0_#c9253d,0_8px_20px_rgba(255,77,100,0.35)] hover:brightness-110 active:translate-y-1 active:shadow-[0_0_0_#c9253d] cursor-pointer"
                : "bg-slate-800/60 text-slate-500 border border-white/5 cursor-not-allowed shadow-none",
            )}
          >
            <Dices className="size-5" />
            <span>
              {isRolling
                ? "Rolling..."
                : canRoll
                  ? "Roll the die"
                  : isMyTurn
                    ? state.movableTokens.length > 0
                      ? "Select piece"
                      : "Turn passing..."
                    : `Waiting...`}
            </span>
          </button>

          {/* EMOJI SMILE BUTTON */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setEmojiDropdownOpen((prev) => !prev)}
              aria-label={emojiDropdownOpen ? "Close emoji menu" : "Reaction emojis"}
              className={cn(
                "size-12 shrink-0 rounded-2xl border border-white/10 transition-all flex items-center justify-center active:scale-95 cursor-pointer shadow-md",
                emojiDropdownOpen
                  ? "bg-[#282d40] border-amber-400/50 text-slate-200"
                  : "bg-[#1e2230] hover:bg-[#282d40] text-amber-400",
              )}
            >
              {emojiDropdownOpen ? (
                <ChevronDown className="size-5 text-slate-300" />
              ) : (
                <Smile className="size-5 text-amber-400" />
              )}
            </button>

            {/* VERY SMALL WIDTH VERTICAL EMOJI DROPDOWN */}
            {emojiDropdownOpen && (
              <div
                ref={emojiDropdownRef}
                className="absolute bottom-14 right-0 z-50 flex flex-col items-center gap-1 p-1 rounded-2xl border border-white/15 bg-[#141624]/98 backdrop-blur-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                style={{ width: "48px" }}
              >
                {EMOTES.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onEmote(emoji);
                      setEmojiDropdownOpen(false);
                    }}
                    className="size-9 rounded-xl hover:bg-white/15 active:scale-90 text-2xl flex items-center justify-center transition cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ALWAYS VISIBLE 3: "Players" Expand/Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center justify-center gap-1 mx-auto pt-2 pb-1 text-[11px] font-bold text-slate-400 hover:text-white transition cursor-pointer select-none"
        >
          <span>Players ({state.players.length})</span>
          {isExpanded ? (
            <ChevronUp className="size-3.5 text-slate-300" />
          ) : (
            <ChevronDown className="size-3.5 text-slate-300" />
          )}
        </button>

        {/* COLLAPSIBLE SECTION: Players List + Leave Game */}
        <div
          className={cn(
            "transition-all duration-300 ease-in-out overflow-hidden flex flex-col gap-2",
            isExpanded
              ? "max-h-[50vh] overflow-y-auto pt-1 pb-2 opacity-100"
              : "max-h-0 opacity-0 pointer-events-none",
          )}
        >
          {state.players.map((p) => {
            const seat = SEAT_DEFINITIONS[p.color];
            const isActive = activePlayer?.userId === p.userId;
            const isMe = p.userId === userId;
            const homeCount = p.tokens.filter((s) => s === 57).length;
            const runningCount = p.tokens.filter((s) => s >= 0 && s < 57).length;
            const avatar = playerAvatars[p.userId];
            const emoteEntry = activeEmotes[p.userId];

            return (
              <div
                key={p.userId}
                className={cn(
                  "relative flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-slate-600 to-slate-500 border border-white/25 text-white shadow-md shadow-black/30"
                    : "bg-[#181a26]/80 border border-white/6 text-slate-200",
                )}
              >
                {/* Left: Avatar with floating emote */}
                <div className="relative flex items-center gap-2.5 min-w-0">
                  <div className="relative size-8 shrink-0">
                    <div
                      className={cn(
                        "size-full overflow-hidden rounded-full border-2 bg-slate-800 shadow-sm",
                        isActive ? "border-white" : "border-slate-700",
                      )}
                      style={!isActive ? { borderColor: `${seat.boardHex}aa` } : undefined}
                    >
                      {avatar ? (
                        <img src={avatar} alt="" className="size-full object-cover" />
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
                            "text-[8px] font-bold px-1 rounded",
                            isActive ? "bg-white/20 text-white" : "bg-white/10 text-slate-300",
                          )}
                        >
                          YOU
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-[10px] font-semibold truncate",
                        isActive ? "text-white/90" : "text-slate-400",
                      )}
                    >
                      {isActive
                        ? isMe
                          ? "Your turn"
                          : "Their turn"
                        : `${homeCount} home · ${runningCount} running`}
                    </p>
                  </div>
                </div>

                {/* Right: 4 round dots representing pieces home */}
                <div
                  className="flex items-center gap-1.5 shrink-0 pl-2"
                  title={`${homeCount}/4 pieces home`}
                >
                  {[0, 1, 2, 3].map((dotIdx) => {
                    const isHome = dotIdx < homeCount;
                    if (isActive) {
                      return (
                        <span
                          key={dotIdx}
                          className={cn(
                            "size-2.5 rounded-full transition-all duration-200",
                            isHome
                              ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] scale-110"
                              : "bg-white/25 border border-white/40",
                          )}
                        />
                      );
                    }
                    return (
                      <span
                        key={dotIdx}
                        className={cn(
                          "size-2.5 rounded-full transition-all duration-200",
                          isHome
                            ? "shadow-[0_0_8px_currentColor] scale-110"
                            : "bg-white/10 border border-white/15",
                        )}
                        style={
                          isHome
                            ? { backgroundColor: seat.boardHex, color: seat.boardHex }
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
      </div>
    </>
  );
}
