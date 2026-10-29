import { ChevronDown, Crown, Dices, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LudoColor, LudoGameState, LudoPlayerState, RoomSnapshot } from "@kridora/shared";
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
  rollingColor: LudoColor | null;
  diceValue: number;
  onRoll: () => void;
  onEmote: (emoji: string) => void;
  onLeaveGame: () => void;
  activeEmotes: Record<string, { emoji: string; timestamp: number }>;
  playerAvatars: Record<string, string | null>;
}

export function NocturneSidePanel({
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
  onLeaveGame,
  activeEmotes,
  playerAvatars,
}: NocturneSidePanelProps) {
  const [emojiDropdownOpen, setEmojiDropdownOpen] = useState(false);
  const emojiDropdownRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

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

  // Helper for subtitle in Dice Card
  const getDiceHeadline = () => {
    if (isRolling) return "Rolling...";
    if (state.dice !== null) return `Rolled a ${state.dice}`;
    if (canRoll) return "Roll now";
    if (isMyTurn && state.movableTokens.length > 0) return "Select a piece";
    if (isMyTurn && state.movableTokens.length === 0 && state.dice !== null) return "No valid moves";
    return `Waiting for ${activePlayer?.name ?? "player"}...`;
  };

  const getDiceHint = () => {
    if (state.dice === 6) return "A six gives an extra roll!";
    if (canRoll) return "A six starts a piece.";
    if (isMyTurn && state.movableTokens.length > 0) return "Select a highlighted pawn.";
    if (isMyTurn && state.movableTokens.length === 0 && state.dice !== null) return "Turn passes shortly.";
    return "A six starts a piece.";
  };

  return (
    <div className="hidden md:flex w-full md:w-[320px] lg:w-[350px] xl:w-[370px] shrink-0 flex-col gap-3 select-none">

      {/* 2. DICE CARD (Dark card with 3D rolling die well + status headlines) */}
      <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-[#161822]/90 p-3.5 backdrop-blur-md shadow-lg">
        {/* 3D Die Well */}
        <button
          type="button"
          onClick={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          aria-label={canRoll ? "Tap to roll die" : `Die value ${diceValue}`}
          className={cn(
            "relative size-14 shrink-0 rounded-2xl bg-slate-950/80 p-1 flex items-center justify-center border border-white/10 shadow-inner transition-transform",
            styles.dicePod,
            canRoll && [
              styles.podActive,
              "hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.4)]",
            ],
            !canRoll && "opacity-90 cursor-default",
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

        {/* Dice status text */}
        <div className="min-w-0 flex-1 leading-tight">
          <span
            className="text-[11px] font-black uppercase tracking-wider"
            style={{ color: activeSeat.boardHex }}
          >
            {isMyTurn ? "Your turn" : `${activePlayer?.name ?? "Player"}'s turn`}
          </span>
          <h3 className="truncate text-base font-black text-white mt-0.5">
            {getDiceHeadline()}
          </h3>
          <p className="truncate text-[11px] font-medium text-slate-400 mt-0.5">
            {getDiceHint()}
          </p>
        </div>
      </div>

      {/* 3. BIG "ROLL THE DIE" ACTION BUTTON + SMILE EMOJI DROPDOWN */}
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={canRoll ? onRoll : undefined}
          disabled={!canRoll}
          className={cn(
            "relative h-12 sm:h-13 flex-1 rounded-2xl font-black text-sm tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 select-none",
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
                    ? "Select a piece"
                    : "Turn passing..."
                  : `Waiting for ${activePlayer?.name ?? "player"}...`}
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
              "size-12 sm:size-13 shrink-0 rounded-2xl border border-white/10 transition-all flex items-center justify-center active:scale-95 cursor-pointer shadow-md",
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

      {/* 4. PLAYERS LIST (Only showing available players in the match) */}
      <div className="flex flex-col gap-2">
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
                "relative flex items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all duration-300",
                isActive
                  ? "bg-gradient-to-r from-[#ff5768] to-[#ff4155] text-white shadow-lg shadow-rose-950/40"
                  : "bg-[#161822]/80 border border-white/6 hover:border-white/10 text-slate-200 backdrop-blur-md",
              )}
            >
              {/* Left: Avatar with optional floating emote */}
              <div className="relative flex items-center gap-3 min-w-0">
                <div className="relative size-10 shrink-0">
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

                  {/* Floating animated emoji bubble */}
                  {emoteEntry && (
                    <div
                      key={`${emoteEntry.emoji}-${emoteEntry.timestamp}`}
                      className={styles.floatingEmote}
                    >
                      {emoteEntry.emoji}
                    </div>
                  )}
                </div>

                {/* Name & turn status */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "truncate text-sm font-black",
                        isActive ? "text-white drop-shadow-sm" : "text-white",
                      )}
                    >
                      {p.name}
                    </span>
                    {isMe && (
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1 rounded",
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
                      "text-[11px] font-semibold truncate",
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
                          "size-2.5 rounded-full transition-all duration-300",
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
                        "size-2.5 rounded-full transition-all duration-300",
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

      {/* 5. EMOTES REACTION BAR */}
      <div className="flex flex-col gap-1.5 mt-1">
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
                className="size-10 sm:size-11 rounded-xl bg-white/5 hover:bg-white/15 active:scale-90 text-xl sm:text-2xl flex items-center justify-center transition cursor-pointer hover:shadow-md"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. LEAVE GAME BUTTON (Matching reference image bottom left pill) */}
      <button
        type="button"
        onClick={onLeaveGame}
        className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer self-center mt-1"
      >
        <span>← Leave game</span>
      </button>
    </div>
  );
}
