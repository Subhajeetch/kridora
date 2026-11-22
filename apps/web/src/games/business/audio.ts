export type BusinessSoundKey =
  | "dice-roll"
  | "token-hop"
  | "cash-buy"
  | "upgrade"
  | "sell"
  | "rent-pay"
  | "start-salary"
  | "mystery"
  | "jail"
  | "trade"
  | "chat-pop"
  | "win";

const SOUND_BASE_PATH = "/sounds/business";

const SOUND_FILES: Record<BusinessSoundKey, string> = {
  "dice-roll": `${SOUND_BASE_PATH}/dice-roll.mp3`,
  "token-hop": `${SOUND_BASE_PATH}/token-hop.mp3`,
  "cash-buy": `${SOUND_BASE_PATH}/cash-buy.mp3`,
  upgrade: `${SOUND_BASE_PATH}/upgrade.mp3`,
  sell: `${SOUND_BASE_PATH}/sell.mp3`,
  "rent-pay": `${SOUND_BASE_PATH}/rent-pay.mp3`,
  "start-salary": `${SOUND_BASE_PATH}/start-salary.mp3`,
  mystery: `${SOUND_BASE_PATH}/mystery.mp3`,
  jail: `${SOUND_BASE_PATH}/jail.mp3`,
  trade: `${SOUND_BASE_PATH}/trade.mp3`,
  "chat-pop": `${SOUND_BASE_PATH}/chat-pop.mp3`,
  win: `${SOUND_BASE_PATH}/win.mp3`,
};

class BusinessAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private customBuffers = new Map<BusinessSoundKey, AudioBuffer>();
  private preloadStarted = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Call on Business game mount. Quietly fetches any custom .mp3 files in
   * `public/sounds/business/` without lagging pages outside the game.
   * Missing files are ignored and fall back to the built-in synth seamlessly.
   */
  public preload(): void {
    if (typeof window === "undefined" || this.preloadStarted) return;
    this.preloadStarted = true;

    const ctx = this.getContext();
    if (!ctx) return;

    const entries = Object.entries(SOUND_FILES) as [BusinessSoundKey, string][];
    for (const [key, url] of entries) {
      void fetch(url)
        .then(async (res) => {
          if (!res.ok) return;
          const contentType = res.headers.get("content-type") ?? "";
          // Guard against Vite SPA fallback returning index.html with 200 OK
          if (contentType.includes("text/html")) return;
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength < 64) return;
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          this.customBuffers.set(key, decoded);
        })
        .catch(() => undefined);
    }
  }

  private playCustom(
    key: BusinessSoundKey,
    volume = 0.85,
    playbackRate = 1,
  ): boolean {
    const buffer = this.customBuffers.get(key);
    const ctx = this.getContext();
    if (!buffer || !ctx) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private tone(
    freq: number,
    type: OscillatorType,
    delay: number,
    duration: number,
    gainPeak: number,
    endFreq?: number,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private percussiveClick(
    delay: number,
    centerFreq: number,
    q: number,
    gainPeak: number,
    duration = 0.035,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(centerFreq, start);
    filter.Q.setValueAtTime(q, start);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  public playDieRoll(muted = false): void {
    if (muted || this.playCustom("dice-roll", 0.8)) return;
    this.percussiveClick(0.02, 1100, 3.2, 0.22, 0.03);
    this.percussiveClick(0.14, 920, 2.8, 0.18, 0.03);
    this.percussiveClick(0.28, 780, 3.5, 0.14, 0.025);
    this.percussiveClick(0.46, 650, 4.0, 0.16, 0.03);
    this.tone(170, "triangle", 0.45, 0.07, 0.1, 105);
  }

  public playHop(muted = false, step = 0): void {
    if (muted) return;
    const rate = 0.96 + (step % 6) * 0.045;
    if (this.playCustom("token-hop", 0.65, rate)) return;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = pentatonic[step % pentatonic.length] ?? 523.25;
    this.tone(freq, "sine", 0, 0.075, 0.14, freq * 1.12);
    this.percussiveClick(0, 1800, 5, 0.04, 0.015);
  }

  public playCashRegister(muted = false): void {
    if (muted || this.playCustom("cash-buy", 0.85)) return;
    this.percussiveClick(0, 2600, 2.0, 0.18, 0.045);
    this.percussiveClick(0.055, 3800, 3.0, 0.14, 0.03);
    this.tone(1318.51, "triangle", 0.07, 0.28, 0.16);
    this.tone(1975.53, "sine", 0.07, 0.36, 0.12);
    this.tone(2637.02, "sine", 0.13, 0.42, 0.14);
    this.tone(3520.0, "sine", 0.14, 0.3, 0.05);
  }

  public playUpgrade(muted = false): void {
    if (muted || this.playCustom("upgrade", 0.85)) return;
    this.playCashRegister(false);
    [587.33, 739.99, 880, 1174.66].forEach((f, idx) => {
      this.tone(f, "triangle", 0.16 + idx * 0.055, 0.2, 0.12);
    });
  }

  public playSell(muted = false): void {
    if (muted || this.playCustom("sell", 0.8)) return;
    this.tone(1174.66, "sine", 0, 0.16, 0.14);
    this.tone(1567.98, "sine", 0.07, 0.22, 0.15);
  }

  public playStartSalary(muted = false): void {
    if (muted) return;
    if (this.playCustom("start-salary", 0.85)) return;
    if (this.playCustom("cash-buy", 0.85)) return;
    this.playCashRegister(false);
  }

  public playRentCoin(muted = false): void {
    if (muted || this.playCustom("rent-pay", 0.8)) return;
    this.tone(987.77, "sine", 0, 0.18, 0.15);
    this.tone(1318.51, "sine", 0.08, 0.28, 0.16);
  }

  public playMystery(muted = false): void {
    if (muted || this.playCustom("mystery", 0.8)) return;
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      this.tone(f, "sine", idx * 0.045, 0.22, 0.12);
    });
  }

  public playJail(muted = false): void {
    if (muted || this.playCustom("jail", 0.8)) return;
    [250, 195, 145].forEach((f, idx) => {
      this.tone(f, "sawtooth", idx * 0.09, 0.24, 0.09);
    });
  }

  public playTrade(muted = false): void {
    if (muted || this.playCustom("trade", 0.85)) return;
    [659.25, 880, 1046.5].forEach((f, idx) => {
      this.tone(f, "triangle", idx * 0.065, 0.22, 0.14);
    });
  }

  public playChatPop(muted = false): void {
    if (muted || this.playCustom("chat-pop", 0.55)) return;
    this.tone(620, "sine", 0, 0.055, 0.05, 920);
  }

  public playWin(muted = false): void {
    if (muted || this.playCustom("win", 0.9)) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      this.tone(f, "triangle", i * 0.085, 0.45, 0.18);
    });
  }
}

export const businessAudio = new BusinessAudioEngine();
