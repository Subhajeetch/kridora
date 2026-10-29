import type { AudioSettings } from "@/lib/audio-settings"

type Sound = "turn" | "roll" | "step" | "unlock" | "capture" | "home" | "win"

// Drop replacement clips in public/audio/ludo and set that event's path here.
// Keep null to use the synthesized fallback below.
const LUDO_SOUND_FILES: Record<Sound, string | null> = {
  turn: null, // your-turn.mp3
  roll: null, // dice-roll.mp3
  step: null, // token-step.mp3
  unlock: null, // token-unlock.mp3
  capture: null, // token-capture.mp3
  home: null, // token-home.mp3
  win: null, // game-win.mp3
}

let sharedAudioContext: AudioContext | null = null

function getAudioContext() {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  sharedAudioContext ??= new AudioContextClass()
  return sharedAudioContext
}

export function unlockLudoAudio() {
  if (typeof window === "undefined") return
  try {
    const context = getAudioContext()
    if (context?.state === "suspended") void context.resume().catch(() => undefined)
  } catch {
    // Audio unlock is optional when the browser does not support Web Audio.
  }
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
    const context = getAudioContext()
    if (!context) return
    if (context.state === "suspended") void context.resume().catch(() => undefined)
    const master = context.createGain()
    master.gain.value = settings.sfxVolume * 0.26
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

    const noiseBurst = (start: number, duration: number, volume: number) => {
      const length = Math.max(1, Math.floor(context.sampleRate * duration))
      const buffer = context.createBuffer(1, length, context.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let index = 0; index < length; index += 1) {
        samples[index] = (Math.random() * 2 - 1) * (1 - index / length)
      }
      const source = context.createBufferSource()
      const filter = context.createBiquadFilter()
      const gain = context.createGain()
      const at = context.currentTime + start
      source.buffer = buffer
      filter.type = "bandpass"
      filter.frequency.setValueAtTime(1500, at)
      filter.Q.setValueAtTime(0.8, at)
      gain.gain.setValueAtTime(Math.max(0.0001, volume), at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
      source.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      source.start(at)
      source.stop(at + duration + 0.01)
    }

    if (sound === "turn") {
      note(587, 0, 0.16, "sine", 0.62)
      note(784, 0.09, 0.18, "sine", 0.68)
      note(988, 0.18, 0.24, "triangle", 0.72)
    } else if (sound === "roll") {
      ;[0, 0.065, 0.14, 0.225, 0.32, 0.43].forEach((start, index) => {
        noiseBurst(start, 0.055, index === 5 ? 0.32 : 0.2)
        note(250 + index * 37, start, 0.045, "triangle", 0.18, 150 + index * 16)
      })
      note(660, 0.49, 0.13, "sine", 0.36)
      note(880, 0.56, 0.16, "triangle", 0.28)
    } else if (sound === "step") {
      noiseBurst(0, 0.035, 0.15)
      note(310, 0, 0.075, "triangle", 0.45, 155)
      note(860, 0.008, 0.045, "sine", 0.16, 570)
    } else if (sound === "unlock") {
      noiseBurst(0, 0.07, 0.25)
      note(240, 0, 0.12, "triangle", 0.62, 430)
      note(590, 0.065, 0.16, "sine", 0.52)
    } else if (sound === "capture") {
      noiseBurst(0, 0.08, 0.3)
      note(330, 0, 0.15, "triangle", 0.72, 145)
      note(155, 0.075, 0.24, "sawtooth", 0.36, 78)
    } else if (sound === "home") {
      note(660, 0, 0.12, "sine", 0.55)
      note(880, 0.08, 0.18, "triangle", 0.65)
    } else {
      ;[523, 659, 784, 1047].forEach((frequency, index) => note(frequency, index * 0.11, 0.28, "sine", 0.8))
    }

  } catch {
    // Audio is an optional enhancement; the game remains playable if the browser blocks it.
  }
}
