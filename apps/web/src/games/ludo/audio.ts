import type { AudioSettings } from "@/lib/audio-settings";

/** Drop audio in public/audio/ludo, then set the matching src here. Null uses the original synth. */
export const LUDO_SOUNDS: Record<
  string,
  { src: string | null; volume: number }
> = {
  roll: { src: null, volume: 0.8 },
  land: { src: null, volume: 0.75 },
  six: { src: null, volume: 0.65 },
  step: { src: null, volume: 0.55 },
  unlock: { src: null, volume: 0.8 },
  capture: { src: null, volume: 0.8 },
  return: { src: null, volume: 0.5 },
  safe: { src: null, volume: 0.45 },
  home: { src: null, volume: 0.85 },
  turn: { src: null, volume: 0.65 },
  victory: { src: null, volume: 0.8 },
  invalid: { src: null, volume: 0.4 },
  join: { src: null, volume: 0.5 },
  leave: { src: null, volume: 0.4 },
  emote: { src: null, volume: 0.5 },
  hover: { src: null, volume: 0.25 },
};

class LudoSoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: AudioSettings = {
    muted: false,
    sfxVolume: 0.7,
    musicVolume: 0,
  };
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        settings.muted ? 0 : settings.sfxVolume,
        this.ctx.currentTime,
        0.015,
      );
  }

  /** Called from a real pointer/key gesture, including on the other player's browser. */
  unlock(settings?: AudioSettings) {
    if (settings) this.setSettings(settings);
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.muted
        ? 0
        : this.settings.sfxVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    for (const [event, { src }] of Object.entries(LUDO_SOUNDS)) {
      if (!src || this.loading.has(event)) continue;
      this.loading.add(event);
      void fetch(src)
        .then((r) => {
          if (!r.ok) throw new Error("Sound unavailable");
          return r.arrayBuffer();
        })
        .then((data) => this.ctx!.decodeAudioData(data))
        .then((buffer) => this.buffers.set(event, buffer))
        .catch(() => {
          /* Synth remains available. */
        });
    }
  }

  private play(
    event: string,
    settings: AudioSettings | undefined,
    synth: (ctx: AudioContext, output: GainNode) => void,
  ) {
    if (settings) this.setSettings(settings);
    if (
      this.settings.muted ||
      this.settings.sfxVolume <= 0 ||
      typeof window === "undefined"
    )
      return;
    // Never queue stale sounds while a browser is waiting for its first interaction.
    if (!this.ctx || this.ctx.state !== "running" || !this.master) return;
    const output = this.ctx.createGain();
    output.gain.value = LUDO_SOUNDS[event]?.volume ?? 0.6;
    output.connect(this.master);
    const buffer = this.buffers.get(event);
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(output);
      source.onended = () => {
        source.disconnect();
        output.disconnect();
      };
      source.start();
    } else {
      synth(this.ctx, output);
      window.setTimeout(() => output.disconnect(), 2000);
    }
  }

  private tone(
    ctx: AudioContext,
    out: GainNode,
    frequency: number,
    duration = 0.1,
    delay = 0,
    volume = 0.12,
    end = frequency,
    type: OscillatorType = "sine",
  ) {
    const t = ctx.currentTime + delay,
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, end),
      t + duration,
    );
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(out);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(t);
    oscillator.stop(t + duration + 0.01);
  }

  private tap(
    ctx: AudioContext,
    out: GainNode,
    delay = 0,
    pitch = 650,
    volume = 0.16,
  ) {
    const length = Math.floor(ctx.sampleRate * 0.035),
      buffer = ctx.createBuffer(1, length, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.13));
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = pitch;
    filter.Q.value = 1.3;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(ctx.currentTime + delay);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    this.tone(
      ctx,
      out,
      pitch * 0.45,
      0.045,
      delay,
      0.09,
      pitch * 0.3,
      "triangle",
    );
  }

  diceRoll(settings?: AudioSettings) {
    this.unlock(settings);
    this.play("roll", settings, (c, o) =>
      [0, 0.055, 0.12, 0.2, 0.3, 0.42].forEach((d, i) =>
        this.tap(c, o, d, 700 + (i % 3) * 280, 0.28 - i * 0.02),
      ),
    );
  }
  diceLand(value: number, settings?: AudioSettings) {
    this.play(value === 6 ? "six" : "land", settings, (c, o) => {
      this.tap(c, o, 0, 530, 0.25);
      if (value === 6)
        [660, 880].forEach((f, i) =>
          this.tone(c, o, f, 0.18, 0.05 + i * 0.08, 0.09),
        );
    });
  }
  hop(index = 0, settings?: AudioSettings) {
    this.play("step", settings, (c, o) => {
      this.tone(c, o, 520 + (index % 4) * 35, 0.065, 0, 0.19, 220);
      this.tap(c, o, 0.01, 1100, 0.08);
    });
  }
  unlockBase(settings?: AudioSettings) {
    this.play("unlock", settings, (c, o) => {
      this.tone(c, o, 320, 0.13, 0, 0.18, 780);
      this.tone(c, o, 880, 0.12, 0.08, 0.08, 660);
    });
  }
  captureHit(settings?: AudioSettings) {
    this.play("capture", settings, (c, o) => {
      this.tap(c, o, 0, 450, 0.38);
      this.tone(c, o, 290, 0.19, 0, 0.22, 75, "triangle");
      this.tone(c, o, 780, 0.08, 0.02, 0.08, 160);
    });
  }
  returnZip(settings?: AudioSettings) {
    this.play("return", settings, (c, o) =>
      this.tone(c, o, 660, 0.3, 0.08, 0.1, 165),
    );
  }
  safeZone(settings?: AudioSettings) {
    this.play("safe", settings, (c, o) => {
      this.tone(c, o, 1046, 0.16, 0, 0.06);
      this.tone(c, o, 1318, 0.2, 0.06, 0.05);
    });
  }
  homeFinish(settings?: AudioSettings) {
    this.play("home", settings, (c, o) =>
      [523, 659, 784, 1046].forEach((f, i) =>
        this.tone(c, o, f, 0.24, i * 0.075, 0.12),
      ),
    );
  }
  yourTurn(settings?: AudioSettings) {
    this.play("turn", settings, (c, o) => {
      this.tone(c, o, 659, 0.14, 0, 0.11);
      this.tone(c, o, 880, 0.22, 0.09, 0.1);
    });
  }
  victory(settings?: AudioSettings) {
    this.play("victory", settings, (c, o) =>
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) =>
        this.tone(c, o, f, 0.32, i * 0.11, 0.12),
      ),
    );
  }
  invalid(settings?: AudioSettings) {
    this.play("invalid", settings, (c, o) =>
      this.tone(c, o, 200, 0.09, 0, 0.1, 160, "triangle"),
    );
  }
  hoverTick(settings?: AudioSettings) {
    this.play("hover", settings, (c, o) => this.tap(c, o, 0, 900, 0.1));
  }
  roomJoin(settings?: AudioSettings) {
    this.play("join", settings, (c, o) =>
      [523, 784].forEach((f, i) => this.tone(c, o, f, 0.12, i * 0.08, 0.09)),
    );
  }
  roomLeave(settings?: AudioSettings) {
    this.play("leave", settings, (c, o) =>
      this.tone(c, o, 440, 0.14, 0, 0.08, 220),
    );
  }
  emotePop(settings?: AudioSettings) {
    this.play("emote", settings, (c, o) =>
      this.tone(c, o, 400, 0.09, 0, 0.12, 780),
    );
  }
}

export const ludoAudio = new LudoSoundEngine();
