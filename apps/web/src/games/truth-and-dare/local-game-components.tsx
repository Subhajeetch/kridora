import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import landingStyles from "./landing.module.css";
import type {
  GamePhase,
  LocalGamePlayer,
  LocalGameState,
  LocalPrompt,
  PromptType,
  VoteReaction,
} from "./useGameMachine";
import styles from "./local-game.module.css";

const REACTIONS: Array<{ emoji: VoteReaction; label: string }> = [
  { emoji: "👍", label: "Count it" },
  { emoji: "👎", label: "Not yet" },
  { emoji: "😂", label: "That was funny" },
  { emoji: "🔥", label: "Great energy" },
];

export function Bottle({
  phase,
  angle,
  onSpin,
  className,
}: {
  phase: GamePhase;
  angle: number;
  onSpin: () => void;
  className: string;
}) {
  const canSpin = phase === "idle";
  return (
    <button
      type="button"
      className={`${className} ${styles.bottleTrigger} ${phase === "spinning" ? styles.bottleSpinning : ""}`}
      style={{ "--spin-angle": `${angle}deg` } as CSSProperties}
      onClick={onSpin}
      disabled={!canSpin}
      aria-label={
        canSpin
          ? "Spin the bottle to choose a player"
          : phase === "spinning"
            ? "Bottle is spinning"
            : "Bottle has selected a player"
      }
      aria-live="polite"
      title={canSpin ? "Tap to spin" : undefined}
    >
      <i className={styles.bottleGlyph} aria-hidden="true" />
      <small>{phase === "spinning" ? "SPINNING…" : "TAP TO SPIN"}</small>
    </button>
  );
}
export function TurnChoice({
  playerName,
  truthAvailable,
  dareAvailable,
  notice,
  onChoose,
  onRandom,
}: {
  playerName: string;
  truthAvailable: boolean;
  dareAvailable: boolean;
  notice: string | null;
  onChoose: (type: PromptType) => void;
  onRandom: () => void;
}) {
  return (
    <section className={styles.turnPanel} aria-label={`${playerName}'s turn`}>
      <div className={styles.turnStatus} aria-live="polite" aria-atomic="true">
        <span className={styles.turnBadge}>YOUR TURN</span>
        <strong>{playerName} gets to choose a card.</strong>
      </div>
      <div className={styles.turnChoices}>
        <button
          type="button"
          className={styles.truthChoice}
          disabled={!truthAvailable}
          onClick={() => onChoose("truth")}
          aria-label="Choose a Truth prompt"
        >
          <strong>TRUTH</strong>
          <small>Tell a little story</small>
        </button>
        <button
          type="button"
          className={styles.dareChoice}
          disabled={!dareAvailable}
          onClick={() => onChoose("dare")}
          aria-label="Choose a Dare prompt"
        >
          <strong>DARE</strong>
          <small>Try a playful challenge</small>
        </button>
      </div>
      <button
        type="button"
        className={styles.randomChoice}
        disabled={!truthAvailable && !dareAvailable}
        onClick={onRandom}
      >
        🎲 Random
      </button>
      {notice && <p className={styles.gameNotice} role="status">{notice}</p>}
    </section>
  );
}

export function PromptCard({
  prompt,
  playerName,
  revealed,
}: {
  prompt: LocalPrompt;
  playerName: string;
  revealed: boolean;
}) {
  return (
    <article
      className={`${styles.promptCard} ${revealed ? styles.promptRevealed : ""}`}
      aria-live="polite"
      aria-atomic="true"
      aria-label={`${prompt.type === "truth" ? "Truth" : "Dare"} prompt for ${playerName}`}
    >
      <div className={styles.promptCardInner}>
        <div className={styles.promptFront} aria-hidden="true">
          <span>✦</span>
          <strong>READY?</strong>
        </div>
        <div className={styles.promptFace} aria-hidden={!revealed}>
          <span
            className={
              prompt.type === "truth" ? styles.truthLabel : styles.dareLabel
            }
          >
            {prompt.type === "truth" ? "TRUTH" : "DARE"} · {playerName}
          </span>
          <p>{prompt.text}</p>
        </div>
      </div>
    </article>
  );
}

export function Timer({ seconds, duration = 30 }: { seconds: number; duration?: number }) {
  const percent = Math.max(0, Math.min(100, (seconds / duration) * 100));
  return (
    <div
      className={styles.timer}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
      aria-live="off"
    >
      <div className={styles.timerLabels}>
        <span>DARE TIMER</span>
        <strong>{`00:${String(seconds).padStart(2, "0")}`}</strong>
      </div>
      <div
        className={styles.timerTrack}
        role="progressbar"
        aria-label="Time remaining"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={seconds}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function VoteBar({
  state,
  voter,
  onVote,
}: {
  state: LocalGameState;
  voter: LocalGamePlayer | undefined;
  onVote: (playerId: string, reaction: VoteReaction) => void;
}) {
  const total = state.voteOrder.length;
  const cast = Object.keys(state.votes).length;
  const positive = Object.values(state.votes).filter(
    (reaction) => reaction !== "👎",
  ).length;
  const fillPercent = total > 0 ? (positive / total) * 100 : 0;

  return (
    <section className={styles.votePanel} aria-label="Pass-around vote">
      <div className={styles.voteHeading} aria-live="polite" aria-atomic="true">
        <span className={styles.turnBadge}>PASS THE SCREEN</span>
        <strong>{voter ? `${voter.name}, cast your vote` : "Vote complete"}</strong>
      </div>
      <div className={styles.voteMeter}>
        <div
          className={styles.voteTrack}
          role="progressbar"
          aria-label="Positive votes"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={positive}
        >
          <span style={{ width: `${fillPercent}%` }} />
        </div>
        <small>{cast} of {total} votes · {positive} count it</small>
      </div>
      {voter ? (
        <div className={styles.reactionGrid} role="group" aria-label={`${voter.name}'s reaction`}>
          {REACTIONS.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onVote(voter.id, emoji)}
              aria-label={label}
            >
              <span aria-hidden="true">{emoji}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.gameNotice}>Everyone has voted.</p>
      )}
    </section>
  );
}

export function Scoreboard({
  players,
  currentPlayerIndex,
  selectedPlayerIndex,
}: {
  players: LocalGamePlayer[];
  currentPlayerIndex: number;
  selectedPlayerIndex: number | null;
}) {
  return (
    <ol className={styles.scoreboard} aria-label="Live score and streak table">
      {players.map((player, index) => (
        <li
          key={player.id}
          className={index === selectedPlayerIndex ? styles.scoreSelected : ""}
        >
          <span className={styles.scoreAvatar} aria-hidden="true">{player.avatar}</span>
          <span className={styles.scoreName}>
            <strong>{player.name}</strong>
            <small>
              {index === selectedPlayerIndex
                ? `Picked this turn · ${player.streak} streak`
                : index === currentPlayerIndex
                  ? `Up next to spin · ${player.streak} streak`
                  : `${player.streak} streak`}
            </small>
          </span>
          <span className={styles.scorePoints} aria-label={`${player.score} points`}>
            {player.score}<small>PTS</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SoundToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.soundToggle}
      aria-label={enabled ? "Mute spin sounds" : "Enable spin sounds"}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
      Sound {enabled ? "on" : "off"}
    </button>
  );
}

export function AgeConfirmModal({
  open,
  mode,
  checked,
  onCheckedChange,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  mode: "couples" | "spicy" | null;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const description =
    mode === "couples"
      ? "Couples mode is for players 18 and older."
      : mode === "spicy"
        ? "Spicy mode is for players 18 and older."
        : "The Adult age pack is for players 18 and older.";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className={`${landingStyles.guideDialog} max-w-md p-5 sm:p-7`}>
        <div className={landingStyles.spicyConfirm}>
          <span aria-hidden="true">🌶️</span>
          <DialogTitle>{description}</DialogTitle>
          <DialogDescription>
            Every player must be 18 or older. Keep every prompt respectful and
            optional; anyone can skip at any time.
          </DialogDescription>
          <label className={landingStyles.ageCheck}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onCheckedChange(event.target.checked)}
            />
            I confirm every player is 18 or older.
          </label>
          <div className={styles.modalActions}>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" disabled={!checked} onClick={onConfirm}>
              Confirm 18+
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RewardPanel({
  result,
  player,
  prompt,
  onNext,
}: {
  result: LocalGameState["turnResult"];
  player: LocalGamePlayer | undefined;
  prompt: LocalPrompt | null;
  onNext: () => void;
}) {
  const title =
    result === "skipped"
      ? "No pressure. Your turn is complete."
      : result === "counted"
        ? "The table counts it!"
        : "The table says: not this time.";
  return (
    <section className={styles.rewardPanel} aria-live="polite" aria-atomic="true">
      <span aria-hidden="true">{result === "counted" ? "✨" : "💜"}</span>
      <strong>{title}</strong>
      <p>
        {result === "skipped"
          ? `${player?.name ?? "Player"} used a skip. One point was spent.`
          : result === "counted"
            ? `${player?.name ?? "Player"} earned a point and extended a streak with that ${prompt?.type === "dare" ? "Dare" : "Truth"}.`
            : "No point this time. The next turn is ready."}
      </p>
      <Button type="button" onClick={onNext}>
        Next turn
      </Button>
    </section>
  );
}
