import { useSyncExternalStore } from "react";
import type { TruthAndDareAgeGroup, TruthAndDareMode } from "@kridora/shared";

export const TRUTH_AND_DARE_THEMES = [
  { id: "neon", label: "Neon Party", icon: "💜" },
  { id: "arcade", label: "Retro Arcade", icon: "🕹️" },
  { id: "beach", label: "Beach Night", icon: "🌴" },
  { id: "cozy", label: "Cozy Campfire", icon: "🔥" },
  { id: "space", label: "Space", icon: "🪐" },
] as const;

export type TruthAndDareTheme = (typeof TRUTH_AND_DARE_THEMES)[number]["id"];

export interface TruthAndDarePreferences {
  theme: TruthAndDareTheme;
  lightMode: boolean;
  ageGroup: TruthAndDareAgeGroup;
  mode: TruthAndDareMode;
  soundEnabled: boolean;
}

const STORAGE_KEY = "kridora:truth-and-dare-preferences";
const DEFAULTS: TruthAndDarePreferences = {
  theme: "neon",
  lightMode: false,
  ageGroup: "family",
  mode: "funny",
  soundEnabled: true,
};

function readPreferences(): TruthAndDarePreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as Partial<TruthAndDarePreferences>;
    return {
      theme: TRUTH_AND_DARE_THEMES.some((theme) => theme.id === saved.theme)
        ? (saved.theme as TruthAndDareTheme)
        : DEFAULTS.theme,
      lightMode: saved.lightMode === true,
      ageGroup:
        saved.ageGroup === "family" ||
        saved.ageGroup === "teen" ||
        saved.ageGroup === "adult"
          ? saved.ageGroup
          : DEFAULTS.ageGroup,
      mode:
        saved.mode === "chill" ||
        saved.mode === "funny" ||
        saved.mode === "family" ||
        saved.mode === "couples" ||
        saved.mode === "spicy"
          ? saved.mode
          : DEFAULTS.mode,
      soundEnabled: saved.soundEnabled !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = readPreferences();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

export function getTruthAndDarePreferences() {
  return current;
}

export function updateTruthAndDarePreferences(
  patch: Partial<TruthAndDarePreferences>,
) {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Preferences still update for this tab when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function useTruthAndDarePreferences() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = readPreferences();
    listeners.forEach((listener) => listener());
  });
}
