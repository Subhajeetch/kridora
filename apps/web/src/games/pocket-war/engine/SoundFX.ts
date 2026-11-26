import type {
  SoundBusName,
  SoundBusVolumes,
  TerrainMaterial,
  WeaponId,
} from "../types";

export type { SoundBusName };

interface AudioSpriteRegion {
  start: number;
  duration: number;
}

interface AudioSpriteManifest {
  src?: string[];
  files?: Record<string, string[]>;
  sprites?: Record<string, AudioSpriteRegion>;
}

const AUDIO_MANIFEST_URL = "/assets/pocket-war/audio/manifest.json";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getSupportedAudioUrls(urls: readonly string[]): string[] {
  if (typeof document === "undefined" || urls.length === 0) return [];
  const probe = document.createElement("audio");
  const canOgg = probe.canPlayType('audio/ogg; codecs="vorbis"') !== "";
  const canMp3 = probe.canPlayType("audio/mpeg") !== "";
  const canM4a = probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "";

  const supported: string[] = [];
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (lower.endsWith(".ogg") && canOgg) supported.push(url);
    else if (lower.endsWith(".mp3") && canMp3) supported.push(url);
    else if (lower.endsWith(".m4a") && canM4a) supported.push(url);
  }
  return supported.length > 0 ? supported : [...urls];
}

/**
 * Multi-bus Web Audio engine for Pocket War.
 * - Supports `.ogg` + `.mp3`/`.m4a` audio sprites or discrete clips via optional
 *   `/assets/pocket-war/audio/manifest.json`.
 * - Automatically falls back to rich procedural Web Audio synthesis when files are absent.
 * - Handles iOS Safari first-tap unlock cleanly without throwing.
 */
export class SoundFX {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private spriteSheetBuffer: AudioBuffer | null = null;
  private spriteRegions = new Map<string, AudioSpriteRegion>();
  private clipBuffers = new Map<string, AudioBuffer>();
  private manifestAttempted = false;

  private volumes: SoundBusVolumes = {
    master: 0.85,
    sfx: 0.9,
    ambience: 0.38,
    ui: 0.75,
  };
  private muted = false;
  private destroyed = false;
  private unlockRequested = false;

  // Continuous jetpack thruster nodes
  private jetpackActive = false;
  private jetpackGain: GainNode | null = null;
  private jetpackNoise: AudioBufferSourceNode | null = null;
  private jetpackOsc: OscillatorNode | null = null;

  // Continuous jungle waterfall ambience nodes
  private ambienceActive = false;
  private ambienceNodeGain: GainNode | null = null;
  private ambienceNoise: AudioBufferSourceNode | null = null;
  private birdTimer: number | null = null;

  private lastLowFuelBeepAt = 0;

  /**
   * Re-enables a SoundFX instance after a simulated unmount/remount cycle
   * (e.g. React StrictMode in development).
   */
  public revive(): void {
    this.destroyed = false;
  }

  private isContextPlayable(ctx: AudioContext | null): ctx is AudioContext {
    if (!ctx || this.destroyed || ctx.state === "closed") return false;
    if (ctx.state === "running") return true;
    if (ctx.state === "suspended" && this.unlockRequested) {
      void ctx.resume().catch(() => undefined);
      return true;
    }
    return false;
  }

  public unlock(): void {
    if (this.destroyed || typeof window === "undefined") return;
    this.unlockRequested = true;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx
        .resume()
        .then(() => {
          if (!this.destroyed && this.ambienceActive) {
            this.startAmbienceLoop();
          }
        })
        .catch(() => undefined);
    }

    // Play a 1-sample silent buffer to satisfy strict iOS Safari audio unlock
    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Ignore if context is not ready yet
    }

    if (this.ambienceActive) {
      this.startAmbienceLoop();
    }

    if (!this.manifestAttempted) {
      this.manifestAttempted = true;
      void this.loadOptionalAudioManifest(ctx);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.destroyed || typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;

    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtxCtor) return null;

    try {
      const ctx = new AudioCtxCtor();
      this.ctx = ctx;

      const master = ctx.createGain();
      const sfx = ctx.createGain();
      const ambience = ctx.createGain();
      const ui = ctx.createGain();

      sfx.connect(master);
      ambience.connect(master);
      ui.connect(master);
      master.connect(ctx.destination);

      this.masterGain = master;
      this.sfxGain = sfx;
      this.ambienceGain = ambience;
      this.uiGain = ui;

      this.applyVolumes();
      this.noiseBuffer = this.createNoiseBuffer(ctx, 2.0);
      return ctx;
    } catch {
      return null;
    }
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    durationSec: number,
  ): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private async loadOptionalAudioManifest(ctx: AudioContext): Promise<void> {
    if (typeof fetch === "undefined") return;
    try {
      const res = await fetch(AUDIO_MANIFEST_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const manifest = (await res.json()) as AudioSpriteManifest;

      if (Array.isArray(manifest.src) && manifest.sprites) {
        const candidates = getSupportedAudioUrls(manifest.src);
        for (const chosen of candidates) {
          const decoded = await this.fetchAndDecode(ctx, chosen);
          if (decoded && !this.destroyed) {
            this.spriteSheetBuffer = decoded;
            for (const [key, region] of Object.entries(manifest.sprites)) {
              if (
                typeof region.start === "number" &&
                typeof region.duration === "number"
              ) {
                this.spriteRegions.set(key, region);
              }
            }
            break;
          }
        }
      }

      if (manifest.files) {
        await Promise.all(
          Object.entries(manifest.files).map(async ([cue, urls]) => {
            if (!Array.isArray(urls)) return;
            const candidates = getSupportedAudioUrls(urls);
            for (const chosen of candidates) {
              const decoded = await this.fetchAndDecode(ctx, chosen);
              if (decoded && !this.destroyed) {
                this.clipBuffers.set(cue, decoded);
                break;
              }
            }
          }),
        );
      }
    } catch {
      // Optional asset manifest absent — procedural synth handles all cues
    }
  }

  private async fetchAndDecode(
    ctx: AudioContext,
    url: string,
  ): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType.includes("text/html")) return null;
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  private getBusNode(bus: SoundBusName): GainNode | null {
    switch (bus) {
      case "master":
        return this.masterGain;
      case "sfx":
        return this.sfxGain;
      case "ambience":
        return this.ambienceGain;
      case "ui":
        return this.uiGain;
    }
  }

  private applyVolumes(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const masterVal = this.muted ? 0 : this.volumes.master;
    this.masterGain?.gain.setTargetAtTime(masterVal, now, 0.015);
    this.sfxGain?.gain.setTargetAtTime(this.volumes.sfx, now, 0.015);
    this.ambienceGain?.gain.setTargetAtTime(this.volumes.ambience, now, 0.02);
    this.uiGain?.gain.setTargetAtTime(this.volumes.ui, now, 0.015);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setBusVolume(bus: SoundBusName, value: number): void {
    this.volumes[bus] = clamp(value, 0, 1);
    this.applyVolumes();
  }

  public getBusVolumes(): SoundBusVolumes {
    return { ...this.volumes };
  }

  private connectSpatialOutput(
    ctx: AudioContext,
    bus: SoundBusName,
    volume: number,
    pan: number,
  ): GainNode | null {
    const targetBus = this.getBusNode(bus);
    if (!targetBus) return null;

    const gain = ctx.createGain();
    gain.gain.value = clamp(volume, 0, 1.4);

    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      panner.connect(targetBus);
    } else {
      gain.connect(targetBus);
    }
    return gain;
  }

  private tryPlaySample(
    cue: string,
    bus: SoundBusName,
    volume: number,
    pan: number,
    playbackRate = 1,
  ): boolean {
    const ctx = this.ctx;
    if (!this.isContextPlayable(ctx)) return false;

    const clip = this.clipBuffers.get(cue);
    if (clip) {
      const out = this.connectSpatialOutput(ctx, bus, volume, pan);
      if (!out) return false;
      const src = ctx.createBufferSource();
      src.buffer = clip;
      src.playbackRate.value = playbackRate;
      src.connect(out);
      src.start(ctx.currentTime);
      return true;
    }

    const sprite = this.spriteRegions.get(cue);
    if (sprite && this.spriteSheetBuffer) {
      const out = this.connectSpatialOutput(ctx, bus, volume, pan);
      if (!out) return false;
      const src = ctx.createBufferSource();
      src.buffer = this.spriteSheetBuffer;
      src.playbackRate.value = playbackRate;
      src.connect(out);
      src.start(ctx.currentTime, sprite.start, sprite.duration);
      return true;
    }

    return false;
  }

  private playNoiseBurst(
    bus: SoundBusName,
    durationSec: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    volume: number,
    pan = 0,
    q = 1.2,
  ): void {
    const ctx = this.ctx;
    if (!this.isContextPlayable(ctx) || !this.noiseBuffer) return;
    if (this.muted || volume <= 0.01) return;

    const out = this.connectSpatialOutput(ctx, bus, 1, pan);
    if (!out) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(40, freqStart), now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, freqEnd),
      now + durationSec,
    );

    const env = ctx.createGain();
    env.gain.setValueAtTime(Math.max(0.0001, volume), now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    src.connect(filter);
    filter.connect(env);
    env.connect(out);

    src.start(now, Math.random() * 0.8, durationSec + 0.02);
  }

  private playTone(
    bus: SoundBusName,
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    volume: number,
    pan = 0,
    delaySec = 0,
  ): void {
    const ctx = this.ctx;
    if (!this.isContextPlayable(ctx)) return;
    if (this.muted || volume <= 0.01) return;

    const out = this.connectSpatialOutput(ctx, bus, 1, pan);
    if (!out) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, freqStart), now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(30, freqEnd),
      now + durationSec,
    );

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(
      volume,
      now + Math.min(0.008, durationSec * 0.2),
    );
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playWeaponShot(weaponId: WeaponId, volume = 1, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    const rateJitter = 0.96 + Math.random() * 0.08;
    if (
      this.tryPlaySample(`shot_${weaponId}`, "sfx", volume, pan, rateJitter)
    ) {
      return;
    }

    switch (weaponId) {
      case "m4a1":
        this.playNoiseBurst(
          "sfx",
          0.095,
          "bandpass",
          1900,
          420,
          0.34 * volume,
          pan,
          1.4,
        );
        this.playTone(
          "sfx",
          "sawtooth",
          210 * rateJitter,
          72,
          0.075,
          0.2 * volume,
          pan,
        );
        break;
      case "vector_smg":
        this.playNoiseBurst(
          "sfx",
          0.065,
          "bandpass",
          2600,
          680,
          0.26 * volume,
          pan,
          1.8,
        );
        this.playTone(
          "sfx",
          "triangle",
          340 * rateJitter,
          110,
          0.055,
          0.16 * volume,
          pan,
        );
        break;
      case "pistol":
        this.playNoiseBurst(
          "sfx",
          0.08,
          "highpass",
          1400,
          520,
          0.28 * volume,
          pan,
          1.0,
        );
        this.playTone(
          "sfx",
          "square",
          290 * rateJitter,
          95,
          0.065,
          0.14 * volume,
          pan,
        );
        break;
      case "spas12":
        this.playNoiseBurst(
          "sfx",
          0.22,
          "lowpass",
          2100,
          220,
          0.52 * volume,
          pan,
          0.9,
        );
        this.playTone("sfx", "sawtooth", 145, 42, 0.16, 0.34 * volume, pan);
        break;
      case "barrett50":
        this.playNoiseBurst(
          "sfx",
          0.28,
          "bandpass",
          3100,
          320,
          0.56 * volume,
          pan,
          0.8,
        );
        this.playTone("sfx", "sawtooth", 540, 64, 0.22, 0.32 * volume, pan);
        break;
      case "rpg7":
        this.playNoiseBurst(
          "sfx",
          0.38,
          "bandpass",
          920,
          190,
          0.48 * volume,
          pan,
          1.1,
        );
        this.playTone("sfx", "sine", 160, 48, 0.28, 0.36 * volume, pan);
        break;
    }
  }

  public playExplosion(
    kind: "grenade" | "rocket" | "barrel" = "grenade",
    volume = 1,
    pan = 0,
  ): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample(`explosion_${kind}`, "sfx", volume, pan)) return;

    const dur = kind === "rocket" ? 0.62 : kind === "barrel" ? 0.56 : 0.5;
    this.playNoiseBurst(
      "sfx",
      dur,
      "lowpass",
      1100,
      95,
      0.68 * volume,
      pan,
      0.7,
    );
    this.playTone("sfx", "sine", 125, 28, dur * 0.75, 0.58 * volume, pan);
    this.playTone("sfx", "triangle", 220, 40, dur * 0.45, 0.26 * volume, pan);
  }

  public playReload(): void {
    if (this.muted) return;
    if (this.tryPlaySample("reload", "sfx", 0.8, 0)) return;
    this.playTone("sfx", "square", 460, 320, 0.055, 0.12, 0, 0);
    this.playTone("sfx", "triangle", 620, 880, 0.06, 0.14, 0, 0.18);
  }

  public playEmptyClick(): void {
    if (this.muted) return;
    if (this.tryPlaySample("empty_click", "sfx", 0.7, 0)) return;
    this.playTone("sfx", "square", 1250, 720, 0.032, 0.11, 0);
  }

  public playMelee(volume = 0.9, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("melee", "sfx", volume, pan)) return;
    this.playNoiseBurst(
      "sfx",
      0.11,
      "bandpass",
      1300,
      360,
      0.3 * volume,
      pan,
      2.2,
    );
    this.playTone("sfx", "sine", 240, 95, 0.09, 0.22 * volume, pan);
  }

  public playHitmarker(): void {
    if (this.muted) return;
    if (this.tryPlaySample("hitmarker", "ui", 0.75, 0)) return;
    this.playTone("ui", "triangle", 1550, 1080, 0.045, 0.18, 0);
  }

  public playPlayerHit(): void {
    if (this.muted) return;
    if (this.tryPlaySample("player_hit", "sfx", 0.85, 0)) return;
    this.playTone("sfx", "sawtooth", 180, 68, 0.11, 0.25, 0);
    this.playNoiseBurst("sfx", 0.08, "lowpass", 700, 220, 0.22, 0);
  }

  public playDeath(volume = 1, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("death", "sfx", volume, pan)) return;
    this.playTone("sfx", "sawtooth", 310, 75, 0.28, 0.28 * volume, pan);
    this.playNoiseBurst("sfx", 0.26, "bandpass", 980, 180, 0.34 * volume, pan);
  }

  public playKillNotify(): void {
    if (this.muted) return;
    if (this.tryPlaySample("kill_notify", "ui", 0.8, 0)) return;
    this.playTone("ui", "triangle", 660, 880, 0.09, 0.16, 0, 0);
    this.playTone("ui", "triangle", 880, 1320, 0.13, 0.18, 0, 0.08);
  }

  public playRespawn(volume = 0.9, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("respawn", "sfx", volume, pan)) return;
    this.playTone("sfx", "sine", 340, 680, 0.16, 0.18 * volume, pan, 0);
    this.playTone("sfx", "triangle", 520, 1040, 0.18, 0.14 * volume, pan, 0.09);
  }

  public playPickup(): void {
    if (this.muted) return;
    if (this.tryPlaySample("pickup", "ui", 0.85, 0)) return;
    this.playTone("ui", "sine", 540, 820, 0.08, 0.18, 0, 0);
    this.playTone("ui", "sine", 820, 1180, 0.11, 0.18, 0, 0.07);
  }

  public playBlockBreak(
    material: TerrainMaterial,
    volume = 0.9,
    pan = 0,
  ): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample(`break_${material}`, "sfx", volume, pan)) return;
    const freq = material === "rock" || material === "concrete" ? 650 : 1250;
    this.playNoiseBurst(
      "sfx",
      0.19,
      "bandpass",
      freq,
      190,
      0.38 * volume,
      pan,
      1.3,
    );
    this.playTone("sfx", "triangle", 190, 62, 0.14, 0.2 * volume, pan);
  }

  public playGrenadeBounce(volume = 0.7, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("grenade_bounce", "sfx", volume, pan)) return;
    this.playTone("sfx", "triangle", 480, 290, 0.045, 0.15 * volume, pan);
  }

  public playJumpLand(volume = 0.65, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("land", "sfx", volume, pan)) return;
    this.playNoiseBurst("sfx", 0.07, "lowpass", 420, 140, 0.2 * volume, pan);
    this.playTone("sfx", "sine", 110, 48, 0.075, 0.18 * volume, pan);
  }

  public playWaterSplash(volume = 0.8, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (this.tryPlaySample("water_splash", "sfx", volume, pan)) return;
    this.playNoiseBurst(
      "sfx",
      0.24,
      "bandpass",
      1500,
      420,
      0.34 * volume,
      pan,
      0.85,
    );
    this.playTone("sfx", "sine", 320, 120, 0.14, 0.14 * volume, pan);
  }

  public playFootstep(volume = 0.5, pan = 0): void {
    if (this.muted || volume <= 0.02) return;
    if (
      this.tryPlaySample(
        "footstep",
        "sfx",
        volume,
        pan,
        0.9 + Math.random() * 0.2,
      )
    ) {
      return;
    }
    this.playNoiseBurst(
      "sfx",
      0.042,
      "bandpass",
      520,
      220,
      0.1 * volume,
      pan,
      1.5,
    );
  }

  public playLowFuelBeep(): void {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastLowFuelBeepAt < 340) return;
    this.lastLowFuelBeepAt = now;
    if (this.tryPlaySample("low_fuel_beep", "ui", 0.55, 0)) return;
    this.playTone("ui", "square", 980, 860, 0.05, 0.09, 0);
  }

  public playUiClick(): void {
    if (this.muted) return;
    if (this.tryPlaySample("ui_click", "ui", 0.7, 0)) return;
    this.playTone("ui", "triangle", 760, 560, 0.04, 0.12, 0);
  }

  public playUiSwitch(): void {
    if (this.muted) return;
    if (this.tryPlaySample("ui_switch", "ui", 0.75, 0)) return;
    this.playTone("ui", "sine", 480, 740, 0.065, 0.13, 0);
  }

  public playUiConfirm(): void {
    if (this.muted) return;
    if (this.tryPlaySample("ui_confirm", "ui", 0.85, 0)) return;
    this.playTone("ui", "triangle", 520, 780, 0.075, 0.16, 0, 0);
    this.playTone("ui", "triangle", 780, 1040, 0.11, 0.18, 0, 0.065);
  }

  public setJetpackActive(active: boolean, intensity = 0.85): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    if (!this.isContextPlayable(ctx) || !this.sfxGain || !this.noiseBuffer) {
      this.jetpackActive = false;
      return;
    }

    if (active && !this.jetpackActive) {
      this.jetpackActive = true;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(
        0.16 * clamp(intensity, 0.2, 1),
        now + 0.06,
      );

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 620;
      filter.Q.value = 1.1;

      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 92;
      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.25;

      noise.connect(filter);
      filter.connect(gain);
      osc.connect(oscGain);
      oscGain.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      osc.start(now);

      this.jetpackGain = gain;
      this.jetpackNoise = noise;
      this.jetpackOsc = osc;
    } else if (!active && this.jetpackActive) {
      this.stopJetpackLoop();
    } else if (active && this.jetpackGain) {
      this.jetpackGain.gain.setTargetAtTime(
        0.16 * clamp(intensity, 0.2, 1),
        ctx.currentTime,
        0.04,
      );
    }
  }

  private stopJetpackLoop(): void {
    this.jetpackActive = false;
    const ctx = this.ctx;
    const gain = this.jetpackGain;
    const noise = this.jetpackNoise;
    const osc = this.jetpackOsc;
    this.jetpackGain = null;
    this.jetpackNoise = null;
    this.jetpackOsc = null;

    if (ctx && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.03);
      window.setTimeout(() => {
        try {
          noise?.stop();
          osc?.stop();
          gain.disconnect();
        } catch {
          // Already stopped
        }
      }, 140);
    }
  }

  private startAmbienceLoop(): void {
    if (!this.ambienceActive || this.destroyed) return;
    const ctx = this.ctx;
    if (
      !this.isContextPlayable(ctx) ||
      !this.ambienceGain ||
      !this.noiseBuffer
    ) {
      return;
    }
    if (this.ambienceNoise) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.8);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 540;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);
    noise.start(now);

    this.ambienceNodeGain = gain;
    this.ambienceNoise = noise;
  }

  public setAmbienceActive(active: boolean): void {
    if (this.destroyed) return;
    if (active === this.ambienceActive) return;
    this.ambienceActive = active;

    if (!active) {
      this.stopAmbienceLoop();
      return;
    }

    this.startAmbienceLoop();

    if (typeof window !== "undefined" && this.birdTimer === null) {
      this.birdTimer = window.setInterval(() => {
        if (!this.ambienceActive || this.muted) return;
        this.startAmbienceLoop();
        if (Math.random() < 0.35) {
          const pan = (Math.random() - 0.5) * 1.4;
          const base = 1850 + Math.random() * 900;
          this.playTone(
            "ambience",
            "sine",
            base,
            base * 1.24,
            0.09,
            0.055,
            pan,
            0,
          );
          this.playTone(
            "ambience",
            "sine",
            base * 1.15,
            base * 0.92,
            0.11,
            0.045,
            pan,
            0.11,
          );
        }
      }, 4200);
    }
  }

  private stopAmbienceLoop(): void {
    if (this.birdTimer !== null) {
      window.clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
    const ctx = this.ctx;
    const gain = this.ambienceNodeGain;
    const noise = this.ambienceNoise;
    this.ambienceNodeGain = null;
    this.ambienceNoise = null;

    if (ctx && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.08);
      window.setTimeout(() => {
        try {
          noise?.stop();
          gain.disconnect();
        } catch {
          // Ignore
        }
      }, 220);
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.unlockRequested = false;
    this.manifestAttempted = false;
    this.ambienceActive = false;
    this.stopJetpackLoop();
    this.stopAmbienceLoop();
    this.masterGain = null;
    this.sfxGain = null;
    this.ambienceGain = null;
    this.uiGain = null;
    this.noiseBuffer = null;
    if (this.ctx) {
      const current = this.ctx;
      this.ctx = null;
      void current.close().catch(() => undefined);
    }
  }
}
