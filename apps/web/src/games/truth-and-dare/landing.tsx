import {
  ArrowLeft,
  BookOpen,
  DoorOpen,
  Hash,
  Heart,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TruthAndDareAgeGroup, TruthAndDareMode } from "@kridora/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import styles from "./landing.module.css";
import { AgeConfirmModal } from "./local-game-components";
import {
  updateTruthAndDarePreferences,
  useTruthAndDarePreferences,
} from "./preferences";

interface TruthAndDareLandingProps {
  onPlay: (preferences: {
    mode: TruthAndDareMode;
    ageGroup: TruthAndDareAgeGroup;
  }) => void;
  onExit: () => void;
  onJoinCode: () => void;
  onJoinPublic: () => void;
  playDisabled: boolean;
  publicDisabled: boolean;
  isBusy: boolean;
  hasRoom: boolean;
  errorMessage: string | null;
  players: Array<{ userId: string; name: string; image: string | null }>;
  currentUserName: string;
}

const PREVIEW_CARDS = [
  { type: "TRUTH", emoji: "🤔", text: "What silly superpower would you pick?" },
  { type: "DARE", emoji: "💃", text: "Do your funniest victory dance!" },
  { type: "TRUTH", emoji: "🌟", text: "What always makes you laugh?" },
  { type: "DARE", emoji: "🐸", text: "Make your best frog impression!" },
] as const;

export function TruthAndDareLanding({
  onPlay,
  onExit,
  onJoinCode,
  onJoinPublic,
  playDisabled,
  publicDisabled,
  isBusy,
  hasRoom,
  errorMessage,
  players,
  currentUserName,
}: TruthAndDareLandingProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [spicyConfirmOpen, setSpicyConfirmOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [adultConfirmedForSession, setAdultConfirmedForSession] =
    useState(false);
  const [pendingAdultAction, setPendingAdultAction] = useState<
    "select-age" | "create-party" | null
  >(null);
  const [pendingAdultMode, setPendingAdultMode] = useState<
    "couples" | "spicy" | null
  >(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinNumber, setSpinNumber] = useState(0);
  const [previewCard, setPreviewCard] = useState<
    (typeof PREVIEW_CARDS)[number] | null
  >(null);
  const preferences = useTruthAndDarePreferences();
  const currentOnlinePlayer = players.find(
    (player) =>
      player.name.toLowerCase() === currentUserName.toLowerCase(),
  );
  const friendPlayers = players.filter(
    (player) => player !== currentOnlinePlayer,
  );
  const seatNames = Array.from({ length: 4 }, (_, index) =>
    index === 0 ? "You" : friendPlayers[index - 1]?.name ?? "Friend",
  );
  const spinTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    },
    [],
  );

  function spinPreview() {
    if (isSpinning) return;
    const card =
      PREVIEW_CARDS[Math.floor(Math.random() * PREVIEW_CARDS.length)]!;
    setPreviewCard(null);
    setIsSpinning(true);
    setSpinNumber((number) => number + 1);
    spinTimer.current = window.setTimeout(() => {
      setPreviewCard(card);
      setIsSpinning(false);
      spinTimer.current = null;
    }, 1500);
  }

  function openAdultConfirmation(
    mode: TruthAndDareMode,
    action: "select-age" | "create-party",
  ) {
    setPendingAdultMode(mode === "couples" || mode === "spicy" ? mode : null);
    setPendingAdultAction(action);
    setAdultConfirmedForSession(false);
    setAgeConfirmed(false);
    setSpicyConfirmOpen(true);
  }

  function cancelAdultConfirmation() {
    setAgeConfirmed(false);
    setPendingAdultMode(null);
    setPendingAdultAction(null);
    setSpicyConfirmOpen(false);
  }

  function handleAgePackChange(ageGroup: TruthAndDareAgeGroup) {
    if (ageGroup === "adult") {
      openAdultConfirmation(preferences.mode, "select-age");
      return;
    }
    const mode =
      preferences.mode === "couples" || preferences.mode === "spicy"
        ? "funny"
        : preferences.mode;
    updateTruthAndDarePreferences({ ageGroup, mode });
    setAdultConfirmedForSession(false);
  }

  function handleCreateParty() {
    const mode =
      preferences.ageGroup !== "adult" &&
      (preferences.mode === "couples" || preferences.mode === "spicy")
        ? "funny"
        : preferences.mode;
    if (mode !== preferences.mode) updateTruthAndDarePreferences({ mode });
    if (hasRoom) {
      onPlay({ mode, ageGroup: preferences.ageGroup });
      return;
    }
    const requiresAdultConfirmation =
      preferences.ageGroup === "adult" ||
      mode === "couples" ||
      mode === "spicy";
    if (requiresAdultConfirmation && !adultConfirmedForSession) {
      openAdultConfirmation(mode, "create-party");
      return;
    }
    onPlay({ mode, ageGroup: preferences.ageGroup });
  }

  function confirmAdultSettings() {
    if (!ageConfirmed || !pendingAdultAction) return;
    const action = pendingAdultAction;
    const mode =
      preferences.mode === "couples" || preferences.mode === "spicy"
        ? preferences.mode
        : "funny";
    updateTruthAndDarePreferences({ ageGroup: "adult" });
    setAdultConfirmedForSession(true);
    setAgeConfirmed(false);
    setPendingAdultMode(null);
    setPendingAdultAction(null);
    setSpicyConfirmOpen(false);
    if (action === "create-party") onPlay({ mode, ageGroup: "adult" });
  }

  return (
    <section
      className={styles.page}
      aria-label="Truth and Dare main menu"
      data-theme="arcade"
      data-tone="dark"
    >
      <section className={styles.hero}>
        <div className={styles.backgroundGlow} aria-hidden="true" />
        <div className={styles.topline}>
          <button className={styles.exitLink} type="button" onClick={onExit}>
            <ArrowLeft aria-hidden="true" /> Exit
          </button>
          <span className={styles.brand}>
            <Sparkles aria-hidden="true" /> LET'S PLAY!
          </span>
          <div className={styles.topControls}>
            <span className={styles.playerRange}>
              <Users aria-hidden="true" /> 2–8 PLAYERS
            </span>
          </div>
        </div>

        <div className={styles.lobbyStage}>
          <div className={styles.centerContent}>
            <h1 className={styles.playfulTitle}>
              Truth <span>or</span> <em className={styles.titleDare}>Dare!</em>
            </h1>
            <div
              className={`${styles.tableArt} ${isSpinning ? styles.tableSpinning : ""}`}
            >
              {[
                ["👧", seatNames[0], styles.playerTop],
                ["🧑", seatNames[1], styles.playerRight],
                ["👦", seatNames[2], styles.playerBottom],
                ["👩", seatNames[3], styles.playerLeft],
              ].map(([avatar, name, position], index) => (
                <span
                  key={`preview-seat-${index}`}
                  className={`${styles.miniPlayer} ${position}`}
                >
                  <b>{avatar}</b>
                  <small>{name}</small>
                </span>
              ))}
              <span className={styles.tableDisc} />
              <button
                type="button"
                className={`${styles.artCenter} ${isSpinning ? styles.bottleSpinning : ""}`}
                onClick={spinPreview}
                disabled={isSpinning}
                aria-label={
                  isSpinning
                    ? "Bottle is spinning"
                    : "Spin the bottle for a sample card"
                }
                title="Tap to spin!"
              >
                <i />
                <small>{isSpinning ? "SPIN!" : "TAP TO SPIN"}</small>
              </button>
              <span className={styles.sparkleOne}>✦</span>
              <span className={styles.sparkleTwo}>✧</span>
              {isSpinning && (
                <>
                  <span
                    className={`${styles.flightCard} ${styles.flightTruth}`}
                    aria-hidden="true"
                  >
                    TRUTH
                  </span>
                  <span
                    className={`${styles.flightCard} ${styles.flightDare}`}
                    aria-hidden="true"
                  >
                    DARE
                  </span>
                  <span className={styles.flightEmoji} aria-hidden="true">
                    ✨
                  </span>
                </>
              )}
            </div>

            {previewCard && (
              <div
                className={styles.previewCard}
                key={`${previewCard.type}-${previewCard.text}-${spinNumber}`}
                aria-live="polite"
              >
                <span className={styles.previewEmoji}>{previewCard.emoji}</span>
                <span
                  className={
                    previewCard.type === "TRUTH"
                      ? styles.previewTruth
                      : styles.previewDare
                  }
                >
                  {previewCard.type}
                </span>
                <p>{previewCard.text}</p>
                <button type="button" onClick={spinPreview}>
                  Spin again ↻
                </button>
              </div>
            )}
            {!previewCard && !isSpinning && (
              <p className={styles.spinPrompt}>
                Give the bottle a tap and flip a silly sample card!
              </p>
            )}
            <div className={styles.homeAgeControl}>
              <label htmlFor="td-home-age-pack">
                <ShieldCheck aria-hidden="true" /> Age pack
              </label>
              <select
                id="td-home-age-pack"
                value={preferences.ageGroup}
                disabled={hasRoom || isBusy}
                onChange={(event) =>
                  handleAgePackChange(
                    event.target.value as TruthAndDareAgeGroup,
                  )
                }
              >
                <option value="family">Family · 8+</option>
                <option value="teen">Teen · 13–17</option>
                <option value="adult">Adult · 18+</option>
              </select>
              <small>
                {hasRoom
                  ? "This party’s age pack is already set."
                  : "Choose the youngest player’s age group"}
              </small>
            </div>
            <div className={styles.actions}>
              <Button
                size="lg"
                className={styles.playButton}
                disabled={playDisabled || isBusy}
                onClick={handleCreateParty}
              >
                <Play className="size-5" fill="currentColor" />
                {isBusy
                  ? "Starting your party…"
                  : hasRoom
                    ? "Continue party"
                    : "Create party"}
              </Button>
            </div>

            <div className={styles.secondaryActions}>
              <Button
                type="button"
                variant="outline"
                className={styles.secondaryButton}
                onClick={onJoinCode}
              >
                <Hash aria-hidden="true" /> Join with code
              </Button>
              <Button
                type="button"
                variant="outline"
                className={styles.secondaryButton}
                onClick={onJoinPublic}
                disabled={publicDisabled}
              >
                <DoorOpen aria-hidden="true" /> Public parties
              </Button>
            </div>
            <button
              type="button"
              className={styles.guideLink}
              onClick={() => setGuideOpen(true)}
            >
              <BookOpen aria-hidden="true" /> How to play & age guide
              <span aria-hidden="true">›</span>
            </button>
            {errorMessage && (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            )}
          </div>

        </div>
      </section>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className={`${styles.guideDialog} max-w-2xl p-5 sm:p-7`}>
          <div className={styles.dialogHeader}>
            <span className={styles.guideIcon}>
              <BookOpen aria-hidden="true" />
            </span>
            <div className={styles.dialogHeading}>
              <DialogTitle>How to play</DialogTitle>
              <DialogDescription>
                Quick rules and the age guide for your party.
              </DialogDescription>
            </div>
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Close guide"
              onClick={() => setGuideOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className={styles.guideGrid}>
            <article className={styles.guideCard}>
              <div className={styles.guideHeading}>
                <span className={styles.guideIcon}>
                  <BookOpen aria-hidden="true" />
                </span>
                <div>
                  <p>THE QUICK GUIDE</p>
                  <h2>How to play</h2>
                </div>
              </div>
              <ol className={styles.steps}>
                <li>
                  <span>01</span>
                  <p>
                    <strong>Start a party</strong> Create a room and invite 1–7
                    friends, or join an open room.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    <strong>Pick your look</strong> Choose a character, then set
                    the age pack and spinner for the group.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    <strong>Spin the bottle</strong> It picks a player, who
                    chooses Truth or Dare.
                  </p>
                </li>
                <li>
                  <span>04</span>
                  <p>
                    <strong>Answer, try it, or skip</strong> The selected player
                    can complete the prompt or skip. Then the next turn begins.
                  </p>
                </li>
              </ol>
              <p className={styles.kindReminder}>
                <Heart aria-hidden="true" /> Keep it friendly. No one has to
                explain a skip.
              </p>
            </article>

            <article className={styles.guideCard}>
              <div className={styles.guideHeading}>
                <span className={`${styles.guideIcon} ${styles.ageIcon}`}>
                  <ShieldCheck aria-hidden="true" />
                </span>
                <div>
                  <p>PLAY AT THE RIGHT LEVEL</p>
                  <h2>Age limit & packs</h2>
                </div>
              </div>
              <div className={styles.minimumAge}>
                <span>MINIMUM AGE</span>
                <strong>8+</strong>
                <p>Players under 8 should not join this game.</p>
              </div>
              <ul className={styles.agePacks}>
                <li>
                  <span className={styles.familyMark}>☀</span>
                  <p>
                    <strong>Family · 8+</strong>
                    <small>Easy, all-ages questions and playful dares.</small>
                  </p>
                </li>
                <li>
                  <span className={styles.teenMark}>✦</span>
                  <p>
                    <strong>Teen · 13–17</strong>
                    <small>
                      School, hobbies, friends, and creative challenges.
                    </small>
                  </p>
                </li>
                <li>
                  <span className={styles.adultMark}>✺</span>
                  <p>
                    <strong>Adult · 18+</strong>
                    <small>
                      Social prompts and lighthearted group challenges.
                    </small>
                  </p>
                </li>
              </ul>
              <p className={styles.ageReminder}>
                Choose the pack that matches the youngest player. Every prompt
                is optional and skippable.
              </p>
            </article>
          </div>
        </DialogContent>
      </Dialog>
      <AgeConfirmModal
        open={spicyConfirmOpen}
        mode={pendingAdultMode}
        checked={ageConfirmed}
        onCheckedChange={setAgeConfirmed}
        onConfirm={confirmAdultSettings}
        onCancel={cancelAdultConfirmation}
      />
    </section>
  );
}
