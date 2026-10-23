import type { AudioSettings } from "@/lib/audio-settings"

type Sound = "roll" | "step" | "unlock" | "capture" | "home" | "win"

// Drop replacement clips in public/audio/ludo and set that event's path here.
// Keep null to use the synthesized fallback below.
const LUDO_SOUND_FILES: Record<Sound, string | null> = {
  roll: null, // dice-roll.mp3
  step: null, // token-step.mp3
  unlock: null, // token-unlock.mp3
  capture: null, // token-capture.mp3
  home: null, // token-home.mp3
  win: null, // game-win.mp3
}

export function playLudoSound(sound: Sound, settings: AudioSettings) {
  if (settings.muted || settings.sfxVolume <= 0 || typeof window === "undefined") return
  const file = LUDO_SOUND_FILES[sound]
  if (file) {
    const clip = new Audio(file)
    clip.volume = settings.sfxVolume
    void clip.play().catch(() => playSynthesizedLudoSound(sound, settings))
    return
  }
  playSynthesizedLudoSound(sound, settings)
}

function playSynthesizedLudoSound(sound: Sound, settings: AudioSettings) {
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = settings.sfxVolume * 0.24
    master.connect(context.destination)

    const note = (frequency: number, start: number, duration: number, type: OscillatorType, volume = 1, endFrequency = frequency) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + start)
      if (endFrequency !== frequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), context.currentTime + start + duration)
      }
      gain.gain.setValueAtTime(0.0001, context.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), context.currentTime + start + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(context.currentTime + start)
      oscillator.stop(context.currentTime + start + duration + 0.02)
    }

    if (sound === "roll") {
      note(480, 0, 0.08, "triangle", 0.75)
      note(720, 0.07, 0.1, "triangle", 0.9)
      note(610, 0.15, 0.16, "sine", 0.7)
    } else if (sound === "step") {
      note(520, 0, 0.075, "triangle", 0.48, 320)
      note(760, 0.012, 0.055, "sine", 0.22, 620)
    } else if (sound === "unlock") {
      note(250, 0, 0.11, "triangle", 0.75)
      note(540, 0.055, 0.14, "sine", 0.55)
    } else if (sound === "capture") {
      note(320, 0, 0.16, "triangle", 0.8, 170)
      note(155, 0.09, 0.24, "sawtooth", 0.42, 90)
    } else if (sound === "home") {
      note(660, 0, 0.12, "sine", 0.55)
      note(880, 0.08, 0.18, "triangle", 0.65)
    } else {
      ;[523, 659, 784, 1047].forEach((frequency, index) => note(frequency, index * 0.11, 0.28, "sine", 0.8))
    }

    window.setTimeout(() => void context.close(), 1200)
  } catch {
    // Audio is an optional enhancement; the game remains playable if the browser blocks it.
  }
}
