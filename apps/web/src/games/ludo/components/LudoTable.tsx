import {
  CircleHelp,
  LogOut,
  Smile,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import {
  LUDO_HOME_STEP,
  type LudoColor,
  type LudoGameState,
} from "@kridora/shared";
import { updateAudioSettings, type AudioSettings } from "@/lib/audio-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ludoAudio } from "../audio";
import { boardTurns, ROLL_MS } from "../motion";
import { SEAT_DEFINITIONS } from "../constants";
import { LudoBoard } from "./LudoBoard";
import styles from "../table.module.css";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!rolling) return;
    const timer = window.setInterval(() => setFrame((f) => f + 1), 65);
    return () => window.clearInterval(timer);
  }, [rolling]);
  const face = rolling ? (frame % 6) + 1 : value;
  return (
    <span
      className={`${styles.die} ${rolling ? styles.dieRolling : ""}`}
      style={{ "--roll-ms": `${ROLL_MS}ms` } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={PIPS[face]?.includes(i) ? styles.pip : styles.blankPip}
        />
      ))}
    </span>
  );
}

interface LudoTableProps {
  state: LudoGameState;
  userId: string;
  roomCode: string;
  audio: AudioSettings;
  canRoll: boolean;
  rollingColor: LudoColor | null;
  disabled: boolean;
  animating: boolean;
  onRoll: () => void;
  onMove: (index: number) => void;
  onAnimationComplete: () => void;
  onLeave: () => void;
  onStandings: () => void;
  onEmote: (emoji: string) => void;
  activeEmotes: Record<string, { emoji: string; timestamp: number }>;
  playerAvatars: Record<string, string | null>;
}

export function LudoTable(props: LudoTableProps) {
  const { state, userId, audio, canRoll, rollingColor, animating } = props;
  const [help, setHelp] = useState(false);
  const [emotes, setEmotes] = useState(false);
  // Full game animation was explicitly requested; the quieter option stays one tap away.
  const [reducedMotion, setReducedMotion] = useState(() => {
    try {
      return localStorage.getItem("kridora:ludo-motion") === "reduced";
    } catch {
      return false;
    }
  });
  const local = state.players.find((p) => p.userId === userId);
  const turns = boardTurns(local?.color);
  const active = state.players[state.currentPlayerIndex];
  const yourTurn = active?.userId === userId;
  const status = state.winnerId
    ? "Match complete"
    : animating
      ? ""
      : rollingColor
        ? ""
        : yourTurn
          ? state.dice === null
            ? "Your turn"
            : state.movableTokens.length
              ? "Your move"
              : "No moves"
          : `${active?.name ?? "Player"}'s turn`;

  useEffect(() => {
    ludoAudio.setSettings(audio);
    const unlock = () => ludoAudio.unlock(audio);
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audio]);

  return (
    <section
      className={`${styles.table} ${reducedMotion ? styles.reducedMotion : ""}`}
      aria-label="Ludo game table"
    >
      <header className={styles.tableHeader}>
        <div className={styles.wordmark}>
          <span className={styles.logoMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            LUDO <small>CLASSIC</small>
          </span>
        </div>
        <div className={styles.tableTools}>
          <span className={styles.roomCode} title="Room code">
            {props.roomCode}
          </span>
          <button
            type="button"
            aria-label={audio.muted ? "Turn sound on" : "Mute sound"}
            title={audio.muted ? "Turn sound on" : "Mute sound"}
            aria-pressed={!audio.muted}
            onClick={() => updateAudioSettings({ muted: !audio.muted })}
          >
            {audio.muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button
            type="button"
            aria-label={
              reducedMotion ? "Enable full animations" : "Reduce animations"
            }
            title={
              reducedMotion ? "Enable full animations" : "Reduce animations"
            }
            aria-pressed={!reducedMotion}
            onClick={() => {
              const reduced = !reducedMotion;
              setReducedMotion(reduced);
              try {
                localStorage.setItem(
                  "kridora:ludo-motion",
                  reduced ? "reduced" : "full",
                );
              } catch {
                /* Preference still applies for this match. */
              }
            }}
          >
            {reducedMotion ? <ZapOff /> : <Zap />}
          </button>
          <button
            type="button"
            aria-label="Match standings"
            title="Match standings"
            onClick={props.onStandings}
          >
            <Trophy />
          </button>
          <button
            type="button"
            aria-label="How to play"
            title="How to play"
            onClick={() => setHelp(true)}
          >
            <CircleHelp />
          </button>
          <button
            type="button"
            aria-label="Leave match"
            title="Leave match"
            onClick={props.onLeave}
          >
            <LogOut />
          </button>
        </div>
      </header>

      <div className={styles.arena}>
        {state.players.map((p, index) => {
          const seat = SEAT_DEFINITIONS[p.color];
          const position = (seat.id + turns) % 4;
          const right = position === 1 || position === 2;
          const current = !state.winnerId && active?.userId === p.userId;
          const value =
            current && state.dice !== null
              ? state.dice
              : (state.lastRolls[index] ?? 1);
          const image = props.playerAvatars[p.userId] ?? p.image;
          const home = p.tokens.filter((t) => t === LUDO_HOME_STEP).length;
          const mine = p.userId === userId;
          return (
            <div
              key={p.userId}
              className={`${styles.playerSeat} ${styles[`seat${position}`]} ${current ? styles.activeSeat : ""}`}
              style={{ "--seat-color": seat.boardHex } as CSSProperties}
              role="group"
              aria-label={`${p.name}${mine ? ", you" : ""}${current ? ", current turn" : ""}`}
            >
              <div
                className={`${styles.playerCard} ${right ? styles.playerCardRight : ""}`}
              >
                <div className={styles.avatar}>
                  {image ? (
                    <img src={image} alt="" />
                  ) : (
                    <span>{p.name.charAt(0).toUpperCase()}</span>
                  )}
                  {mine && <i aria-label="You" />}
                </div>
                <div className={styles.identity}>
                  <strong title={p.name}>{p.name}</strong>
                  <span
                    className={styles.homeProgress}
                    aria-label={`${home} of 4 pieces home`}
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <i key={i} className={i < home ? styles.homeDone : ""} />
                    ))}
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.diceButton} ${current ? styles.activeDie : ""}`}
                  disabled={!mine || !canRoll}
                  onClick={props.onRoll}
                  aria-label={
                    mine && canRoll
                      ? "Roll dice"
                      : `${p.name}'s die showing ${value}`
                  }
                  title={mine && canRoll ? "Roll dice · Space" : undefined}
                >
                  <Die value={value} rolling={rollingColor === p.color} />
                </button>
              </div>
              {props.activeEmotes[p.userId] && (
                <span
                  key={props.activeEmotes[p.userId].timestamp}
                  className={styles.emoteBubble}
                  role="status"
                >
                  {props.activeEmotes[p.userId].emoji}
                </span>
              )}
            </div>
          );
        })}
        <div className={styles.boardSlot}>
          <LudoBoard
            state={state}
            userId={userId}
            onMoveToken={props.onMove}
            audioSettings={audio}
            disabled={props.disabled}
            reducedMotion={reducedMotion}
            onAnimationComplete={props.onAnimationComplete}
          />
        </div>
      </div>

      <footer className={styles.tableFooter}>
        <span
          className={`${styles.turnStatus} ${yourTurn ? styles.yourTurn : ""}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <i />
          {status || (animating ? "In play" : "Rolling")}
        </span>
        <div className={styles.emoteControl}>
          {emotes && (
            <div className={styles.emotePicker} aria-label="Choose a reaction">
              {["👋", "😎", "😂", "😮", "🔥", "👏"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={`Send ${emoji}`}
                  onClick={() => {
                    props.onEmote(emoji);
                    setEmotes(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={styles.reactionButton}
            aria-label="Reactions"
            aria-expanded={emotes}
            onClick={() => setEmotes((e) => !e)}
          >
            <Smile />
            <span>Say hi</span>
          </button>
        </div>
      </footer>
      <p className="sr-only" aria-live="polite">
        {!animating && !rollingColor ? state.lastAction : ""}
      </p>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-[390px] border-0 bg-transparent p-0">
          <div className={styles.helpCard}>
            <button
              type="button"
              className={styles.closeHelp}
              aria-label="Close how to play"
              autoFocus
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <span className={styles.helpEyebrow}>A CLASSIC FOR A REASON</span>
            <DialogTitle>One board. All to play for.</DialogTitle>
            <ul>
              <li>
                <b>Roll a six</b> to bring a piece onto the board.
              </li>
              <li>
                <b>Tap a glowing piece</b> or drag it to the marked square.
              </li>
              <li>
                <b>Land on a rival</b> to send them back. Stars and colored
                starts are safe.
              </li>
              <li>
                <b>Reach the center</b> with an exact roll. First to bring all
                four home wins.
              </li>
            </ul>
            <DialogDescription>
              A six, capture or home arrival earns another roll. Use Tab and
              Enter for pieces, or Space to roll.
            </DialogDescription>
            <button
              type="button"
              className={styles.helpDone}
              onClick={() => setHelp(false)}
            >
              Let's play
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
