class BusinessAudioEngine {
  private ctx: AudioContext | null = null;

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
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  public playDieRoll(muted = false): void {
    if (muted) return;
    [0, 0.07, 0.15, 0.24].forEach((d, i) => {
      this.tone(280 + i * 60, "triangle", d, 0.05, 0.16, 150);
    });
  }

  public playHop(muted = false, step = 0): void {
    if (muted) return;
    const f = 460 + (step % 6) * 35;
    this.tone(f, "sine", 0, 0.065, 0.15, f * 1.25);
  }

  public playBuy(muted = false): void {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, "triangle", i * 0.06, 0.2, 0.18);
    });
  }

  public playRentCoin(muted = false): void {
    if (muted) return;
    [987.77, 1318.51].forEach((f, i) => {
      this.tone(f, "sine", i * 0.08, 0.25, 0.2);
    });
  }

  public playJail(muted = false): void {
    if (muted) return;
    [320, 260, 200].forEach((f, i) => {
      this.tone(f, "sawtooth", i * 0.1, 0.25, 0.12);
    });
  }

  public playWin(muted = false): void {
    if (muted) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, "triangle", i * 0.08, 0.45, 0.22);
    });
  }
}

export const businessAudio = new BusinessAudioEngine();
