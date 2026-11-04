import { useEffect, useState } from "react";
import type { TruthAndDareMode, TruthAndDareState } from "@kridora/shared";
import { describeError, request, socket } from "@/lib/socket";
import { updateTruthAndDarePreferences } from "./preferences";
import styles from "./room-setup.module.css";

const MODES: Array<{
  id: TruthAndDareMode;
  label: string;
  detail: string;
  icon: string;
}> = [
  { id: "chill", label: "Chill", detail: "Easygoing", icon: "🌙" },
  { id: "funny", label: "Funny", detail: "Silly prompts", icon: "😂" },
  { id: "family", label: "Family", detail: "All ages", icon: "🎈" },
  { id: "couples", label: "Couples", detail: "18+", icon: "💞" },
  { id: "spicy", label: "Spicy", detail: "18+", icon: "🌶️" },
];

type SettingsPatch = Partial<TruthAndDareState["settings"]>;

export function TruthAndDareRoomSetup() {
  const [state, setState] = useState<TruthAndDareState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const updateState = (next: TruthAndDareState) => {
      if (!active) return;
      setState((current) =>
        current && current.updatedAt > next.updatedAt ? current : next,
      );
    };

    socket.on("truth-and-dare:state", updateState);
    void request("truth-and-dare:get-state", {})
      .then(updateState)
      .catch((requestError: unknown) => {
        if (active) setError(describeError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      socket.off("truth-and-dare:state", updateState);
    };
  }, []);

  async function saveSettings(patch: SettingsPatch) {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    const settings = { ...state.settings, ...patch };
    try {
      const next = await request("truth-and-dare:configure", settings);
      setState(next);
      updateTruthAndDarePreferences({
        mode: next.settings.mode,
        ageGroup: next.settings.ageGroup,
      });
    } catch (requestError) {
      setError(describeError(requestError));
    } finally {
      setBusy(false);
    }
  }

  function requestSettings(patch: SettingsPatch, mode: TruthAndDareMode) {
    if (!state || busy) return;
    if (state.settings.mode === mode) return;
    void saveSettings(patch);
  }

  if (loading && !state) {
    return (
      <section className={styles.setup} aria-label="Party setup" aria-busy="true">
        <p className={styles.loading}>Loading party settings…</p>
      </section>
    );
  }

  if (!state) {
    return (
      <section className={styles.setup} aria-label="Party setup">
        <p className={styles.error} role="alert">
          {error ?? "Party settings could not be loaded. Refresh the room to try again."}
        </p>
      </section>
    );
  }

  const locked = state.history.length > 0 || state.phase !== "choosing";
  const visibleModes =
    state.settings.ageGroup === "adult"
      ? MODES
      : MODES.filter((mode) => mode.id !== "couples" && mode.id !== "spicy");
  const agePackLabel =
    state.settings.ageGroup === "adult"
      ? "Adult · 18+"
      : state.settings.ageGroup === "teen"
        ? "Teen · 13–17"
        : "Family · 8+";

  return (
    <section className={styles.setup} aria-label="Party vibe settings">
        <div className={styles.headingRow}>
          <div>
            <h2>Pick your party vibe</h2>
            <p>Choose the mood while everyone joins the table.</p>
          </div>
          <span className={styles.liveBadge}>
            <i aria-hidden="true" /> Live setup
          </span>
        </div>

        <div
          className={`${styles.modeGrid} ${state.settings.ageGroup !== "adult" ? styles.childModes : ""}`}
          role="group"
          aria-label="Party vibe"
        >
          {visibleModes.map((mode) => {
            const isSelected = state.settings.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                className={`${styles.modeChip} ${isSelected ? styles.selected : ""} ${mode.id === "spicy" ? styles.spicy : ""}`}
                aria-pressed={isSelected}
                disabled={busy || locked}
                onClick={() =>
                  requestSettings({ mode: mode.id }, mode.id)
                }
              >
                <strong>
                  <span aria-hidden="true">{mode.icon}</span> {mode.label}
                </strong>
                <small>{mode.detail}</small>
              </button>
            );
          })}
        </div>

        <div className={styles.ageSummary}>
          <span>Age pack</span>
          <strong>{agePackLabel}</strong>
          <small>Chosen on the first page</small>
        </div>

        {locked && (
          <p className={styles.lockedNote} role="status">
            Party settings are locked after the first spin.
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
  );
}
