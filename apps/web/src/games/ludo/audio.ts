import type { AudioSettings } from "@/lib/audio-settings";

class LudoSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(settings?: AudioSettings): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (settings && (settings.muted || settings.sfxVolume <= 0.01)) return null;

    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    type: OscillatorType = "sine",
    duration = 0.09,
    delay = 0,
    peakGain = 0.16,
    endFreq: number | null = null,
    settings?: AudioSettings,
  ) {
    const ctx = this.ensureContext(settings);
    if (!ctx) return;

    const masterVol = settings ? (settings.muted ? 0 : settings.sfxVolume) : 0.8;
    if (masterVol <= 0.01) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      }

      const scaledPeak = Math.max(0.001, peakGain * masterVol);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(scaledPeak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.015);
    } catch {
      // Audio is non-blocking enhancement
    }
  }

  diceRoll(settings?: AudioSettings) {
    for (let i = 0; i < 6; i++) {
      this.tone(240 + i * 55 + Math.random() * 90, "triangle", 0.042, i * 0.055, 0.14, null, settings);
    }
  }

  diceLand(val: number, settings?: AudioSettings) {
    this.tone(val === 6 ? 660 : 420, "sine", 0.11, 0, 0.18, null, settings);
    if (val === 6) {
      this.tone(880, "triangle", 0.18, 0.07, 0.2, null, settings);
    }
  }

  hoverTick(settings?: AudioSettings) {
    this.tone(540, "sine", 0.035, 0, 0.06, null, settings);
  }

  hop(stepIndex = 0, settings?: AudioSettings) {
    const f = 370 + (stepIndex % 9) * 44;
    this.tone(f, "sine", 0.08, 0, 0.16, f * 1.18, settings);
  }

  unlockBase(settings?: AudioSettings) {
    this.tone(440, "triangle", 0.1, 0, 0.18, null, settings);
    this.tone(659.25, "triangle", 0.14, 0.07, 0.2, null, settings);
    this.tone(880, "triangle", 0.2, 0.14, 0.22, null, settings);
  }

  safeZone(settings?: AudioSettings) {
    this.tone(587.33, "triangle", 0.13, 0, 0.16, null, settings);
    this.tone(880, "triangle", 0.22, 0.08, 0.18, null, settings);
  }

  captureHit(settings?: AudioSettings) {
    this.tone(680, "sawtooth", 0.12, 0, 0.2, 220, settings);
    this.tone(480, "triangle", 0.22, 0.1, 0.22, 140, settings);
  }

  returnZip(idx = 0, settings?: AudioSettings) {
    const f = Math.max(180, 720 - idx * 35);
    this.tone(f, "sine", 0.04, 0, 0.08, null, settings);
  }

  homeFinish(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, "triangle", 0.18, i * 0.075, 0.2, null, settings));
  }

  invalid(settings?: AudioSettings) {
    this.tone(240, "sawtooth", 0.12, 0, 0.12, null, settings);
    this.tone(190, "sawtooth", 0.18, 0.1, 0.12, null, settings);
  }

  victory(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((n, i) => this.tone(n, "triangle", 0.32, i * 0.09, 0.22, null, settings));
  }

  roomJoin(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((n, i) => this.tone(n, "sine", 0.14, i * 0.08, 0.16, null, settings));
  }

  roomLeave(settings?: AudioSettings) {
    const notes = [783.99, 659.25, 523.25];
    notes.forEach((n, i) => this.tone(n, "sine", 0.14, i * 0.08, 0.16, null, settings));
  }

  emotePop(settings?: AudioSettings) {
    this.tone(540, "sine", 0.08, 0, 0.15, 880, settings);
  }
}

export const ludoAudio = new LudoSoundEngine();
