import {
  type TruthAndDareAgeGroup,
  type TruthAndDareCharacter,
  type TruthAndDareMode,
  type TruthAndDareSpinner,
  type TruthAndDareState,
} from "@kridora/shared";
import {
  Check,
  Compass,
  Heart,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
  Wine,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeError, request, socket } from "@/lib/socket";
import {
  updateTruthAndDarePreferences,
  useTruthAndDarePreferences,
} from "./preferences";
import type { GameComponentProps } from "../types";
import styles from "./truth-and-dare.module.css";

const CHARACTER_OPTIONS: Array<{
  id: TruthAndDareCharacter;
  label: string;
  face: string;
}> = [
  { id: "boy", label: "Boy", face: "👦" },
  { id: "girl", label: "Girl", face: "👧" },
  { id: "man", label: "Man", face: "👨" },
  { id: "woman", label: "Woman", face: "👩" },
  { id: "nonbinary", label: "Non-binary", face: "🧑" },
  { id: "mystery", label: "Mystery", face: "🎭" },
];

const AGE_OPTIONS: Array<{
  id: TruthAndDareAgeGroup;
  label: string;
  ages: string;
  detail: string;
  mark: string;
}> = [
  {
    id: "family",
    label: "Family",
    ages: "8+",
    detail: "All-ages prompts",
    mark: "☀",
  },
  {
    id: "teen",
    label: "Teen",
    ages: "13–17",
    detail: "School & friend energy",
    mark: "✦",
  },
  {
    id: "adult",
    label: "Adult",
    ages: "18+",
    detail: "Grown-up good vibes",
    mark: "✺",
  },
];

const SPINNER_OPTIONS: Array<{
  id: TruthAndDareSpinner;
  label: string;
  detail: string;
}> = [
  { id: "bottle", label: "Bottle", detail: "The party classic" },
  { id: "wand", label: "Magic wand", detail: "A little sparkle" },
  { id: "compass", label: "Compass", detail: "Pick your direction" },
];

const MODE_OPTIONS: Array<{
  id: TruthAndDareMode;
  label: string;
  age: string;
}> = [
  { id: "chill", label: "Chill", age: "All ages" },
  { id: "funny", label: "Funny", age: "All ages" },
  { id: "family", label: "Family", age: "8+" },
  { id: "couples", label: "Couples", age: "18+" },
  { id: "spicy", label: "Spicy", age: "18+" },
];

function CharacterFace({ character }: { character: TruthAndDareCharacter }) {
  return (
    <>
      {CHARACTER_OPTIONS.find((option) => option.id === character)?.face ??
        "🎭"}
    </>
  );
}

function SpinnerIcon({ spinner }: { spinner: TruthAndDareSpinner }) {
  if (spinner === "wand") {
    return <WandSparkles className={styles.wand} aria-hidden="true" />;
  }
  if (spinner === "compass") {
    return <Compass className={styles.compass} aria-hidden="true" />;
  }
  return (
    <svg
      className={styles.bottle}
      viewBox="0 0 72 112"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M26 8h20v19l7 10v57a9 9 0 0 1-9 9H28a9 9 0 0 1-9-9V37l7-10V8Z"
        fill="url(#bottle-fill)"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M25 8h22v9H25z"
        fill="#ffd477"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M22 59h28v24H22z"
        fill="rgba(255,212,119,.2)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M28 31h16M27 94h18"
        stroke="rgba(255,255,255,.65)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="bottle-fill"
          x1="20"
          y1="20"
          x2="52"
          y2="100"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffb9e8" stopOpacity=".95" />
          <stop offset="1" stopColor="#a257ec" stopOpacity=".55" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function playTick(context: AudioContext | null, frequency: number) {
  if (!context || context.state !== "running") return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.035);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.04);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function vibrate(duration: number) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(duration);
  } catch {
    // Vibration is optional on browsers and devices.
  }
}

export default function TruthAndDareGame({ room, userId }: GameComponentProps) {
  const [state, setState] = useState<TruthAndDareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spinningChallengeId, setSpinningChallengeId] = useState<number | null>(
    null,
  );
  const [mobilePanel, setMobilePanel] = useState<"players" | "rules">(
    "players",
  );
  const [dareSeconds, setDareSeconds] = useState(30);
  const [showConfetti, setShowConfetti] = useState(false);
  const [spicyConfirmOpen, setSpicyConfirmOpen] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [pendingAdultMode, setPendingAdultMode] = useState<"couples" | "spicy">(
    "spicy",
  );
  const preferences = useTruthAndDarePreferences();
  const spinTimer = useRef<number | null>(null);
  const confettiTimer = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const previousState = useRef<TruthAndDareState | null>(null);

  const refresh = useCallback(() => {
    void request("truth-and-dare:get-state", {})
      .then(setState)
      .catch((err) => setError(describeError(err)));
  }, []);

  useEffect(() => {
    const onState = (next: TruthAndDareState) => setState(next);
    socket.on("truth-and-dare:state", onState);
    refresh();
    return () => {
      socket.off("truth-and-dare:state", onState);
      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    };
  }, [refresh]);

  const spinId = state?.selection?.createdAt ?? null;
  const spinIsAnimating = spinId !== null && spinId === spinningChallengeId;
  useEffect(() => {
    if (spinId === null) {
      setSpinningChallengeId(null);
      return;
    }
    setSpinningChallengeId(spinId);
    if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => {
      setSpinningChallengeId((active) => (active === spinId ? null : active));
      vibrate(35);
      spinTimer.current = null;
    }, 2300);
    return () => {
      if (spinTimer.current !== null) window.clearTimeout(spinTimer.current);
    };
  }, [spinId]);

  useEffect(() => {
    const challenge = state?.challenge;
    if (!challenge || challenge.type !== "dare") {
      setDareSeconds(30);
      return;
    }
    const updateTimer = () => {
      const revealAt = challenge.createdAt + 650;
      setDareSeconds(
        Math.max(0, Math.ceil((revealAt + 30_000 - Date.now()) / 1000)),
      );
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [state?.challenge?.createdAt, state?.challenge?.type]);

  useEffect(() => {
    if (!state) return;
    const previous = previousState.current;
    const completedDare =
      previous?.challenge?.type === "dare" &&
      !state.challenge &&
      state.history[0]?.type === "dare" &&
      state.history[0]?.result === "done";
    previousState.current = state;
    if (!completedDare) return;
    setShowConfetti(true);
    if (confettiTimer.current !== null)
      window.clearTimeout(confettiTimer.current);
    confettiTimer.current = window.setTimeout(
      () => setShowConfetti(false),
      1800,
    );
    return () => {
      if (confettiTimer.current !== null)
        window.clearTimeout(confettiTimer.current);
    };
  }, [state]);

  useEffect(() => {
    if (!spinIsAnimating) return;
    let cancelled = false;
    let step = 0;
    let timer = 0;
    const tick = () => {
      if (cancelled) return;
      if (preferences.soundEnabled)
        playTick(audioContext.current, 760 - Math.min(step * 15, 420));
      step += 1;
      if (step < 12) timer = window.setTimeout(tick, 85 + step * 13);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [spinIsAnimating, preferences.soundEnabled]);

  const submit = async (action: () => Promise<TruthAndDareState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await action());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <section className={styles.loading}>
        <Sparkles className="mx-auto size-8 animate-pulse text-pink-300" />
        <h1>Setting up the circle…</h1>
        {error && <p role="alert">{error}</p>}
        <Button className="mt-4" variant="outline" onClick={refresh}>
          Reconnect
        </Button>
      </section>
    );
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const me = state.players.find((player) => player.userId === userId);
  const isMyTurn = currentPlayer?.userId === userId;
  const lockedSettings = state.history.length > 0 || state.phase !== "choosing";
  const visibleModeOptions =
    state.settings.ageGroup === "adult"
      ? MODE_OPTIONS
      : MODE_OPTIONS.filter(
          (mode) => mode.id !== "couples" && mode.id !== "spicy",
        );
  const targetId = state.challenge?.targetId ?? state.selection?.targetId;
  const targetIndex = targetId
    ? state.players.findIndex((player) => player.userId === targetId)
    : -1;
  const targetAngle =
    targetIndex >= 0 && state.players.length > 0
      ? `${(targetIndex * 360) / state.players.length}deg`
      : "0deg";
  const selectedTarget = targetId
    ? state.players.find((player) => player.userId === targetId)
    : null;
  const selectedAgeOption = AGE_OPTIONS.find(
    (option) => option.id === state.settings.ageGroup,
  );
  const handleConfigure = (
    ageGroup: TruthAndDareAgeGroup,
    spinner: TruthAndDareSpinner,
    mode: TruthAndDareMode = state.settings.mode,
  ) => {
    if (mode === "spicy" || mode === "couples") {
      setPendingAdultMode(mode);
      setSpicyConfirmOpen(true);
      return;
    }
    void submit(() =>
      request("truth-and-dare:configure", {
        ageGroup,
        spinner,
        mode,
      }),
    );
  };

  function unlockSpinAudio() {
    if (typeof window === "undefined") return;
    if (!audioContext.current) {
      const AudioContextConstructor = window.AudioContext;
      if (AudioContextConstructor)
        audioContext.current = new AudioContextConstructor();
    }
    if (audioContext.current?.state === "suspended") {
      void audioContext.current.resume().catch(() => undefined);
    }
  }

  function choosePrompt(type: "truth" | "dare") {
    void submit(() => request("truth-and-dare:choose", { choice: type }));
  }

  function spinBottle() {
    unlockSpinAudio();
    vibrate(14);
    void submit(() => request("truth-and-dare:spin", {}));
  }

  function confirmSpicyMode() {
    if (!ageConfirmed) return;
    void submit(() =>
      request("truth-and-dare:configure", {
        ageGroup: "adult",
        spinner: state?.settings.spinner ?? "bottle",
        mode: pendingAdultMode,
      }),
    );
    updateTruthAndDarePreferences({
      mode: pendingAdultMode,
      ageGroup: "adult",
    });
    setAgeConfirmed(false);
    setSpicyConfirmOpen(false);
  }

  return (
    <main
      className={styles.gameShell}
      data-theme="arcade"
      data-tone="dark"
      onPointerDown={unlockSpinAudio}
    >
      <header className={styles.gameHeader}>
        <div className={styles.brandLockup}>
          <span className={styles.brandIcon}>
            <Sparkles aria-hidden="true" />
          </span>
          <div>
            <p className={styles.eyebrow}>
              Kridora party table · Round {state.round}
            </p>
            <h1>
              Truth <span>or</span> Dare!
            </h1>
          </div>
        </div>
        <div className={styles.headerPills}>
          <span className={styles.ageBadge}>
            {
              AGE_OPTIONS.find(
                (option) => option.id === state.settings.ageGroup,
              )?.label
            }{" "}
            pack
          </span>
          <span className={styles.playerCount}>
            {state.players.length} at the table
          </span>
          <button
            type="button"
            className={styles.headerControl}
            aria-label={
              preferences.soundEnabled
                ? "Mute spin sounds"
                : "Enable spin sounds"
            }
            aria-pressed={preferences.soundEnabled}
            onClick={() =>
              updateTruthAndDarePreferences({
                soundEnabled: !preferences.soundEnabled,
              })
            }
          >
            {preferences.soundEnabled ? (
              <Volume2 aria-hidden="true" />
            ) : (
              <VolumeX aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {showConfetti && (
        <div className={styles.confettiLayer} aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--confetti-x": `${(index * 37) % 100}%`,
                  "--confetti-delay": `${(index % 6) * 0.045}s`,
                  "--confetti-hue": `${(index * 39) % 360}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className={styles.gameGrid}>
        <aside
          id="players-panel"
          role="tabpanel"
          className={`${styles.playerPanel} ${mobilePanel === "players" ? styles.mobilePanelActive : ""}`}
          aria-label="Players in lobby"
        >
          <div className={styles.panelTitle}>
            <span className={styles.panelNumber}>
              <Users aria-hidden="true" />
            </span>
            <div>
              <h2>Players in lobby</h2>
              <p>{state.players.length} of 8 seats filled</p>
            </div>
          </div>
          <ol className={styles.playerRoster}>
            {state.players.map((player) => {
              const isCurrent = player.userId === currentPlayer?.userId;
              const isTarget = player.userId === targetId;
              return (
                <li
                  key={player.userId}
                  className={isTarget ? styles.rosterTarget : ""}
                >
                  <span className={styles.rosterAvatar}>
                    <CharacterFace character={player.character} />
                  </span>
                  <span className={styles.rosterName}>
                    <strong>
                      {player.name}
                      {player.userId === userId ? " (you)" : ""}
                    </strong>
                    <small>
                      {isTarget
                        ? "Your turn!"
                        : isCurrent
                          ? "Spinner"
                          : "At the table"}
                    </small>
                  </span>
                  {player.userId === room.ownerId && (
                    <span className={styles.hostBadge}>HOST</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className={styles.roomInviteHint}>
            <strong>ROOM {room.code}</strong>
            <span>Invite your friends to fill the table.</span>
          </div>
        </aside>

        <section className={styles.playArea} aria-label="Truth and Dare table">
          <div className={styles.tableTopline}>
            <span>
              <i className={styles.liveDot} /> LIVE PARTY
            </span>
            <span className={styles.roomCode}>ROOM {room.code}</span>
          </div>

          <div className={styles.arena}>
            <div className={styles.tableShadow} aria-hidden="true" />
            <div className={styles.tableSurface} aria-hidden="true">
              <div className={styles.tableInlay} />
              <div className={styles.tableCenterGlow} />
            </div>

            {state.players.map((player, index) => {
              const angle =
                (Math.PI * 2 * index) / Math.max(state.players.length, 1) -
                Math.PI / 2;
              const isTurn =
                player.userId === currentPlayer?.userId &&
                !state.challenge &&
                !state.selection;
              const isTarget = player.userId === targetId;
              const seatStyle = {
                left: `${50 + Math.cos(angle) * 36}%`,
                top: `${50 + Math.sin(angle) * 34}%`,
              } as CSSProperties;
              return (
                <div
                  key={player.userId}
                  className={`${styles.seat} ${isTurn ? styles.seatTurn : ""} ${isTarget ? styles.seatTarget : ""} ${player.userId === userId ? styles.seatMine : ""}`}
                  style={seatStyle}
                  aria-label={`${player.name}${player.userId === userId ? ", you" : ""}${isTurn ? ", spinning" : ""}${isTarget ? ", selected by the spinner" : ""}`}
                >
                  <span className={styles.seatHalo} />
                  <span className={styles.avatar}>
                    <CharacterFace character={player.character} />
                  </span>
                  <span className={styles.playerName}>
                    {player.name}
                    {player.userId === userId && <small>YOU</small>}
                  </span>
                  {isTurn && <span className={styles.seatTag}>SPINNING</span>}
                  {isTarget && <span className={styles.seatTag}>PICKED!</span>}
                </div>
              );
            })}

            <div
              className={styles.centerpiece}
              aria-label={`Center ${state.settings.spinner}`}
            >
              <span className={styles.centerLabel}>
                {state.challenge || state.selection
                  ? "THE SPIN PICKED"
                  : "THE SPINNER"}
              </span>
              <div
                className={`${styles.spinnerTrack} ${spinIsAnimating ? styles.spinning : ""}`}
                style={{ "--target-angle": targetAngle } as CSSProperties}
                onAnimationEnd={() => {
                  setSpinningChallengeId(null);
                  if (spinTimer.current !== null) {
                    window.clearTimeout(spinTimer.current);
                    spinTimer.current = null;
                  }
                  vibrate(35);
                }}
              >
                <div className={styles.spinnerIcon}>
                  <SpinnerIcon spinner={state.settings.spinner} />
                </div>
              </div>
              <strong>
                {selectedTarget?.name ?? currentPlayer?.name ?? "Waiting"}
              </strong>
              <span className={styles.spinnerCaption}>
                {
                  SPINNER_OPTIONS.find(
                    (option) => option.id === state.settings.spinner,
                  )?.label
                }{" "}
                ·{" "}
                {state.challenge
                  ? "Nice and easy…"
                  : state.selection
                    ? "landed on a player"
                    : "ready to spin"}
              </span>
            </div>
          </div>

          <div className={styles.promptDock} aria-live="off">
            {state.challenge ? (
              <div className={styles.challengeCard}>
                <div className={styles.challengeMeta}>
                  <span
                    className={
                      state.challenge.type === "truth"
                        ? styles.truthBadge
                        : styles.dareBadge
                    }
                  >
                    {state.challenge.type === "truth" ? "TRUTH" : "DARE"}
                  </span>
                  <span>
                    {selectedTarget?.name ?? "A player"} is up · spun by{" "}
                    {state.challenge.spinnerName}
                  </span>
                </div>
                <p aria-live="polite">{state.challenge.text}</p>
                {state.challenge.type === "dare" && (
                  <div
                    className={styles.dareTimer}
                    role="timer"
                    aria-label={`${dareSeconds} seconds left for the dare`}
                  >
                    <span>
                      {dareSeconds
                        ? `${dareSeconds}s to try it`
                        : "Time is up — finish or skip"}
                    </span>
                    <i>
                      <b style={{ width: `${(dareSeconds / 30) * 100}%` }} />
                    </i>
                  </div>
                )}
                {selectedTarget?.userId === userId ? (
                  <div className={styles.challengeActions}>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void submit(() =>
                          request("truth-and-dare:finish", { result: "done" }),
                        )
                      }
                      className={styles.doneButton}
                    >
                      <Check /> Done, pass the spin
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        void submit(() =>
                          request("truth-and-dare:finish", { result: "skip" }),
                        )
                      }
                      className={styles.skipButton}
                    >
                      Skip this prompt
                    </Button>
                  </div>
                ) : (
                  <span className={styles.waitingCopy}>
                    Cheer them on — skipping is always okay.
                  </span>
                )}
              </div>
            ) : state.selection ? (
              spinIsAnimating ? (
                <div className={styles.spinMessage} role="status">
                  <Sparkles aria-hidden="true" /> {state.selection.spinnerName}{" "}
                  spun the table…
                </div>
              ) : selectedTarget?.userId === userId ? (
                <div className={styles.chooseDock}>
                  <div className={styles.chooseCopy}>
                    <span className={styles.turnKicker}>
                      <Sparkles aria-hidden="true" /> YOUR TURN
                    </span>
                    <strong>The bottle picked you! Choose your card.</strong>
                  </div>
                  <div className={styles.choiceButtons}>
                    <button
                      disabled={busy}
                      className={styles.truthChoice}
                      onClick={() => choosePrompt("truth")}
                    >
                      <span>TRUTH</span>
                      <small>Tell a little story</small>
                    </button>
                    <button
                      disabled={busy}
                      className={styles.dareChoice}
                      onClick={() => choosePrompt("dare")}
                    >
                      <span>DARE</span>
                      <small>Try something playful</small>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.waitingDock}>
                  <span className={styles.turnKicker}>
                    <Sparkles aria-hidden="true" />{" "}
                    {selectedTarget?.name ?? "A player"} WAS PICKED
                  </span>
                  <strong>They choose Truth or Dare.</strong>
                </div>
              )
            ) : isMyTurn ? (
              <div className={styles.spinDock}>
                <div className={styles.chooseCopy}>
                  <span className={styles.turnKicker}>
                    <Sparkles aria-hidden="true" /> YOUR SPIN
                  </span>
                  <strong>Spin the bottle and see who gets the pick.</strong>
                </div>
                <Button
                  className={styles.spinButton}
                  disabled={busy || state.players.length < 2}
                  onClick={spinBottle}
                >
                  <RotateCcw aria-hidden="true" />{" "}
                  {busy ? "Spinning…" : "Spin the bottle"}
                </Button>
              </div>
            ) : (
              <div className={styles.waitingDock}>
                <span className={styles.turnKicker}>
                  <Sparkles aria-hidden="true" />{" "}
                  {currentPlayer?.name ?? "Next player"} IS SPINNING
                </span>
                <strong>Who will the table pick?</strong>
              </div>
            )}
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </div>
          <p className={styles.kindness}>
            <Heart aria-hidden="true" /> Good vibes only. Prompts are optional,
            and anyone can skip.
          </p>
        </section>

        <div
          className={styles.mobilePanelTabs}
          role="tablist"
          aria-label="Room details"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "players"}
            aria-controls="players-panel"
            onClick={() => setMobilePanel("players")}
          >
            Players <span>{state.players.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePanel === "rules"}
            aria-controls="rules-panel"
            onClick={() => setMobilePanel("rules")}
          >
            Rules & activity
          </button>
        </div>

        <aside
          id="rules-panel"
          role="tabpanel"
          className={`${styles.sidePanel} ${mobilePanel === "rules" ? styles.mobilePanelActive : ""}`}
          aria-label="Rules and recent activity"
        >
          <section className={styles.panelSection}>
            <div className={styles.panelTitle}>
              <span className={styles.panelNumber}>01</span>
              <div>
                <h2>Age pack</h2>
                <p>Selected on the first page.</p>
              </div>
            </div>
            <div className={styles.agePackSummary} role="status">
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>
                  {selectedAgeOption?.label} · {selectedAgeOption?.ages}
                </strong>
                <small>This pack was chosen on the first page.</small>
              </span>
            </div>
          </section>

          <section className={styles.panelSection}>
            <div className={styles.panelTitle}>
              <span className={styles.panelNumber}>02</span>
              <div>
                <h2>Choose the spinner</h2>
                <p>What takes the center?</p>
              </div>
            </div>
            <div
              className={styles.spinnerOptions}
              role="group"
              aria-label="Choose spinner object"
            >
              {SPINNER_OPTIONS.map((option) => {
                const Icon =
                  option.id === "bottle"
                    ? Wine
                    : option.id === "wand"
                      ? WandSparkles
                      : Compass;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={`${option.label}: ${option.detail}`}
                    aria-pressed={state.settings.spinner === option.id}
                    disabled={busy || lockedSettings}
                    className={`${styles.spinnerOption} ${state.settings.spinner === option.id ? styles.spinnerSelected : ""}`}
                    onClick={() =>
                      handleConfigure(state.settings.ageGroup, option.id)
                    }
                  >
                    <Icon aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            <div className={styles.modePickerHeading}>
              <span>Content mode</span>
              <small>Set before the first spin</small>
            </div>
            <div
              className={styles.modePicker}
              role="group"
              aria-label="Choose content mode"
            >
              {visibleModeOptions.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={state.settings.mode === mode.id}
                  disabled={busy || lockedSettings}
                  className={`${styles.modeButton} ${state.settings.mode === mode.id ? styles.modeButtonSelected : ""}`}
                  onClick={() =>
                    handleConfigure(
                      state.settings.ageGroup,
                      state.settings.spinner,
                      mode.id,
                    )
                  }
                >
                  <span>{mode.label}</span>
                  <small>{mode.age}</small>
                </button>
              ))}
            </div>
            {state.settings.mode === "spicy" && (
              <p className={styles.helperText}>
                18+ only. Every prompt remains optional.
              </p>
            )}
          </section>

          <section className={styles.panelSection}>
            <div className={styles.panelTitle}>
              <span className={styles.panelNumber}>03</span>
              <div>
                <h2>Pick your character</h2>
                <p>Everyone chooses their own look.</p>
              </div>
            </div>
            <div
              className={styles.characterGrid}
              role="group"
              aria-label="Choose your character"
            >
              {CHARACTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={me?.character === option.id}
                  disabled={busy}
                  className={`${styles.characterOption} ${me?.character === option.id ? styles.characterSelected : ""}`}
                  onClick={() =>
                    void submit(() =>
                      request("truth-and-dare:set-character", {
                        character: option.id,
                      }),
                    )
                  }
                >
                  <span>{option.face}</span>
                  <small>{option.label}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.recentSection}>
            <div className={styles.panelTitle}>
              <span className={styles.panelNumber}>
                <RotateCcw aria-hidden="true" />
              </span>
              <div>
                <h2>Recent spins</h2>
                <p>
                  {state.history.length
                    ? `${state.history.length} turns at this table`
                    : "The first spin is waiting."}
                </p>
              </div>
            </div>
            {state.history.length > 0 ? (
              <ol className={styles.historyList}>
                {state.history.slice(0, 4).map((turn, index) => (
                  <li key={`${turn.playerId}-${index}-${turn.prompt}`}>
                    <span
                      className={
                        turn.type === "truth"
                          ? styles.historyTruth
                          : styles.historyDare
                      }
                    >
                      {turn.type}
                    </span>
                    <p>
                      <strong>{turn.spinnerName}</strong> spun for{" "}
                      <strong>{turn.playerName}</strong>
                      {turn.result === "skip" ? " · skipped" : " · done"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyHistory}>
                Your table’s best moments will show up here.
              </p>
            )}
          </section>
        </aside>
      </div>

      <Dialog
        open={spicyConfirmOpen}
        onOpenChange={(open) => {
          setSpicyConfirmOpen(open);
          if (!open) setAgeConfirmed(false);
        }}
      >
        <DialogContent className={styles.ageDialog}>
          <div className={styles.spicyConfirm}>
            <span aria-hidden="true">🌶️</span>
            <DialogTitle>
              {pendingAdultMode === "spicy"
                ? "Spicy mode is for adults"
                : "Couples mode is for adults"}
            </DialogTitle>
            <DialogDescription>
              Every player must be 18 or older. Prompts stay respectful, and
              anyone can skip.
            </DialogDescription>
            <label className={styles.ageCheck}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(event) => setAgeConfirmed(event.target.checked)}
              />
              I confirm every player is 18 or older.
            </label>
            <Button disabled={!ageConfirmed || busy} onClick={confirmSpicyMode}>
              Continue to {pendingAdultMode === "spicy" ? "Spicy" : "Couples"}{" "}
              (18+)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
