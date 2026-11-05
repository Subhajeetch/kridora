import type { AudioSettings } from "@/lib/audio-settings";

class LudoSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  private ensureContext(settings?: AudioSettings): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (settings && (settings.muted || settings.sfxVolume <= 0.005))
      return null;

    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
      }
    }

    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {});
      }

      if (!this.masterGain && this.ctx) {
        try {
          const comp = this.ctx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-14, this.ctx.currentTime);
          comp.knee.setValueAtTime(10, this.ctx.currentTime);
          comp.ratio.setValueAtTime(4.0, this.ctx.currentTime);
          comp.attack.setValueAtTime(0.003, this.ctx.currentTime);
          comp.release.setValueAtTime(0.12, this.ctx.currentTime);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(1.0, this.ctx.currentTime);

          comp.connect(gain);
          gain.connect(this.ctx.destination);

          this.compressor = comp;
          this.masterGain = gain;
        } catch {
          // Fallback if compressor creation fails
        }
      }

      // Update master gain based on settings
      if (this.masterGain) {
        const vol = settings ? (settings.muted ? 0 : settings.sfxVolume) : 0.9;
        this.masterGain.gain.setValueAtTime(
          Math.max(0, Math.min(1.2, vol * 1.15)),
          this.ctx.currentTime,
        );
      }
    }

    return this.ctx;
  }

  /**
   * High-precision tone synthesizer with shaped envelope and dynamics compression.
   */
  private tone(
    freq: number,
    type: OscillatorType = "sine",
    duration = 0.09,
    delay = 0,
    peakGain = 0.35,
    endFreq: number | null = null,
    settings?: AudioSettings,
  ) {
    const ctx = this.ensureContext(settings);
    if (!ctx) return;

    const masterVol = settings
      ? settings.muted
        ? 0
        : settings.sfxVolume
      : 0.9;
    if (masterVol <= 0.005) return;

    try {
      const now = ctx.currentTime + Math.max(0, delay);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), now);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, endFreq),
          now + duration,
        );
      }

      // Baseline volume scaled for punchy clarity without distortion
      const targetGain = Math.min(
        1.0,
        Math.max(0.001, peakGain * masterVol * 1.35),
      );
      const attackTime = Math.min(0.015, duration * 0.2);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(targetGain, now + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      if (this.compressor) {
        gain.connect(this.compressor);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Non-blocking audio
    }
  }

  /**
   * Filtered noise burst for percussive textures (dice rattle clacks, impacts).
   */
  private noise(
    duration = 0.04,
    delay = 0,
    filterFreq = 800,
    peakGain = 0.2,
    settings?: AudioSettings,
  ) {
    const ctx = this.ensureContext(settings);
    if (!ctx) return;

    const masterVol = settings
      ? settings.muted
        ? 0
        : settings.sfxVolume
      : 0.9;
    if (masterVol <= 0.005) return;

    try {
      const now = ctx.currentTime + Math.max(0, delay);
      const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      const targetGain = Math.min(
        0.8,
        Math.max(0.001, peakGain * masterVol * 1.2),
      );
      gain.gain.setValueAtTime(targetGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noiseSource.connect(filter);
      filter.connect(gain);

      if (this.compressor) {
        gain.connect(this.compressor);
      } else {
        gain.connect(ctx.destination);
      }

      noiseSource.start(now);
      noiseSource.stop(now + duration + 0.01);
    } catch {
      // Non-blocking audio
    }
  }

  /**
   * 1. DICE ROLLING: Satisfying, realistic rapid mechanical tumble/rattle.
   * Plays 9 rhythmic textured clacks over ~430ms simulating dice clattering against felt/wood.
   */
  diceRoll(settings?: AudioSettings) {
    const clackCount = 9;
    const baseInterval = 0.046;

    for (let i = 0; i < clackCount; i++) {
      const t = i * baseInterval + Math.sin(i * 1.4) * 0.006;
      const pitch = 360 + (i % 3) * 110 + Math.random() * 80;
      const noiseFreq = 900 + Math.random() * 600;

      // Resonant body knock
      this.tone(
        pitch,
        "triangle",
        0.038,
        t,
        0.32 + (i / clackCount) * 0.08,
        pitch * 0.85,
        settings,
      );
      // Crisp acrylic impact transient
      this.noise(0.024, t, noiseFreq, 0.26, settings);
    }
  }

  /**
   * DICE LANDING:
   * - On 1..5: Firm, tactile landing clack with solid wooden/acrylic resonance.
   * - On 6: Extra celebratory, triumphant brassy arpeggio (distinct from home finish!).
   */
  diceLand(val: number, settings?: AudioSettings) {
    if (val === 6) {
      // Triumphant 4-note energetic fanfare arpeggio celebrating extra roll
      const notes = [392.0, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const delay = idx * 0.055;
        this.tone(freq, "triangle", 0.14, delay, 0.42, null, settings);
        this.tone(freq * 2, "sine", 0.1, delay, 0.22, null, settings);
      });
      // Crisp landing snap at start
      this.noise(0.03, 0, 1400, 0.35, settings);
    } else {
      // Crisp solid landing clack
      const baseFreq = 320 + val * 38;
      this.noise(0.04, 0, 1100 + val * 60, 0.42, settings);
      this.tone(
        baseFreq,
        "triangle",
        0.08,
        0.004,
        0.45,
        baseFreq * 0.75,
        settings,
      );
      this.tone(baseFreq * 1.8, "sine", 0.05, 0.004, 0.24, null, settings);
    }
  }

  /**
   * PIECE MOVEMENT (HOP):
   * Tactile, buoyant arcade pop for each square traversed.
   * Melodically ascends as the token advances along the track.
   */
  hop(stepIndex = 0, settings?: AudioSettings) {
    const f = 340 + (stepIndex % 12) * 26;
    // Punchy pitch-drop kick transient (1.35x -> 1.0x) gives that satisfying arcade bounce
    this.tone(f * 1.35, "sine", 0.065, 0, 0.44, f, settings);
    this.tone(f * 0.5, "triangle", 0.05, 0, 0.28, null, settings);
  }

  /**
   * PIECE LEAVES HOME (UNLOCK YARD ON 1 OR 6):
   * Short, punchy, and satisfying launch / deploy sound!
   * Ascending spring-sweep + bright crystalline chime.
   */
  unlockBase(settings?: AudioSettings) {
    // Energetic ascending spring launch
    this.tone(280, "sawtooth", 0.09, 0, 0.38, 760, settings);
    this.tone(420, "triangle", 0.11, 0.02, 0.42, 880, settings);
    // Sparkling deployment chime at apex
    this.tone(659.25, "sine", 0.16, 0.07, 0.45, null, settings); // E5
    this.tone(987.77, "triangle", 0.22, 0.12, 0.48, null, settings); // B5
    this.tone(1318.51, "sine", 0.26, 0.16, 0.35, null, settings); // E6
  }

  /**
   * PIECE-CUTTING / CAPTURE HIT:
   * Punchy, satisfying arcade strike when cutting an opponent's piece.
   * Deep sub punch + laser-crack strike transient.
   */
  captureHit(settings?: AudioSettings) {
    // Deep bass impact punch
    this.tone(130, "sawtooth", 0.14, 0, 0.6, 42, settings);
    this.tone(90, "sine", 0.18, 0, 0.65, 36, settings);
    // Sharp strike transient crack
    this.noise(0.06, 0, 1600, 0.52, settings);
    // Punchy arcade zap drop
    this.tone(880, "sawtooth", 0.12, 0.02, 0.48, 160, settings);
    this.tone(440, "triangle", 0.16, 0.05, 0.42, 110, settings);
  }

  /**
   * CAPTURED PIECE RETURNING ZIP:
   * Swift rewind cascade as captured token zooms back to yard.
   */
  returnZip(settings?: AudioSettings) {
    for (let i = 0; i < 5; i++) {
      const f = 680 - i * 95;
      this.tone(f, "sine", 0.04, i * 0.028, 0.28, f * 0.85, settings);
    }
  }

  /**
   * PIECE REACHES FINAL HOME GOAL:
   * Celestial 5-note melodic celebration chime!
   * Rich pentatonic bell cascade completely distinct from dice land:
   * F5 (698Hz) -> A5 (880Hz) -> C6 (1046Hz) -> E6 (1318Hz) -> A6 (1760Hz).
   */
  homeFinish(settings?: AudioSettings) {
    const bellNotes = [698.46, 880.0, 1046.5, 1318.51, 1760.0]; // F5, A5, C6, E6, A6
    bellNotes.forEach((freq, idx) => {
      const delay = idx * 0.065;
      // Bell fundamental
      this.tone(freq, "triangle", 0.24, delay, 0.42, null, settings);
      // Crystal chime overtone
      this.tone(freq * 1.5, "sine", 0.2, delay + 0.01, 0.24, null, settings);
    });
  }

  /**
   * MATCH VICTORY (GAME WIN):
   * Triumphant, celebratory multi-phase royal fanfare!
   * Ascending fanfare motif into sustained royal power chord with sparkling shimmer.
   */
  private lastVictoryTime = 0;

  victory(settings?: AudioSettings) {
    const now = Date.now();
    if (now - this.lastVictoryTime < 3500) {
      return; // Play exactly once per victory event, avoid overlapping replay
    }
    this.lastVictoryTime = now;

    // Phase 1: Rapid ascending fanfare flourish
    const flourish = [
      { f: 523.25, t: 0, d: 0.12 }, // C5
      { f: 659.25, t: 0.08, d: 0.12 }, // E5
      { f: 783.99, t: 0.16, d: 0.14 }, // G5
      { f: 1046.5, t: 0.24, d: 0.24 }, // C6
    ];

    flourish.forEach(({ f, t, d }) => {
      this.tone(f, "triangle", d, t, 0.52, null, settings);
      this.tone(f * 2, "sine", d * 0.8, t, 0.26, null, settings);
    });

    // Phase 2: Grand sustained victory chord with brilliance
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    const chordDelay = 0.44;
    chord.forEach((freq) => {
      this.tone(freq, "triangle", 0.55, chordDelay, 0.44, null, settings);
      this.tone(freq * 1.002, "sine", 0.45, chordDelay, 0.25, null, settings);
    });

    // Phase 3: Final golden chime shimmer
    const shimmer = [1318.51, 1567.98, 2093.0];
    shimmer.forEach((freq, idx) => {
      this.tone(
        freq,
        "sine",
        0.35,
        chordDelay + 0.22 + idx * 0.07,
        0.32,
        null,
        settings,
      );
    });
  }

  /**
   * STAR / SAFE SQUARE SPARKLE:
   * Magical twinkle chime when landing on star safe tiles.
   */
  safeZone(settings?: AudioSettings) {
    const sparkleNotes = [783.99, 987.77, 1318.51]; // G5, B5, E6
    sparkleNotes.forEach((freq, idx) => {
      const delay = idx * 0.055;
      this.tone(freq, "sine", 0.15, delay, 0.42, null, settings);
      this.tone(freq * 2, "triangle", 0.1, delay + 0.01, 0.22, null, settings);
    });
  }

  /**
   * Hover tick for board interaction and piece selection.
   */
  hoverTick(settings?: AudioSettings) {
    this.tone(720, "sine", 0.035, 0, 0.24, 600, settings);
  }

  /**
   * Pleasant modern button tap / click.
   */
  buttonClick(settings?: AudioSettings) {
    this.tone(540, "sine", 0.045, 0, 0.35, 420, settings);
  }

  /**
   * Invalid move buzz.
   */
  invalid(settings?: AudioSettings) {
    this.tone(240, "sawtooth", 0.09, 0, 0.34, 160, settings);
    this.tone(180, "sawtooth", 0.12, 0.06, 0.34, 120, settings);
  }

  roomJoin(settings?: AudioSettings) {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((n, i) =>
      this.tone(n, "sine", 0.14, i * 0.07, 0.36, null, settings),
    );
  }

  roomLeave(settings?: AudioSettings) {
    const notes = [783.99, 659.25, 523.25];
    notes.forEach((n, i) =>
      this.tone(n, "sine", 0.14, i * 0.07, 0.36, null, settings),
    );
  }

  emotePop(settings?: AudioSettings) {
    this.tone(540, "sine", 0.08, 0, 0.38, 960, settings);
  }
}

export const ludoAudio = new LudoSoundEngine();
