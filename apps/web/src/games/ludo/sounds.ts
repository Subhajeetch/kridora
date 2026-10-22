import type { AudioSettings } from "@/lib/audio-settings"

type Sound = "roll" | "move" | "capture" | "win"

export function playLudoSound(sound: Sound, settings: AudioSettings) {
  if (settings.muted || settings.sfxVolume <= 0 || typeof window === "undefined") return
  try {
    const AudioContextClass = window.AudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const master = context.createGain()
    master.gain.value = settings.sfxVolume * 0.24
    master.connect(context.destination)

    const note = (frequency: number, start: number, duration: number, type: OscillatorType, volume = 1) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + start)
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
    } else if (sound === "move") {
      note(560, 0, 0.09, "sine", 0.8)
      note(760, 0.06, 0.12, "triangle", 0.65)
    } else if (sound === "capture") {
      note(170, 0, 0.2, "triangle", 0.9)
      note(420, 0.12, 0.14, "sine", 0.8)
    } else {
      ;[523, 659, 784, 1047].forEach((frequency, index) => note(frequency, index * 0.11, 0.28, "sine", 0.8))
    }

    window.setTimeout(() => void context.close(), 1200)
  } catch {
    // Audio is an optional enhancement; the game remains playable if the browser blocks it.
  }
}
