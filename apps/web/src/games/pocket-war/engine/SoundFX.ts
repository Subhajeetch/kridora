import type {
  SoundBusVolumes,
  TerrainMaterial,
  WeaponId,
} from "../types";

export type SoundBusName = "master" | "sfx" | "ambience" | "ui";

type SoundAssetKey =
  | "ambience_jungle"
  | "jetpack_loop"
  | "jetpack_low_fuel"
  | "shot_pistol"
  | "shot_m4a1"
  | "shot_smg"
  | "shot_shotgun"
  | "shot_sniper"
  | "shot_rpg"
  | "reload"
  | "empty_click"
  | "explosion_grenade"
  | "explosion_rocket"
  | "grenade_bounce"
  | "bullet_impact"
  | "break_wood"
  | "break_rock"
  | "footstep_grass"
  | "jump_land"
  | "water_splash"
  | "melee_swing"
  | "hitmarker"
  | "player_hit"
  | "player_death"
  | "player_respawn"
  | "pickup_item"
  | "kill_notify"
  | "ui_click"
  | "ui_switch"
  | "ui_confirm";

const SOUND_ASSET_KEYS: readonly SoundAssetKey[] = [
  "ambience_jungle",
  "jetpack_loop",
  "jetpack_low_fuel",
  "shot_pistol",
  "shot_m4a1",
  "shot_smg",
  "shot_shotgun",
  "shot_sniper",
  "shot_rpg",
  "reload",
  "empty_click",
  "explosion_grenade",
  "explosion_rocket",
  "grenade_bounce",
  "bullet_impact",
  "break_wood",
  "break_rock",
  "footstep_grass",
  "jump_land",
  "water_splash",
  "melee_swing",
  "hitmarker",
  "player_hit",
  "player_death",
  "player_respawn",
  "pickup_item",
  "kill_notify",
  "ui_click",
  "ui_switch",
  "ui_confirm",
] as const;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class SoundFX {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private buffers = new Map<SoundAssetKey, AudioBuffer>();

  // Volume buses
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private uiGain: GainNode | null = null;

  // Looping sources
  private jetpackGain: GainNode | null = null;
  private jetpackFilter: BiquadFilterNode | null = null;
  private jetpackSource: AudioBufferSourceNode | null = null;
  private jetpackUsingCustom = false;

  private ambienceLoopGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceUsingCustom = false;
  private ambienceDesired = false;
  private birdIntervalId: number | null = null;

  private muted = false;
  private preloadStarted = false;
  private lastLowFuelBeepAt = 0;

  private volumes: SoundBusVolumes = {
    master: 0.9,
    sfx: 0.85,
    ambience: 0.45,
    ui: 0.75,
  };

  /**
   * Unlocks Web Audio cleanly on first user gesture (pointer/touch/keydown).
   * Safe to call repeatedly; obeys strict iOS Safari & Chrome autoplay policies.
   */
  public unlock(): void {
    if (typeof window === "undefined") return;

    if (!this.ctx) {
      const AudioCtor = window.AudioContext;
      if (!AudioCtor) return;

      this.ctx = new AudioCtor();
      this.setupBuses();
      this.createNoiseBuffer();
      this.startJetpackLoop(false);
      this.startAmbienceLoop(false);

      if (!this.preloadStarted) {
        this.preloadStarted = true;
        void this.preloadAssets();
      }
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    if (this.ambienceDesired) {
      this.applyAmbienceGain(true);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(
      muted ? 0 : this.volumes.master,
      now,
      0.03,
    );
    if (muted && this.jetpackGain) {
      this.jetpackGain.gain.setTargetAtTime(0, now, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getBusVolumes(): SoundBusVolumes {
    return { ...this.volumes };
  }

  public setBusVolume(bus: SoundBusName, value: number): void {
    const clamped = clamp(value, 0, 1);
    this.volumes[bus] = clamped;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (bus === "master" && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : clamped,
        now,
        0.03,
      );
    } else if (bus === "sfx" && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(clamped, now, 0.03);
    } else if (bus === "ambience" && this.ambienceGain) {
      this.ambienceGain.gain.setTargetAtTime(clamped, now, 0.05);
    } else if (bus === "ui" && this.uiGain) {
      this.uiGain.gain.setTargetAtTime(clamped, now, 0.03);
    }
  }

  public setAmbienceActive(active: boolean): void {
    this.ambienceDesired = active;
    this.applyAmbienceGain(active);
  }

  public destroy(): void {
    if (this.birdIntervalId !== null) {
      window.clearInterval(this.birdIntervalId);
      this.birdIntervalId = null;
    }
    this.stopSourceSafe(this.jetpackSource);
    this.stopSourceSafe(this.ambienceSource);
    this.jetpackSource = null;
    this.ambienceSource = null;

    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.sfxGain = null;
    this.ambienceGain = null;
    this.uiGain = null;
    this.jetpackGain = null;
    this.jetpackFilter = null;
    this.ambienceLoopGain = null;
  }

  private stopSourceSafe(src: AudioBufferSourceNode | null): void {
    if (!src) return;
    try {
      src.stop();
      src.disconnect();
    } catch {
      // Already stopped
    }
  }

  private setupBuses(): void {
    if (!this.ctx) return;

    const master = this.ctx.createGain();
    master.gain.value = this.muted ? 0 : this.volumes.master;
    master.connect(this.ctx.destination);

    const sfx = this.ctx.createGain();
    sfx.gain.value = this.volumes.sfx;
    sfx.connect(master);

    const ambience = this.ctx.createGain();
    ambience.gain.value = this.volumes.ambience;
    ambience.connect(master);

    const ui = this.ctx.createGain();
    ui.gain.value = this.volumes.ui;
    ui.connect(master);

    this.masterGain = master;
    this.sfxGain = sfx;
    this.ambienceGain = ambience;
    this.uiGain = ui;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private startJetpackLoop(useCustomBuffer: boolean): void {
    if (!this.ctx || !this.sfxGain) return;
    const customBuf = useCustomBuffer
      ? this.buffers.get("jetpack_loop")
      : undefined;
    const sourceBuf = customBuf ?? this.noiseBuffer;
    if (!sourceBuf) return;

    this.stopSourceSafe(this.jetpackSource);

    const src = this.ctx.createBufferSource();
    src.buffer = sourceBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = customBuf ? "lowpass" : "bandpass";
    filter.frequency.value = customBuf ? 3200 : 540;
    filter.Q.value = customBuf ? 0.7 : 1.7;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start();

    this.jetpackSource = src;
    this.jetpackFilter = filter;
    this.jetpackGain = gain;
    this.jetpackUsingCustom = Boolean(customBuf);
  }

  private startAmbienceLoop(useCustomBuffer: boolean): void {
    if (!this.ctx || !this.ambienceGain) return;
    const customBuf = useCustomBuffer
      ? this.buffers.get("ambience_jungle")
      : undefined;
    const sourceBuf = customBuf ?? this.noiseBuffer;
    if (!sourceBuf) return;

    this.stopSourceSafe(this.ambienceSource);

    const src = this.ctx.createBufferSource();
    src.buffer = sourceBuf;
    src.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    if (customBuf) {
      src.connect(gain);
    } else {
      // Soft procedural waterfall & canopy breeze bed when .mp3 is absent
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 620;

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 140;

      src.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(gain);
    }

    gain.connect(this.ambienceGain);
    src.start();

    this.ambienceSource = src;
    this.ambienceLoopGain = gain;
    this.ambienceUsingCustom = Boolean(customBuf);

    this.applyAmbienceGain(this.ambienceDesired);

    // Subtle procedural distant jungle bird chirps when custom ambience file is not loaded
    if (!customBuf && this.birdIntervalId === null && typeof window !== "undefined") {
      this.birdIntervalId = window.setInterval(() => {
        if (
          !this.ambienceDesired ||
          this.ambienceUsingCustom ||
          this.muted ||
          !this.ctx ||
          this.ctx.state !== "running"
        ) {
          return;
        }
        if (Math.random() > 0.55) return;
        this.playProceduralBirdChirp();
      }, 3600);
    }
  }

  private applyAmbienceGain(active: boolean): void {
    if (!this.ctx || !this.ambienceLoopGain) return;
    const now = this.ctx.currentTime;
    const targetVol = active ? (this.ambienceUsingCustom ? 0.34 : 0.14) : 0;
    this.ambienceLoopGain.gain.setTargetAtTime(targetVol, now, 0.35);
  }

  private playProceduralBirdChirp(): void {
    if (!this.ctx || !this.ambienceGain) return;
    const now = this.ctx.currentTime;
    const pan = (Math.random() - 0.5) * 1.4;
    const baseFreq = 1850 + Math.random() * 900;

    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.13;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, start);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, start + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, start + 0.1);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);

      osc.connect(gain);
      this.connectToBus(gain, "ambience", pan);
      osc.start(start);
      osc.stop(start + 0.12);
    }
  }

  private async preloadAssets(): Promise<void> {
    if (!this.ctx) return;

    await Promise.allSettled(
      SOUND_ASSET_KEYS.map(async (key) => {
        try {
          const res = await fetch(`/sounds/pocket-war/${key}.mp3`);
          if (!res.ok) return;
          const contentType = res.headers.get("content-type") ?? "";
          if (contentType.includes("text/html")) return;
          const arr = await res.arrayBuffer();
          if (!this.ctx || arr.byteLength === 0) return;
          const decoded = await this.ctx.decodeAudioData(arr);
          this.buffers.set(key, decoded);

          if (key === "jetpack_loop") {
            this.startJetpackLoop(true);
          } else if (key === "ambience_jungle") {
            this.startAmbienceLoop(true);
          }
        } catch {
          // Graceful fallback to procedural Web Audio synth
        }
      }),
    );
  }

  private getBusNode(bus: Exclude<SoundBusName, "master">): GainNode | null {
    if (bus === "sfx") return this.sfxGain;
    if (bus === "ambience") return this.ambienceGain;
    return this.uiGain;
  }

  private connectToBus(
    node: AudioNode,
    bus: Exclude<SoundBusName, "master">,
    pan = 0,
  ): void {
    const dest = this.getBusNode(bus);
    if (!this.ctx || !dest) return;

    const clampedPan = clamp(pan, -0.95, 0.95);
    if (
      Math.abs(clampedPan) > 0.02 &&
      typeof this.ctx.createStereoPanner === "function"
    ) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clampedPan;
      node.connect(panner);
      panner.connect(dest);
    } else {
      node.connect(dest);
    }
  }

  private playBuffer(
    key: SoundAssetKey,
    bus: Exclude<SoundBusName, "master">,
    volume: number,
    pan = 0,
    pitchJitter = 0,
  ): boolean {
    if (!this.ctx || this.muted || this.ctx.state !== "running") return false;
    const buf = this.buffers.get(key);
    if (!buf) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (pitchJitter > 0) {
      src.playbackRate.value = 1 + (Math.random() - 0.5) * pitchJitter;
    }

    const gain = this.ctx.createGain();
    gain.gain.value = clamp(volume, 0, 1.2);
    src.connect(gain);
    this.connectToBus(gain, bus, pan);
    src.start();
    return true;
  }

  public setJetpackActive(active: boolean, intensity = 1): void {
    if (!this.ctx || !this.jetpackGain || !this.jetpackFilter) return;
    const now = this.ctx.currentTime;
    if (this.muted || !active) {
      this.jetpackGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    const clampedIntensity = clamp(intensity, 0.2, 1.2);
    if (!this.jetpackUsingCustom) {
      this.jetpackFilter.frequency.setTargetAtTime(
        460 + clampedIntensity * 380,
        now,
        0.06,
      );
    }
    const baseGain = this.jetpackUsingCustom ? 0.24 : 0.16;
    this.jetpackGain.gain.setTargetAtTime(
      baseGain * clampedIntensity,
      now,
      0.05,
    );
  }

  public playLowFuelBeep(): void {
    const nowMs = Date.now();
    if (nowMs - this.lastLowFuelBeepAt < 520) return;
    this.lastLowFuelBeepAt = nowMs;

    if (this.muted || !this.ctx) return;
    if (this.playBuffer("jetpack_low_fuel", "ui", 0.3)) return;
    this.triggerTone(880, 740, 0.08, "square", 0.08, "ui", 0);
  }

  public playWeaponShot(
    weaponId: WeaponId,
    distanceAttenuation = 1,
    pan = 0,
  ): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.03) return;
    const vol = clamp(distanceAttenuation, 0, 1);

    const keyMap: Record<WeaponId, { key: SoundAssetKey; baseVol: number }> = {
      pistol: { key: "shot_pistol", baseVol: 0.48 },
      m4a1: { key: "shot_m4a1", baseVol: 0.5 },
      vector_smg: { key: "shot_smg", baseVol: 0.45 },
      spas12: { key: "shot_shotgun", baseVol: 0.65 },
      barrett50: { key: "shot_sniper", baseVol: 0.72 },
      rpg7: { key: "shot_rpg", baseVol: 0.68 },
    };

    const entry = keyMap[weaponId];
    if (this.playBuffer(entry.key, "sfx", entry.baseVol * vol, pan, 0.08)) {
      return;
    }

    if (weaponId === "rpg7") {
      this.triggerNoiseBurst(0.32, 340, "lowpass", 0.36 * vol, "sfx", pan);
      this.triggerTone(180, 50, 0.28, "sawtooth", 0.22 * vol, "sfx", pan);
      return;
    }
    if (weaponId === "barrett50") {
      this.triggerNoiseBurst(0.2, 2100, "bandpass", 0.48 * vol, "sfx", pan);
      this.triggerTone(350, 44, 0.24, "triangle", 0.36 * vol, "sfx", pan);
      return;
    }
    if (weaponId === "spas12") {
      this.triggerNoiseBurst(0.25, 860, "lowpass", 0.5 * vol, "sfx", pan);
      this.triggerTone(195, 40, 0.17, "square", 0.24 * vol, "sfx", pan);
      return;
    }
    if (weaponId === "vector_smg") {
      this.triggerNoiseBurst(0.06, 2350, "bandpass", 0.22 * vol, "sfx", pan);
      this.triggerTone(340, 110, 0.055, "triangle", 0.16 * vol, "sfx", pan);
      return;
    }
    if (weaponId === "pistol") {
      this.triggerNoiseBurst(0.09, 1750, "bandpass", 0.28 * vol, "sfx", pan);
      this.triggerTone(310, 78, 0.08, "triangle", 0.22 * vol, "sfx", pan);
      return;
    }
    // M4A1
    this.triggerNoiseBurst(0.09, 1850, "bandpass", 0.28 * vol, "sfx", pan);
    this.triggerTone(280, 68, 0.08, "triangle", 0.21 * vol, "sfx", pan);
  }

  public playReload(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("reload", "sfx", 0.45)) return;
    this.triggerTone(500, 740, 0.06, "triangle", 0.14, "sfx", 0);
    window.setTimeout(() => {
      this.triggerTone(780, 960, 0.06, "triangle", 0.12, "sfx", 0);
    }, 110);
  }

  public playEmptyClick(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("empty_click", "sfx", 0.42)) return;
    this.triggerTone(1150, 680, 0.035, "square", 0.12, "sfx", 0);
  }

  public playExplosion(
    kind: "grenade" | "rocket" | "barrel" = "grenade",
    distanceAttenuation = 1,
    pan = 0,
  ): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.03) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    const key: SoundAssetKey =
      kind === "grenade" ? "explosion_grenade" : "explosion_rocket";

    if (this.playBuffer(key, "sfx", 0.85 * vol, pan, 0.06)) return;

    // Deep sub-bass punch + crackle roar
    this.triggerTone(125, 22, 0.68, "sine", 0.64 * vol, "sfx", pan);
    this.triggerTone(88, 30, 0.48, "sawtooth", 0.22 * vol, "sfx", pan);
    this.triggerNoiseBurst(0.76, 420, "lowpass", 0.54 * vol, "sfx", pan);
    this.triggerNoiseBurst(0.18, 1650, "bandpass", 0.26 * vol, "sfx", pan);
  }

  public playGrenadeBounce(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("grenade_bounce", "sfx", 0.36 * vol, pan, 0.14)) return;
    this.triggerTone(620, 260, 0.055, "triangle", 0.14 * vol, "sfx", pan);
  }

  public playBulletImpact(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.05) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("bullet_impact", "sfx", 0.34 * vol, pan, 0.18)) return;
    this.triggerNoiseBurst(0.05, 1950, "highpass", 0.14 * vol, "sfx", pan);
  }

  public playBlockBreak(
    material: TerrainMaterial,
    distanceAttenuation = 1,
    pan = 0,
  ): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    const key: SoundAssetKey =
      material === "wood" || material === "tree" ? "break_wood" : "break_rock";
    if (this.playBuffer(key, "sfx", 0.58 * vol, pan, 0.1)) return;

    const freq =
      material === "wood" || material === "tree" ? 960 : 480;
    this.triggerNoiseBurst(0.24, freq, "bandpass", 0.34 * vol, "sfx", pan);
    this.triggerTone(freq * 0.45, 65, 0.18, "triangle", 0.2 * vol, "sfx", pan);
  }

  public playFootstep(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.05) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("footstep_grass", "sfx", 0.22 * vol, pan, 0.2)) return;
    this.triggerNoiseBurst(0.045, 640, "bandpass", 0.09 * vol, "sfx", pan);
  }

  public playJumpLand(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.05) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("jump_land", "sfx", 0.32 * vol, pan, 0.12)) return;
    this.triggerTone(145, 52, 0.09, "sine", 0.16 * vol, "sfx", pan);
    this.triggerNoiseBurst(0.07, 420, "lowpass", 0.12 * vol, "sfx", pan);
  }

  public playWaterSplash(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("water_splash", "sfx", 0.5 * vol, pan, 0.12)) return;
    this.triggerNoiseBurst(0.28, 920, "bandpass", 0.26 * vol, "sfx", pan);
    this.triggerTone(280, 110, 0.18, "sine", 0.12 * vol, "sfx", pan);
  }

  public playMelee(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("melee_swing", "sfx", 0.52 * vol, pan, 0.1)) return;
    this.triggerNoiseBurst(0.12, 820, "bandpass", 0.26 * vol, "sfx", pan);
    this.triggerTone(260, 95, 0.1, "triangle", 0.18 * vol, "sfx", pan);
  }

  public playHitmarker(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("hitmarker", "ui", 0.44)) return;
    this.triggerTone(1420, 960, 0.055, "sine", 0.18, "ui", 0);
  }

  public playPlayerHit(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("player_hit", "sfx", 0.48)) return;
    this.triggerTone(190, 75, 0.12, "sawtooth", 0.2, "sfx", 0);
  }

  public playDeath(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("player_death", "sfx", 0.68 * vol, pan)) return;
    this.triggerNoiseBurst(0.32, 1150, "highpass", 0.26 * vol, "sfx", pan);
    this.triggerTone(340, 58, 0.42, "sawtooth", 0.24 * vol, "sfx", pan);
  }

  public playRespawn(distanceAttenuation = 1, pan = 0): void {
    if (this.muted || !this.ctx || distanceAttenuation <= 0.04) return;
    const vol = clamp(distanceAttenuation, 0, 1);
    if (this.playBuffer("player_respawn", "sfx", 0.52 * vol, pan)) return;
    this.triggerTone(380, 860, 0.22, "sine", 0.18 * vol, "sfx", pan);
  }

  public playPickup(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("pickup_item", "ui", 0.5)) return;
    this.triggerTone(520, 780, 0.08, "triangle", 0.16, "ui", 0);
    window.setTimeout(() => {
      this.triggerTone(780, 1080, 0.1, "triangle", 0.16, "ui", 0);
    }, 75);
  }

  public playKillNotify(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("kill_notify", "ui", 0.46)) return;
    this.triggerTone(720, 1080, 0.11, "sine", 0.16, "ui", 0);
  }

  public playUiClick(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("ui_click", "ui", 0.36)) return;
    this.triggerTone(620, 480, 0.045, "sine", 0.12, "ui", 0);
  }

  public playUiSwitch(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("ui_switch", "ui", 0.38)) return;
    this.triggerTone(480, 720, 0.065, "triangle", 0.13, "ui", 0);
  }

  public playUiConfirm(): void {
    if (this.muted || !this.ctx) return;
    if (this.playBuffer("ui_confirm", "ui", 0.5)) return;
    this.triggerTone(520, 680, 0.08, "sine", 0.16, "ui", 0);
    window.setTimeout(() => {
      this.triggerTone(680, 1020, 0.14, "sine", 0.18, "ui", 0);
    }, 75);
  }

  private triggerTone(
    startFreq: number,
    endFreq: number,
    durationSec: number,
    type: OscillatorType,
    volume: number,
    bus: Exclude<SoundBusName, "master">,
    pan: number,
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      now + durationSec,
    );
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain);
    this.connectToBus(gain, bus, pan);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private triggerNoiseBurst(
    durationSec: number,
    freq: number,
    filterType: BiquadFilterType,
    volume: number,
    bus: Exclude<SoundBusName, "master">,
    pan: number,
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    src.connect(filter);
    filter.connect(gain);
    this.connectToBus(gain, bus, pan);
    src.start(now, Math.random() * 0.5);
    src.stop(now + durationSec + 0.02);
  }
}
