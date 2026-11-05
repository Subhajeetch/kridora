import { useSyncExternalStore } from "react";

export interface AudioSettings {
  muted: boolean;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
}

const STORAGE_KEY = "kridora:audio-settings";
const DEFAULTS: AudioSettings = {
  muted: false,
  musicVolume: 0.5,
  sfxVolume: 0.9,
};

function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      muted: parsed.muted === true,
      musicVolume: clamp01(parsed.musicVolume, DEFAULTS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULTS.sfxVolume),
    };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateAudioSettings(patch: Partial<AudioSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be unavailable (private mode); settings still work for this tab.
  }
  listeners.forEach((l) => l());
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribe, () => current);
}

/** Play a gentle, pleasant 2-tone arcade notification chime. */
export function playNotificationSound(settings?: AudioSettings) {
  if (typeof window === "undefined") return;
  const audioSettings = settings ?? current;
  if (audioSettings.muted || audioSettings.sfxVolume <= 0) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const volume = Math.min(1, Math.max(0, audioSettings.sfxVolume * 0.18));

    // A pleasant 2-tone retro arcade notification chime (D5 587Hz -> A5 880Hz)
    const notes = [
      { freq: 587.33, start: 0, duration: 0.12 },
      { freq: 880.0, start: 0.08, duration: 0.22 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });

    setTimeout(() => {
      void ctx.close();
    }, 800);
  } catch {
    // Fail silently if browser blocks autoplay before user gesture
  }
}

/** Upbeat, energetic retro arcade chime for when a player joins the room (C5 -> E5 -> G5). */
export function playPlayerJoinSound(settings?: AudioSettings) {
  if (typeof window === "undefined") return;
  const audioSettings = settings ?? current;
  if (audioSettings.muted || audioSettings.sfxVolume <= 0) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const volume = Math.min(1, Math.max(0, audioSettings.sfxVolume * 0.22));

    // Energetic 8-bit / 16-bit rising coin-in chime (C5 523Hz -> E5 659Hz -> G5 784Hz)
    const notes = [
      { freq: 523.25, start: 0, duration: 0.08 },
      { freq: 659.25, start: 0.07, duration: 0.08 },
      { freq: 783.99, start: 0.14, duration: 0.2 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });

    setTimeout(() => {
      void ctx.close();
    }, 600);
  } catch {
    // Fail silently if browser blocks autoplay
  }
}

/** Subtle, mellow retro descending tone for when a player leaves the room (G4 -> D4). */
export function playPlayerLeaveSound(settings?: AudioSettings) {
  if (typeof window === "undefined") return;
  const audioSettings = settings ?? current;
  if (audioSettings.muted || audioSettings.sfxVolume <= 0) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const volume = Math.min(1, Math.max(0, audioSettings.sfxVolume * 0.18));

    // Mellow 2-tone exit sound (G4 392Hz -> D4 293.66Hz)
    const notes = [
      { freq: 392.0, start: 0, duration: 0.1 },
      { freq: 293.66, start: 0.08, duration: 0.16 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });

    setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    // Fail silently if browser blocks autoplay
  }
}
