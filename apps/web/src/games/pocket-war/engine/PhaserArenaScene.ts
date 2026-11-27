import { pocketWarAssets } from "../assets/AssetLoader";
import {
  CHARACTER_CATALOG,
  EVENT_KIND_BLOCK_BREAK,
  EVENT_KIND_EXPLOSION,
  EVENT_KIND_HIT,
  EVENT_KIND_MELEE,
  EVENT_KIND_PICKUP,
  EVENT_KIND_PLAYER_DEATH,
  EVENT_KIND_PLAYER_RESPAWN,
  EVENT_KIND_SHOT,
  EVENT_KIND_WATER_SPLASH,
  MAP_CATALOG,
  POCKET_WAR_LIMITS,
  PROJ_KIND_BOMB,
  PROJ_KIND_ROCKET,
  WEAPON_CATALOG,
  computeGrenadeLaunch,
  indexToKillWeaponId,
  indexToMaterial,
  indexToPickupKind,
  type DebugCoordToast,
  type DebugOverlayOptions,
  type HudTelemetry,
  type KillWeaponIconId,
  type PhaserArenaBridge,
  type PlayerScoreRow,
  type PocketWarKillFeedEntry,
  type PocketWarState,
  type RenderPlayerState,
  type SnapshotEventTuple,
  type TouchControllerVisualState,
  type WeaponId,
} from "../types";
import { InputManager } from "./InputManager";
import { PocketWarNetClient } from "./NetClient";
import type { SoundFX } from "./SoundFX";
import { drawSoldierRig } from "./render/CharacterRigRenderer";
import {
  WorldArtworkRenderer,
  type WorldRenderCamera,
} from "./render/WorldArtworkRenderer";

export interface MountPhaserArenaOptions {
  containerEl: HTMLElement;
  initialState: PocketWarState;
  currentUserId: string;
  soundFx: SoundFX;
  isMobile: boolean;
  initialDebug: DebugOverlayOptions;
  onTelemetry: (telemetry: HudTelemetry, scoreRows: PlayerScoreRow[]) => void;
  onTouchVisual: (visual: TouchControllerVisualState) => void;
  onKillFeed: (entries: readonly PocketWarKillFeedEntry[]) => void;
  onFps: (fps: number) => void;
  onTogglePause: () => void;
  onScoreboardToggle: (open: boolean) => void;
  onOpenChat: () => void;
  onToggleDebug: () => void;
  onDebugCoordPicked: (toast: DebugCoordToast) => void;
}

interface PooledParticle {
  active: boolean;
  kind:
    | "spark"
    | "smoke"
    | "flame"
    | "debris"
    | "shell"
    | "splash"
    | "ring"
    | "popup"
    | "slash";
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  size: number;
  endSize: number;
  angle: number;
  spin: number;
  age: number;
  maxAge: number;
  color: string;
  strokeColor: string;
  text: string;
}

interface PooledTracer {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  age: number;
  maxAge: number;
  color: string;
  width: number;
}

function computeTargetDpr(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.devicePixelRatio;
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.min(raw, 2);
}

function isFirearmId(id: KillWeaponIconId): id is WeaponId {
  return (
    id === "m4a1" ||
    id === "vector_smg" ||
    id === "pistol" ||
    id === "spas12" ||
    id === "barrett50" ||
    id === "rpg7"
  );
}

class ParticleTracerPool {
  private readonly particles: PooledParticle[] = [];
  private readonly tracers: PooledTracer[] = [];
  private particleCursor = 0;
  private tracerCursor = 0;

  constructor(isMobile: boolean) {
    const pCap = isMobile ? 220 : 420;
    const tCap = isMobile ? 48 : 96;
    for (let i = 0; i < pCap; i++) {
      this.particles.push({
        active: false,
        kind: "spark",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        size: 4,
        endSize: 0,
        angle: 0,
        spin: 0,
        age: 0,
        maxAge: 0.4,
        color: "#FFFFFF",
        strokeColor: "",
        text: "",
      });
    }
    for (let i = 0; i < tCap; i++) {
      this.tracers.push({
        active: false,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
        age: 0,
        maxAge: 0.12,
        color: "#FFE066",
        width: 2.5,
      });
    }
  }

  private allocParticle(): PooledParticle {
    const p = this.particles[this.particleCursor]!;
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.active = true;
    p.age = 0;
    p.angle = 0;
    p.spin = 0;
    p.strokeColor = "";
    p.text = "";
    return p;
  }

  public spawnTracer(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 2.6,
    maxAge = 0.1,
  ): void {
    const t = this.tracers[this.tracerCursor]!;
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    t.active = true;
    t.x1 = x1;
    t.y1 = y1;
    t.x2 = x2;
    t.y2 = y2;
    t.age = 0;
    t.maxAge = maxAge;
    t.color = color;
    t.width = width;
  }

  public spawnJetpackPlume(
    x: number,
    y: number,
    carrierVx: number,
    lowFuel: boolean,
  ): void {
    const p = this.allocParticle();
    p.kind = "flame";
    p.x = x + (Math.random() - 0.5) * 6;
    p.y = y;
    p.vx = carrierVx * 0.2 + (Math.random() - 0.5) * 35;
    p.vy = 110 + Math.random() * 85;
    p.gravity = -40;
    p.size = 7 + Math.random() * 4;
    p.endSize = 1;
    p.maxAge = 0.18 + Math.random() * 0.1;
    p.color = lowFuel ? "#F43F5E" : Math.random() > 0.4 ? "#FB923C" : "#FEF08A";

    if (Math.random() < 0.45) {
      const s = this.allocParticle();
      s.kind = "smoke";
      s.x = x;
      s.y = y + 8;
      s.vx = (Math.random() - 0.5) * 24;
      s.vy = 45 + Math.random() * 30;
      s.gravity = -30;
      s.size = 6;
      s.endSize = 16;
      s.maxAge = 0.36;
      s.color = "rgba(226, 232, 240, 0.52)";
    }
  }

  public spawnRocketSmoke(x: number, y: number): void {
    const s = this.allocParticle();
    s.kind = "smoke";
    s.x = x + (Math.random() - 0.5) * 4;
    s.y = y + (Math.random() - 0.5) * 4;
    s.vx = (Math.random() - 0.5) * 28;
    s.vy = -15 + (Math.random() - 0.5) * 20;
    s.gravity = -18;
    s.size = 7;
    s.endSize = 20;
    s.maxAge = 0.38;
    s.color = "rgba(241, 245, 249, 0.65)";

    const f = this.allocParticle();
    f.kind = "flame";
    f.x = x;
    f.y = y;
    f.vx = (Math.random() - 0.5) * 40;
    f.vy = (Math.random() - 0.5) * 40;
    f.gravity = 0;
    f.size = 6.5;
    f.endSize = 1;
    f.maxAge = 0.12;
    f.color = "#F97316";
  }

  public spawnShellCasing(
    x: number,
    y: number,
    aimAngle: number,
    color: string,
  ): void {
    const p = this.allocParticle();
    p.kind = "shell";
    const backDir = Math.cos(aimAngle) >= 0 ? -1 : 1;
    p.x = x;
    p.y = y;
    p.vx = backDir * (75 + Math.random() * 65);
    p.vy = -120 - Math.random() * 75;
    p.gravity = 780;
    p.size = 5;
    p.endSize = 5;
    p.angle = Math.random() * Math.PI;
    p.spin = (Math.random() - 0.5) * 18;
    p.maxAge = 0.65;
    p.color = color;
  }

  public spawnImpactSparks(
    x: number,
    y: number,
    color: string,
    count = 8,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 240;
      p.kind = "spark";
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd - 45;
      p.gravity = 540;
      p.size = 3.2 + Math.random() * 2.5;
      p.endSize = 0.5;
      p.maxAge = 0.22 + Math.random() * 0.18;
      p.color = color;
    }
  }

  public spawnCelExplosion(x: number, y: number, radius: number): void {
    const ring = this.allocParticle();
    ring.kind = "ring";
    ring.x = x;
    ring.y = y;
    ring.vx = 0;
    ring.vy = 0;
    ring.gravity = 0;
    ring.size = 18;
    ring.endSize = radius * 1.12;
    ring.maxAge = 0.34;
    ring.color = "#FEF08A";
    ring.strokeColor = "#F97316";

    const puffs = 12;
    for (let i = 0; i < puffs; i++) {
      const a = (i / puffs) * Math.PI * 2 + Math.random() * 0.35;
      const dist = Math.random() * radius * 0.32;
      const spd = 55 + Math.random() * 145;
      const f = this.allocParticle();
      f.kind = "flame";
      f.x = x + Math.cos(a) * dist;
      f.y = y + Math.sin(a) * dist;
      f.vx = Math.cos(a) * spd;
      f.vy = Math.sin(a) * spd - 35;
      f.gravity = -75;
      f.size = 20 + Math.random() * 18;
      f.endSize = 3;
      f.maxAge = 0.32 + Math.random() * 0.22;
      f.color = i % 3 === 0 ? "#FEF08A" : i % 3 === 1 ? "#FB923C" : "#EF4444";
      f.strokeColor = "#1C1917";
    }

    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.allocParticle();
      s.kind = "smoke";
      s.x = x + Math.cos(a) * 18;
      s.y = y + Math.sin(a) * 18;
      s.vx = Math.cos(a) * 85;
      s.vy = Math.sin(a) * 65 - 70;
      s.gravity = -45;
      s.size = 16 + Math.random() * 12;
      s.endSize = 38;
      s.maxAge = 0.65 + Math.random() * 0.35;
      s.color = "rgba(30, 41, 59, 0.72)";
    }

    this.spawnImpactSparks(x, y, "#FACC15", 14);
  }

  public spawnDebrisBurst(
    x: number,
    y: number,
    colorA: string,
    colorB: string,
  ): void {
    for (let i = 0; i < 14; i++) {
      const p = this.allocParticle();
      const a = -Math.PI * 0.85 + Math.random() * Math.PI * 0.7;
      const spd = 120 + Math.random() * 240;
      p.kind = "debris";
      p.x = x + (Math.random() - 0.5) * 24;
      p.y = y + (Math.random() - 0.5) * 24;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd - 60;
      p.gravity = 880;
      p.size = 6 + Math.random() * 7;
      p.endSize = 4;
      p.angle = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 14;
      p.maxAge = 0.65 + Math.random() * 0.35;
      p.color = i % 2 === 0 ? colorA : colorB;
      p.strokeColor = "#0F172A";
    }
  }

  public spawnWaterSplash(x: number, y: number, scale = 1): void {
    const count = Math.round(11 * scale);
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.kind = "splash";
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 190 * scale;
      p.vy = -(150 + Math.random() * 210) * scale;
      p.gravity = 780;
      p.size = 5.5 * scale;
      p.endSize = 1.5;
      p.maxAge = 0.45 + Math.random() * 0.25;
      p.color = i % 2 === 0 ? "#E0F2FE" : "#38BDF8";
    }
  }

  public spawnLandingDust(x: number, y: number, scale = 1): void {
    for (let i = 0; i < 6; i++) {
      const p = this.allocParticle();
      p.kind = "smoke";
      p.x = x + (Math.random() - 0.5) * 18;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 110 * scale;
      p.vy = -25 - Math.random() * 35;
      p.gravity = 40;
      p.size = 5 * scale;
      p.endSize = 13 * scale;
      p.maxAge = 0.32;
      p.color = "rgba(214, 211, 209, 0.55)";
    }
  }

  public spawnDamagePopup(
    x: number,
    y: number,
    dmg: number,
    big: boolean,
  ): void {
    const p = this.allocParticle();
    p.kind = "popup";
    p.x = x + (Math.random() - 0.5) * 16;
    p.y = y - 24;
    p.vx = (Math.random() - 0.5) * 28;
    p.vy = -68;
    p.gravity = 35;
    p.size = big ? 17 : 13;
    p.endSize = big ? 17 : 13;
    p.maxAge = 0.72;
    p.color = big ? "#FACC15" : "#FB7185";
    p.text = `-${dmg}`;
  }

  public spawnMeleeSlash(x: number, y: number, angle: number): void {
    const p = this.allocParticle();
    p.kind = "slash";
    p.x = x + Math.cos(angle) * 24;
    p.y = y + Math.sin(angle) * 24;
    p.vx = 0;
    p.vy = 0;
    p.gravity = 0;
    p.size = 36;
    p.endSize = 48;
    p.angle = angle;
    p.maxAge = 0.18;
    p.color = "#E0F2FE";
  }

  public spawnRingBurst(
    x: number,
    y: number,
    color: string,
    endRadius = 56,
  ): void {
    const r = this.allocParticle();
    r.kind = "ring";
    r.x = x;
    r.y = y;
    r.vx = 0;
    r.vy = 0;
    r.gravity = 0;
    r.size = 12;
    r.endSize = endRadius;
    r.maxAge = 0.4;
    r.color = color;
    r.strokeColor = color;
    this.spawnImpactSparks(x, y, color, 8);
  }

  public step(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
    }

    for (const t of this.tracers) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.maxAge) {
        t.active = false;
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const t of this.tracers) {
      if (!t.active) continue;
      const alpha = Math.max(0, 1 - t.age / t.maxAge);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = Math.max(1, t.width * 0.45);
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      if (!p.active) continue;
      const ratio = Math.max(0, Math.min(1, p.age / p.maxAge));
      const alpha = 1 - ratio;
      const curSize = p.size + (p.endSize - p.size) * ratio;

      ctx.save();
      ctx.globalAlpha = p.kind === "smoke" ? alpha * 0.72 : alpha;

      if (p.kind === "ring") {
        ctx.strokeStyle = p.strokeColor || p.color;
        ctx.lineWidth = Math.max(1.5, 6 * alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, curSize), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "slash") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * alpha;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, 0, curSize, -0.85, 0.85);
        ctx.stroke();
      } else if (p.kind === "popup") {
        ctx.font = `900 ${Math.round(curSize)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
        ctx.lineWidth = 3.5;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === "debris" || p.kind === "shell") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        const w = p.kind === "shell" ? curSize * 1.4 : curSize;
        const h = p.kind === "shell" ? curSize * 0.55 : curSize * 0.85;
        ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
        if (p.strokeColor) {
          ctx.strokeStyle = p.strokeColor;
          ctx.lineWidth = 1.4;
          ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
        }
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.8, curSize), 0, Math.PI * 2);
        ctx.fill();
        if (p.strokeColor) {
          ctx.strokeStyle = p.strokeColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Dynamically imports Phaser 4 (`phaser@4.0.0-rc.7`) so Vite code-splits Phaser
 * out of Kridora's initial bundle, boots the Pocket War arena scene, and returns
 * a clean imperative bridge for React HUD actions & lifecycle teardown.
 */
export async function mountPhaserArena(
  options: MountPhaserArenaOptions,
): Promise<PhaserArenaBridge> {
  const Phaser = await import("phaser");
  const {
    containerEl,
    initialState,
    currentUserId,
    soundFx,
    isMobile,
    initialDebug,
  } = options;

  const map = MAP_CATALOG[initialState.settings.mapId];
  pocketWarAssets.preloadAll(map);

  const worldRenderer = new WorldArtworkRenderer();
  const pool = new ParticleTracerPool(isMobile);

  let debugOptions: DebugOverlayOptions = { ...initialDebug };
  let spectateTargetId: string | null = null;
  let cameraTrauma = 0;
  let damageVignette = 0;
  let debugToastId = 1;
  let camX = initialState.players[currentUserId]?.x ?? 680;
  let camY = initialState.players[currentUserId]?.y ?? 390;
  let camZoom = 1;
  let latestViewW = Math.max(1, containerEl.clientWidth);
  let latestViewH = Math.max(1, containerEl.clientHeight);
  let destroyed = false;
  let wasLocalReloading = false;
  let lastReloadWeaponId: WeaponId | null = null;
  let manualReloadGraceUntil = 0;

  const getSpatialAudio = (wx: number, wy: number) => {
    const dx = wx - camX;
    const dy = wy - camY;
    const dist = Math.hypot(dx, dy);
    return {
      vol: Math.max(0, 1 - dist / 1600),
      pan: Math.max(-0.9, Math.min(0.9, dx / 760)),
    };
  };

  const netClient = new PocketWarNetClient(initialState, currentUserId, {
    onServerEvents: (events) => {
      handleAuthoritativeEvents(events);
    },
    onKillFeed: (entries) => {
      if (entries.length > 0) {
        soundFx.playKillNotify();
        options.onKillFeed(entries);
      }
    },
    onLocalStepEvents: (ev, x, y, vx, isBoosting, fuel) => {
      if (ev.justLanded) {
        const scale = Math.min(1.25, ev.landingSpeed / 420);
        pool.spawnLandingDust(x, y + POCKET_WAR_LIMITS.PLAYER_HALF_H, scale);
        soundFx.playJumpLand(Math.min(1, scale * 0.85), 0);
      }
      if (ev.justEnteredWater) {
        pool.spawnWaterSplash(x, map.waterSurfaceY, 1.05);
        soundFx.playWaterSplash(0.9, 0);
      } else if (ev.justExitedWater) {
        pool.spawnWaterSplash(x, map.waterSurfaceY, 0.7);
        soundFx.playWaterSplash(0.6, 0);
      }
      if (ev.footstepTriggered) {
        soundFx.playFootstep(0.85, 0);
      }
      soundFx.setJetpackActive(isBoosting, 0.9);
      if (isBoosting) {
        const lowFuel = fuel < 25;
        if (lowFuel) soundFx.playLowFuelBeep();
        const nozzleX =
          Math.cos(input.getSnapshot(0, 0, isMobile).aimAngle) < 0
            ? x + 12
            : x - 12;
        pool.spawnJetpackPlume(nozzleX, y + 13, vx, lowFuel);
      }
    },
    onLocalShot: (x, y, angle, weaponId) => {
      const weapon = WEAPON_CATALOG[weaponId];
      soundFx.playWeaponShot(weaponId, 1, 0);
      netClient.triggerMuzzleKick(currentUserId, weapon.recoil);
      cameraTrauma = Math.min(
        1,
        cameraTrauma +
          (weaponId === "rpg7"
            ? 0.28
            : weaponId === "barrett50"
              ? 0.22
              : weaponId === "spas12"
                ? 0.16
                : 0.05),
      );
      if (weapon.projectileType !== "rocket") {
        pool.spawnShellCasing(
          x,
          y,
          angle,
          weaponId === "spas12" ? "#EF4444" : "#FACC15",
        );
        const physics = netClient.getPhysicsWorld();
        const targets = netClient.getRemoteHitTargets();
        const count = Math.min(weapon.pellets, 7);
        for (let i = 0; i < count; i++) {
          const spread =
            count > 1
              ? (i - (count - 1) * 0.5) * (weapon.spreadRad / count)
              : 0;
          const a = angle + spread;
          const endX = x + Math.cos(a) * Math.min(weapon.maxRangePx, 950);
          const endY = y + Math.sin(a) * Math.min(weapon.maxRangePx, 950);
          const ray = physics.rayCastSegment(
            x,
            y,
            endX,
            endY,
            currentUserId,
            targets,
          );
          pool.spawnTracer(
            x,
            y,
            ray.x,
            ray.y,
            weapon.color,
            weaponId === "barrett50" ? 3.8 : 2.2,
            weaponId === "barrett50" ? 0.18 : 0.09,
          );
          if (ray.hit) {
            pool.spawnImpactSparks(
              ray.x,
              ray.y,
              ray.kind === "player" ? "#FB7185" : "#FEF08A",
              4,
            );
          }
        }
      }
    },
    onLocalReload: () => {
      soundFx.playReload();
      wasLocalReloading = true;
      manualReloadGraceUntil = performance.now() + 260;
    },
  });

  void pocketWarAssets
    .loadCollisionMap(map.assets.collisionJson)
    .then((collisionData) => {
      if (!destroyed && collisionData) {
        netClient.applyCollisionData(collisionData, initialState);
      }
    });

  const handleDebugCanvasClick = (clientX: number, clientY: number) => {
    const rect = containerEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = Math.round(camX + (sx - latestViewW * 0.5) / camZoom);
    const wy = Math.round(camY + (sy - latestViewH * 0.5) / camZoom);
    const jsonSnippet = `{ "x": ${wx}, "y": ${wy} }`;

    console.info(`[PocketWar Debug] World Coords: ${jsonSnippet}`);
    let copied = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      copied = true;
      void navigator.clipboard.writeText(jsonSnippet).catch(() => undefined);
    }

    options.onDebugCoordPicked({
      id: debugToastId++,
      x: wx,
      y: wy,
      copied,
    });
  };

  const triggerReload = () => {
    soundFx.unlock();
    const curTelemetry = netClient.buildHudTelemetry(
      input.getSnapshot(0, 0, isMobile),
      Date.now(),
    );
    if (
      curTelemetry.isAlive &&
      !curTelemetry.isReloading &&
      curTelemetry.ammo < curTelemetry.magSize &&
      curTelemetry.reserveAmmo !== 0
    ) {
      soundFx.playReload();
      netClient.notifyLocalManualReload(
        curTelemetry.activeWeaponId,
        Date.now(),
      );
      wasLocalReloading = true;
      lastReloadWeaponId = curTelemetry.activeWeaponId;
      manualReloadGraceUntil = performance.now() + 260;
    }
    input.triggerReloadFlag();
  };

  const triggerThrowBomb = () => {
    soundFx.unlock();
    soundFx.playMelee(0.65, 0);
    input.triggerThrowBombFlag();
  };

  const triggerMelee = () => {
    soundFx.unlock();
    soundFx.playMelee(1, 0);
    input.triggerMeleeFlag();
    netClient.triggerMeleeAnim(currentUserId);
    const lp = netClient.getLocalRenderPosition();
    pool.spawnMeleeSlash(
      lp.x,
      lp.y,
      input.getSnapshot(0, 0, isMobile).aimAngle,
    );
  };

  const triggerPickup = () => {
    soundFx.unlock();
    input.triggerPickupFlag();
  };

  const triggerSwitchWeapon = (slot?: 0 | 1) => {
    soundFx.unlock();
    const cur = input.getActiveSlot();
    const next: 0 | 1 = slot !== undefined ? slot : cur === 0 ? 1 : 0;
    if (next === cur) return;
    input.setActiveSlot(next);
    input.triggerSwitchWeaponFlag();
    netClient.setLocalActiveSlotOverride(next);
    soundFx.playUiSwitch();
  };

  const triggerToggleScope = () => {
    soundFx.unlock();
    input.setScoped(!input.getScoped());
    soundFx.playUiClick();
  };

  const input = new InputManager({
    onThrowBomb: triggerThrowBomb,
    onReload: triggerReload,
    onMelee: triggerMelee,
    onPickup: triggerPickup,
    onSwitchWeapon: triggerSwitchWeapon,
    onToggleScope: triggerToggleScope,
    onTogglePause: options.onTogglePause,
    onScoreboardToggle: options.onScoreboardToggle,
    onOpenChat: options.onOpenChat,
    onToggleDebug: options.onToggleDebug,
    onDebugCanvasClick: handleDebugCanvasClick,
    onFirstInteraction: () => soundFx.unlock(),
  });

  const initialMe = initialState.players[currentUserId];
  if (initialMe) {
    input.setInitialAimAngle(initialMe.aimAngle);
    input.setActiveSlot(initialMe.activeSlot);
  }
  input.setDebugClickMode(initialDebug.showCollisions);

  const handleAuthoritativeEvents = (events: readonly SnapshotEventTuple[]) => {
    const physics = netClient.getPhysicsWorld();

    for (const ev of events) {
      const kind = ev[0];
      const x = ev[1];
      const y = ev[2];
      const aux1 = ev[3];
      const aux2 = ev[4];
      const actorId = ev[5];
      const targetId = ev[6];
      const { vol, pan } = getSpatialAudio(x, y);

      if (kind === EVENT_KIND_SHOT) {
        if (actorId === currentUserId && netClient.consumePredictedShotAck()) {
          continue;
        }
        const angle = aux1 / 1000;
        const killWeapon = indexToKillWeaponId(aux2);
        const weaponId: WeaponId = isFirearmId(killWeapon)
          ? killWeapon
          : "m4a1";
        const weapon = WEAPON_CATALOG[weaponId];

        soundFx.playWeaponShot(
          weaponId,
          actorId === currentUserId ? 1 : vol * 0.88,
          actorId === currentUserId ? 0 : pan,
        );
        netClient.triggerMuzzleKick(actorId, weapon.recoil);

        if (actorId === currentUserId) {
          cameraTrauma = Math.min(
            1,
            cameraTrauma +
              (weaponId === "rpg7"
                ? 0.28
                : weaponId === "barrett50"
                  ? 0.22
                  : weaponId === "spas12"
                    ? 0.16
                    : 0.05),
          );
        }

        if (weapon.projectileType !== "rocket") {
          pool.spawnShellCasing(
            x,
            y,
            angle,
            weaponId === "spas12" ? "#EF4444" : "#FACC15",
          );
          const count = Math.min(weapon.pellets, 7);
          for (let i = 0; i < count; i++) {
            const spread =
              count > 1
                ? (i - (count - 1) * 0.5) * (weapon.spreadRad / count)
                : 0;
            const a = angle + spread;
            const endX = x + Math.cos(a) * Math.min(weapon.maxRangePx, 950);
            const endY = y + Math.sin(a) * Math.min(weapon.maxRangePx, 950);
            const ray = physics.rayCastSegment(x, y, endX, endY, actorId, []);
            pool.spawnTracer(
              x,
              y,
              ray.x,
              ray.y,
              weapon.color,
              weaponId === "barrett50" ? 3.8 : 2.2,
              weaponId === "barrett50" ? 0.18 : 0.09,
            );
            if (ray.hit) {
              pool.spawnImpactSparks(ray.x, ray.y, "#FEF08A", 4);
            }
          }
        }
      } else if (kind === EVENT_KIND_HIT) {
        const dmg = aux2;
        pool.spawnImpactSparks(x, y, "#FB7185", 8);
        if (dmg > 0) {
          pool.spawnDamagePopup(x, y, dmg, dmg >= 42);
        }
        if (targetId) {
          netClient.triggerHitFlash(targetId);
        }
        if (actorId === currentUserId && targetId !== currentUserId) {
          soundFx.playHitmarker();
        }
        if (targetId === currentUserId) {
          cameraTrauma = Math.min(1, cameraTrauma + 0.3);
          damageVignette = Math.min(1, damageVignette + 0.72);
          soundFx.playPlayerHit();
        }
      } else if (kind === EVENT_KIND_EXPLOSION) {
        const radius = Math.max(70, aux1);
        const w = indexToKillWeaponId(aux2);
        const blastKind =
          w === "rpg7" ? "rocket" : w === "barrel" ? "barrel" : "grenade";
        pool.spawnCelExplosion(x, y, radius);
        soundFx.playExplosion(blastKind, vol, pan);
        cameraTrauma = Math.min(1, cameraTrauma + Math.max(0.16, vol * 0.92));
      } else if (kind === EVENT_KIND_BLOCK_BREAK) {
        const mat = indexToMaterial(aux1);
        const colA =
          mat === "barrel"
            ? "#EF4444"
            : mat === "rock" || mat === "concrete"
              ? "#64748B"
              : "#B45309";
        const colB =
          mat === "barrel"
            ? "#FACC15"
            : mat === "rock" || mat === "concrete"
              ? "#334155"
              : "#78350F";
        pool.spawnDebrisBurst(x, y, colA, colB);
        soundFx.playBlockBreak(mat, vol, pan);
        cameraTrauma = Math.min(1, cameraTrauma + vol * 0.25);
      } else if (kind === EVENT_KIND_PLAYER_DEATH) {
        const pal =
          CHARACTER_CATALOG[
            initialState.players[targetId]?.characterId ?? "rex"
          ].palette;
        pool.spawnDebrisBurst(x, y, pal.suitPrimary, pal.sashColor);
        pool.spawnRingBurst(x, y, "#FB7185", 64);
        soundFx.playDeath(vol, pan);
        cameraTrauma = Math.min(1, cameraTrauma + vol * 0.42);
      } else if (kind === EVENT_KIND_PLAYER_RESPAWN) {
        pool.spawnRingBurst(x, y, "#38BDF8", 58);
        soundFx.playRespawn(vol, pan);
      } else if (kind === EVENT_KIND_MELEE) {
        if (actorId !== currentUserId) {
          pool.spawnMeleeSlash(x, y, aux1 / 1000);
          soundFx.playMelee(vol, pan);
          netClient.triggerMeleeAnim(actorId);
        }
      } else if (kind === EVENT_KIND_PICKUP) {
        const pKind = indexToPickupKind(aux1);
        const col =
          pKind === "medkit"
            ? "#22C55E"
            : pKind === "grenade_pack"
              ? "#F97316"
              : "#38BDF8";
        pool.spawnRingBurst(x, y, col, 48);
        if (actorId === currentUserId) {
          soundFx.playPickup();
        }
      } else if (kind === EVENT_KIND_WATER_SPLASH) {
        if (actorId !== currentUserId) {
          pool.spawnWaterSplash(x, y, 0.9);
          soundFx.playWaterSplash(vol * 0.7, pan);
        }
      }
    }
  };

  class PocketWarPhaserScene extends Phaser.Scene {
    private dpr = computeTargetDpr();
    private accumulator = 0;
    private lastHudPushAt = 0;
    private lastTouchPushAt = 0;
    private lastHudSignature = "";
    private fpsFrames = 0;
    private fpsElapsed = 0;
    private resizeObserver: ResizeObserver | null = null;
    private detachResizeListeners: (() => void) | null = null;
    private pendingRender: {
      players: RenderPlayerState[];
      projectiles: ReturnType<PocketWarNetClient["getRenderProjectiles"]>;
      controlFrame: { aimAngle: number; isScoped: boolean };
      timeSec: number;
      nowEpoch: number;
    } | null = null;

    constructor() {
      super({ key: "PocketWarArenaScene" });
    }

    public create(): void {
      // Backdrop paints the full frame; skip redundant camera fill before POST_RENDER
      this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
      this.syncSurfaceSize();

      const canvas = this.game.canvas;
      const initCtx = this.sys.context ?? canvas?.getContext("2d");
      if (initCtx && canvas) {
        initCtx.fillStyle = "#60C5F1";
        initCtx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const onPostRender = () => {
        this.handlePostRender();
      };
      this.game.events.on(Phaser.Core.Events.POST_RENDER, onPostRender);

      const onViewportChange = () => {
        this.syncSurfaceSize();
      };

      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(onViewportChange);
        this.resizeObserver.observe(containerEl);
      }
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("orientationchange", onViewportChange);

      this.detachResizeListeners = () => {
        this.game.events.off(Phaser.Core.Events.POST_RENDER, onPostRender);
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("orientationchange", onViewportChange);
      };

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.detachResizeListeners?.();
        this.detachResizeListeners = null;
      });
      this.events.once(Phaser.Scenes.Events.DESTROY, () => {
        this.detachResizeListeners?.();
        this.detachResizeListeners = null;
      });
    }

    private syncSurfaceSize(): void {
      if (destroyed) return;
      const cssW = Math.max(1, Math.floor(containerEl.clientWidth));
      const cssH = Math.max(1, Math.floor(containerEl.clientHeight));
      const nextDpr = computeTargetDpr();
      const pixelW = Math.max(1, Math.round(cssW * nextDpr));
      const pixelH = Math.max(1, Math.round(cssH * nextDpr));

      latestViewW = cssW;
      latestViewH = cssH;
      this.dpr = nextDpr;

      if (this.scale.width !== pixelW || this.scale.height !== pixelH) {
        this.scale.resize(pixelW, pixelH);
      }
    }

    private handlePostRender(): void {
      if (destroyed || !this.pendingRender) return;
      const ctx = this.sys.context ?? this.game.canvas?.getContext("2d");
      if (!ctx) return;

      const frame = this.pendingRender;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.renderFrame(
        ctx,
        frame.players,
        frame.projectiles,
        frame.controlFrame,
        frame.timeSec,
        frame.nowEpoch,
      );
      ctx.restore();
    }

    public override update(time: number, delta: number): void {
      if (destroyed) return;

      const rawDt = Math.min(0.05, Math.max(0.001, delta / 1000));
      const timeSec = time / 1000;
      const nowPerf = performance.now();
      const nowEpoch = Date.now();

      this.fpsFrames += 1;
      this.fpsElapsed += rawDt;
      if (this.fpsElapsed >= 0.5) {
        if (debugOptions.showFps || debugOptions.showCollisions) {
          options.onFps(Math.round(this.fpsFrames / this.fpsElapsed));
        }
        this.fpsFrames = 0;
        this.fpsElapsed = 0;
      }

      input.stepAim(rawDt);
      const localPos = netClient.getLocalRenderPosition();
      const localScreenX = (localPos.x - camX) * camZoom + latestViewW * 0.5;
      const localScreenY = (localPos.y - camY) * camZoom + latestViewH * 0.5;
      const controlFrame = input.getSnapshot(
        localScreenX,
        localScreenY,
        isMobile,
      );

      this.accumulator += rawDt;
      let stepsRun = 0;
      while (this.accumulator >= POCKET_WAR_LIMITS.FIXED_DT && stepsRun < 5) {
        this.accumulator -= POCKET_WAR_LIMITS.FIXED_DT;
        netClient.stepPrediction(controlFrame, nowEpoch);
        stepsRun += 1;
      }

      const packetFlags = input.buildPacketFlags(controlFrame);
      netClient.maybeSendInput(
        controlFrame,
        packetFlags,
        nowPerf,
        nowEpoch,
        input.consumeShootEdgePressed(),
      );

      netClient.updateVisualSmoothing(rawDt);
      pool.step(rawDt);

      const players = netClient.getRenderPlayers(nowPerf, controlFrame);
      const projectiles = netClient.getRenderProjectiles(nowPerf);

      const localPlayer = players.find((p) => p.userId === currentUserId);
      const isNowReloading = Boolean(
        localPlayer?.isAlive && localPlayer.isReloading,
      );
      const activeWeaponId = localPlayer?.activeWeaponId ?? null;
      if (isNowReloading) {
        if (
          (!wasLocalReloading || activeWeaponId !== lastReloadWeaponId) &&
          nowPerf >= manualReloadGraceUntil
        ) {
          soundFx.playReload();
        }
        wasLocalReloading = true;
        lastReloadWeaponId = activeWeaponId;
      } else if (nowPerf >= manualReloadGraceUntil) {
        wasLocalReloading = false;
        lastReloadWeaponId = null;
      }

      for (const pr of projectiles) {
        if (pr.kind === PROJ_KIND_ROCKET) {
          pool.spawnRocketSmoke(pr.x, pr.y);
        }
      }
      for (const p of players) {
        if (p.userId !== currentUserId && p.isAlive && p.isBoosting) {
          const nozzleX = Math.cos(p.aimAngle) < 0 ? p.x + 12 : p.x - 12;
          pool.spawnJetpackPlume(nozzleX, p.y + 13, p.vx, p.jetpackFuel < 25);
        }
      }

      this.updateCamera(players, controlFrame, rawDt);

      this.pendingRender = {
        players,
        projectiles,
        controlFrame,
        timeSec,
        nowEpoch,
      };

      if (nowPerf - this.lastHudPushAt >= 55) {
        this.lastHudPushAt = nowPerf;
        const nextTelemetry = netClient.buildHudTelemetry(
          controlFrame,
          nowEpoch,
        );
        const sig = `${Math.round(nextTelemetry.hp)}|${nextTelemetry.livesLeft}|${nextTelemetry.isAlive ? 1 : 0}|${nextTelemetry.respawnSecondsLeft}|${nextTelemetry.jetpackFuel}|${nextTelemetry.isOverheated ? 1 : 0}|${nextTelemetry.activeSlot}|${nextTelemetry.activeWeaponId}|${nextTelemetry.ammo}|${nextTelemetry.reserveAmmo}|${nextTelemetry.isReloading ? Math.round(nextTelemetry.reloadProgress * 25) : -1}|${nextTelemetry.bombsLeft}|${Math.round(nextTelemetry.bombCooldownRatio * 10)}|${nextTelemetry.isScoped ? 1 : 0}|${nextTelemetry.kills}|${nextTelemetry.deaths}|${nextTelemetry.nearbyPickupLabel ?? ""}|${nextTelemetry.soloWaitEndsAt ?? 0}|${nextTelemetry.alivePlayersCount}`;
        if (sig !== this.lastHudSignature) {
          this.lastHudSignature = sig;
          options.onTelemetry(nextTelemetry, netClient.buildScoreRows());
        }
      }

      if (isMobile && nowPerf - this.lastTouchPushAt >= 40) {
        this.lastTouchPushAt = nowPerf;
        options.onTouchVisual(input.getTouchVisualState());
      }
    }

    private updateCamera(
      players: readonly RenderPlayerState[],
      controlFrame: { aimAngle: number; isScoped: boolean },
      dt: number,
    ): void {
      const local = players.find((p) => p.userId === currentUserId);
      const follow =
        local && local.isAlive
          ? local
          : (players.find((p) => p.userId === spectateTargetId && p.isAlive) ??
            players.find((p) => p.isAlive) ??
            local);

      const baseScale = Math.max(
        0.58,
        Math.min(1.12, Math.min(latestViewW / 1240, latestViewH / 660)),
      );
      const targetZoom =
        controlFrame.isScoped && local?.isAlive ? baseScale * 0.72 : baseScale;
      camZoom += (targetZoom - camZoom) * Math.min(1, dt * 6.5);

      if (follow) {
        const lookDist =
          follow.userId === currentUserId
            ? controlFrame.isScoped
              ? 230
              : 105
            : 40;
        const targetX = follow.x + Math.cos(follow.aimAngle) * lookDist;
        const targetY = follow.y + Math.sin(follow.aimAngle) * lookDist * 0.65;
        const smooth = 1 - Math.exp(-8.5 * dt);
        camX += (targetX - camX) * smooth;
        camY += (targetY - camY) * smooth;
      }

      const halfW = (latestViewW * 0.5) / camZoom;
      const halfH = (latestViewH * 0.5) / camZoom;
      if (map.width > halfW * 2) {
        camX = Math.max(halfW, Math.min(map.width - halfW, camX));
      } else {
        camX = map.width * 0.5;
      }
      if (map.height > halfH * 2) {
        camY = Math.max(halfH, Math.min(map.height - halfH, camY));
      } else {
        camY = map.height * 0.5;
      }

      cameraTrauma = Math.max(0, cameraTrauma - dt * 1.9);
      damageVignette = Math.max(0, damageVignette - dt * 2.1);
    }

    private renderFrame(
      ctx: CanvasRenderingContext2D,
      players: readonly RenderPlayerState[],
      projectiles: readonly {
        id: number;
        kind: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
      }[],
      controlFrame: { aimAngle: number; isScoped: boolean },
      timeSec: number,
      nowEpoch: number,
    ): void {
      const shakeMag = cameraTrauma * cameraTrauma * 18;
      const shakeX = (Math.random() * 2 - 1) * shakeMag;
      const shakeY = (Math.random() * 2 - 1) * shakeMag;

      const cam: WorldRenderCamera = {
        x: camX + shakeX,
        y: camY + shakeY,
        zoom: camZoom,
        viewW: latestViewW,
        viewH: latestViewH,
        dpr: this.dpr,
      };

      worldRenderer.drawBackdrop(ctx, map, cam, timeSec);

      ctx.save();
      ctx.translate(latestViewW * 0.5, latestViewH * 0.5);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-cam.x, -cam.y);

      worldRenderer.drawWorldGeometry(
        ctx,
        map,
        cam,
        netClient.getDestroyedBlockIds(),
        netClient.getPickupCooldownUntil(),
        timeSec,
        nowEpoch,
      );

      const localPlayer = players.find((p) => p.userId === currentUserId);
      if (localPlayer && localPlayer.isAlive) {
        this.drawAimHelpers(ctx, localPlayer, controlFrame);
      }

      for (const p of players) {
        drawSoldierRig(ctx, p, {
          isLocal: p.userId === currentUserId,
          timeSec,
        });
      }

      this.drawProjectiles(ctx, projectiles, timeSec);

      pool.draw(ctx);

      worldRenderer.drawWaterSurface(ctx, map, timeSec);

      if (debugOptions.showCollisions || debugOptions.showSpawns) {
        worldRenderer.drawDebugOverlay(
          ctx,
          map,
          netClient.getPhysicsWorld(),
          debugOptions,
        );
      }

      ctx.restore();

      if (controlFrame.isScoped && localPlayer?.isAlive) {
        const vig = ctx.createRadialGradient(
          latestViewW * 0.5,
          latestViewH * 0.5,
          Math.min(latestViewW, latestViewH) * 0.34,
          latestViewW * 0.5,
          latestViewH * 0.5,
          Math.max(latestViewW, latestViewH) * 0.64,
        );
        vig.addColorStop(0, "rgba(2, 6, 23, 0)");
        vig.addColorStop(1, "rgba(2, 6, 23, 0.56)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, latestViewW, latestViewH);
      }

      if (damageVignette > 0.02) {
        const dmgGrad = ctx.createRadialGradient(
          latestViewW * 0.5,
          latestViewH * 0.5,
          Math.min(latestViewW, latestViewH) * 0.25,
          latestViewW * 0.5,
          latestViewH * 0.5,
          Math.max(latestViewW, latestViewH) * 0.62,
        );
        dmgGrad.addColorStop(0, "rgba(244, 63, 94, 0)");
        dmgGrad.addColorStop(
          1,
          `rgba(225, 29, 72, ${Math.min(0.65, damageVignette * 0.6)})`,
        );
        ctx.fillStyle = dmgGrad;
        ctx.fillRect(0, 0, latestViewW, latestViewH);
      }
    }

    private drawAimHelpers(
      ctx: CanvasRenderingContext2D,
      local: RenderPlayerState,
      controlFrame: { aimAngle: number; isScoped: boolean },
    ): void {
      const startX = local.x + Math.cos(controlFrame.aimAngle) * 32;
      const startY = local.y - 2 + Math.sin(controlFrame.aimAngle) * 32;
      const range = controlFrame.isScoped ? 920 : 340;
      const endX = startX + Math.cos(controlFrame.aimAngle) * range;
      const endY = startY + Math.sin(controlFrame.aimAngle) * range;
      const ray = netClient
        .getPhysicsWorld()
        .rayCastSegment(startX, startY, endX, endY, currentUserId, []);

      ctx.save();
      ctx.strokeStyle = controlFrame.isScoped
        ? "rgba(244, 63, 94, 0.72)"
        : "rgba(255, 255, 255, 0.36)";
      ctx.lineWidth = controlFrame.isScoped ? 2.2 : 1.8;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(ray.x, ray.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = controlFrame.isScoped ? "#FB7185" : "#FFFFFF";
      ctx.beginPath();
      ctx.arc(ray.x, ray.y, controlFrame.isScoped ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (controlFrame.isScoped && local.bombsLeft > 0) {
        const launch = computeGrenadeLaunch(
          local.x,
          local.y,
          controlFrame.aimAngle,
          local.vx,
          local.vy,
        );
        const pts = netClient
          .getPhysicsWorld()
          .predictGrenadeArc(launch.x, launch.y, launch.vx, launch.vy, 14);
        ctx.fillStyle = "rgba(250, 204, 21, 0.65)";
        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i]!;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(1.8, 3.6 - i * 0.14), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    private drawProjectiles(
      ctx: CanvasRenderingContext2D,
      projectiles: readonly {
        id: number;
        kind: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
      }[],
      timeSec: number,
    ): void {
      for (const pr of projectiles) {
        ctx.save();
        ctx.translate(pr.x, pr.y);

        if (pr.kind === PROJ_KIND_ROCKET) {
          const angle = Math.atan2(pr.vy, pr.vx);
          ctx.rotate(angle);
          ctx.fillStyle = "#334155";
          ctx.fillRect(-10, -3.5, 16, 7);
          ctx.fillStyle = "#F97316";
          ctx.beginPath();
          ctx.moveTo(6, -4.5);
          ctx.lineTo(15, 0);
          ctx.lineTo(6, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#FEF08A";
          ctx.beginPath();
          ctx.arc(-11, 0, 4.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (pr.kind === PROJ_KIND_BOMB) {
          ctx.rotate(timeSec * 8 + pr.id);
          ctx.fillStyle = "#365314";
          ctx.strokeStyle = "#0F172A";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#FACC15";
          ctx.fillRect(-3.5, -11, 7, 4);

          if (Math.sin(timeSec * 22) > 0) {
            ctx.fillStyle = "#EF4444";
            ctx.beginPath();
            ctx.arc(0, -1, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
  }

  const scene = new PocketWarPhaserScene();
  const initialDpr = computeTargetDpr();
  const initialPixelW = Math.max(1, Math.round(latestViewW * initialDpr));
  const initialPixelH = Math.max(1, Math.round(latestViewH * initialDpr));

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: containerEl,
    backgroundColor: "#60C5F1",
    clearBeforeRender: false,
    antialias: true,
    scale: {
      mode: Phaser.Scale.NONE,
      width: initialPixelW,
      height: initialPixelH,
    },
    scene: [scene],
    audio: { noAudio: true },
    input: {
      keyboard: false,
      mouse: false,
      touch: false,
    },
  });

  let detachInput: () => void = () => undefined;
  try {
    detachInput = input.attach(containerEl);
    netClient.start();
    soundFx.setAmbienceActive(true);
  } catch (err) {
    destroyed = true;
    netClient.stop();
    detachInput();
    input.destroy();
    soundFx.setJetpackActive(false);
    soundFx.setAmbienceActive(false);
    game.destroy(true);
    throw err;
  }

  return {
    setPaused: (paused) => {
      input.setPaused(paused);
      if (paused) soundFx.setJetpackActive(false);
    },
    setChatFocused: (focused) => {
      input.setSuspendedForChat(focused);
      if (focused) soundFx.setJetpackActive(false);
    },
    setDebugOptions: (next) => {
      debugOptions = { ...next };
      input.setDebugClickMode(next.showCollisions);
    },
    setSpectateTarget: (userId) => {
      spectateTargetId = userId;
    },
    triggerReload,
    triggerThrowBomb,
    triggerMelee,
    triggerPickup,
    triggerSwitchWeapon,
    triggerToggleScope,
    bindMoveStickElement: (el) => {
      if (!el) return () => undefined;
      return input.bindMoveStickZone(el);
    },
    bindAimStickElement: (el) => {
      if (!el) return () => undefined;
      return input.bindAimStickZone(el);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      netClient.stop();
      detachInput();
      input.destroy();
      soundFx.setJetpackActive(false);
      soundFx.setAmbienceActive(false);
      game.destroy(true);
    },
  };
}
