import { useSyncExternalStore } from "react"

export interface AudioSettings {
  muted: boolean
  /** 0..1 */
  musicVolume: number
  /** 0..1 */
  sfxVolume: number
}

const STORAGE_KEY = "kridora:audio-settings"
const DEFAULTS: AudioSettings = { muted: false, musicVolume: 0.4, sfxVolume: 0.7 }

function clamp01(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      muted: parsed.muted === true,
      musicVolume: clamp01(parsed.musicVolume, DEFAULTS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULTS.sfxVolume),
    }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateAudioSettings(patch: Partial<AudioSettings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Storage can be unavailable (private mode); settings still work for this tab.
  }
  listeners.forEach((l) => l())
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribe, () => current)
}
