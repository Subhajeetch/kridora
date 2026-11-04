import type { AudioSettings } from "@/lib/audio-settings";

class LudoSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(settings?: AudioSettings): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (settings && (settings.muted || settings.sfxVolume <= 0.01)) return null;

    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
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

    const masterVol = settings
      ? settings.muted
        ? 0
        : settings.sfxVolume
      : 0.8;
    if (masterVol <= 0.01) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          now + duration,
        );
      }

      const scaledPeak = Math.max(0.001, peakGain * masterVol);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(scaledPeak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Non-blocking audio enhancement
    }
  }

  /** Catchy mechanical dice tumble */
  diceRoll(settings?: AudioSettings) {
    for (let i = 0; i < 6; i++) {
      this.tone(
        220 + i * 65 + Math.random() * 80,
        "triangle",
        0.04,
        i * 0.048,
        0.12,
        null,
        settings,
      );
    }
  }

  /** Satisfying dice landing chime (extra bright chord when rolling a 6) */
  diceLand(val: number, settings?: AudioSettings) {
    if (val === 6) {
      // Catchy triumphant arpeggio for rolling a 6
      this.tone(523.25, "sine", 0.1, 0, 0.18, null, settings);
      this.tone(659.25, "triangle", 0.12, 0.06, 0.2, null, settings);
      this.tone(783.99, "triangle", 0.15, 0.12, 0.22, null, settings);
      this.tone(1046.5, "sine", 0.22, 0.18, 0.25, null, settings);
    } else {
      this.tone(380 + val * 45, "sine", 0.09, 0, 0.16, null, settings);
    }
  }

  hoverTick(settings?: AudioSettings) {
    this.tone(580, "sine", 0.03, 0, 0.05, null, settings);
  }

  /** Step hop along track */
  hop(stepIndex = 0, settings?: AudioSettings) {
    const f = 390 + (stepIndex % 8) * 38;
    this.tone(f, "sine", 0.07, 0, 0.14, f * 1.15, settings);
  }

  /** Unlocking a piece out of yard */
  unlockBase(settings?: AudioSettings) {
    this.tone(440, "triangle", 0.1, 0, 0.16, null, settings);
    this.tone(659.25, "triangle", 0.13, 0.06, 0.18, null, settings);
    this.tone(880, "triangle", 0.2, 0.12, 0.2, null, settings);
  }

  /** Reaching a safe star square (magical sparkle chime) */
  safeZone(settings?: AudioSettings) {
    this.tone(659.25, "sine", 0.12, 0, 0.16, null, settings);
    this.tone(830.61, "sine", 0.14, 0.06, 0.18, null, settings);
    this.tone(987.77, "triangle", 0.22, 0.12, 0.2, null, settings);
  }

  /** Capturing an opponent piece (punchy arcade hit) */
  captureHit(settings?: AudioSettings) {
    this.tone(720, "sawtooth", 0.12, 0, 0.22, 180, settings);
    this.tone(520, "triangle", 0.2, 0.08, 0.25, 110, settings);
  }

  /** Returning captured piece back to yard */
  returnZip(settings?: AudioSettings) {
    for (let i = 0; i < 5; i++) {
      const f = 600 - i * 90;
      this.tone(f, "sine", 0.035, i * 0.03, 0.09, null, settings);
    }
  }

  /** Reaching home goal square */
  homeFinish(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) =>
      this.tone(n, "triangle", 0.16, i * 0.065, 0.18, null, settings),
    );
  }

  invalid(settings?: AudioSettings) {
    this.tone(220, "sawtooth", 0.1, 0, 0.1, null, settings);
    this.tone(170, "sawtooth", 0.14, 0.08, 0.1, null, settings);
  }

  victory(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((n, i) =>
      this.tone(n, "triangle", 0.28, i * 0.08, 0.2, null, settings),
    );
  }

  roomJoin(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((n, i) =>
      this.tone(n, "sine", 0.12, i * 0.07, 0.14, null, settings),
    );
  }

  roomLeave(settings?: AudioSettings) {
    const notes = [783.99, 659.25, 523.25];
    notes.forEach((n, i) =>
      this.tone(n, "sine", 0.12, i * 0.07, 0.14, null, settings),
    );
  }

  emotePop(settings?: AudioSettings) {
    this.tone(580, "sine", 0.07, 0, 0.14, 920, settings);
  }
}

export const ludoAudio = new LudoSoundEngine();
