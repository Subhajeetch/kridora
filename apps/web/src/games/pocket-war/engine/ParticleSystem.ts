import type { MapDefinition, TerrainMaterial } from "../types";
import { GRAVITY } from "./Physics";

export type ParticleShape =
  | "circle"
  | "shard"
  | "smoke"
  | "splinter"
  | "droplet"
  | "leaf"
  | "ember";

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  secondaryColor?: string;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  shape: ParticleShape;
  rotation: number;
  vRot: number;
}

export interface MetaballPuff {
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  maxRadius: number;
  phaseOffset: number;
}

export interface StylizedExplosion {
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
  puffs: MetaballPuff[];
}

export type DebrisKind =
  | "wood_plank"
  | "rock_chunk"
  | "moss_clump"
  | "barrel_shard"
  | "mud_clod"
  | "ragdoll_head"
  | "ragdoll_torso"
  | "ragdoll_limb"
  | "ragdoll_pack"
  | "ragdoll_weapon";

export interface DebrisChunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  vRot: number;
  color: string;
  accent: string;
  outline: string;
  life: number;
  maxLife: number;
  kind: DebrisKind;
  bounces: number;
  inWater: boolean;
}

export interface ShellCasing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
  bounces: number;
}

export interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface MeleeSlashFx {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

export interface DamagePopup {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

interface MaterialBreakStyle {
  main: string;
  accent: string;
  outline: string;
  dust: string;
  chunkKind: DebrisKind;
}

const MATERIAL_STYLES: Record<TerrainMaterial, MaterialBreakStyle> = {
  mud: {
    main: "#78350F",
    accent: "#92400E",
    outline: "#451A03",
    dust: "#A16207",
    chunkKind: "mud_clod",
  },
  rock: {
    main: "#64615B",
    accent: "#4ADE80",
    outline: "#292524",
    dust: "#A8A29E",
    chunkKind: "rock_chunk",
  },
  wood: {
    main: "#B45309",
    accent: "#F59E0B",
    outline: "#451A03",
    dust: "#D6B28B",
    chunkKind: "wood_plank",
  },
  tree: {
    main: "#15803D",
    accent: "#854D0E",
    outline: "#14532D",
    dust: "#4ADE80",
    chunkKind: "moss_clump",
  },
  concrete: {
    main: "#64748B",
    accent: "#CBD5E1",
    outline: "#1E293B",
    dust: "#94A3B8",
    chunkKind: "rock_chunk",
  },
  barrel: {
    main: "#DC2626",
    accent: "#FACC15",
    outline: "#450A0A",
    dust: "#475569",
    chunkKind: "barrel_shard",
  },
};

export class ParticleSystem {
  public particles: SparkParticle[] = [];
  public explosions: StylizedExplosion[] = [];
  public debris: DebrisChunk[] = [];
  public casings: ShellCasing[] = [];
  public ripples: WaterRipple[] = [];
  public meleeSlashes: MeleeSlashFx[] = [];
  public popups: DamagePopup[] = [];

  private readonly maxParticles: number;
  private readonly maxDebris: number;
  private readonly maxCasings: number;

  constructor(isMobile = false) {
    this.maxParticles = isMobile ? 160 : 260;
    this.maxDebris = isMobile ? 64 : 100;
    this.maxCasings = isMobile ? 32 : 60;
  }

  private pushParticle(p: SparkParticle): void {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  private pushDebris(d: DebrisChunk): void {
    if (this.debris.length >= this.maxDebris) {
      this.debris.shift();
    }
    this.debris.push(d);
  }

  public spawnJetpackPlume(
    x: number,
    y: number,
    vx: number,
    lowFuel = false,
  ): void {
    // Hot core spark
    this.pushParticle({
      x: x + (Math.random() - 0.5) * 5,
      y,
      vx: -vx * 0.18 + (Math.random() - 0.5) * 42,
      vy: 155 + Math.random() * 145,
      size: 4.5 + Math.random() * 4.5,
      color: lowFuel
        ? "#F87171"
        : Math.random() > 0.38
          ? "#FFF933"
          : "#FF6B1A",
      life: 0.2,
      maxLife: 0.2,
      gravity: -70,
      drag: 0.93,
      shape: "circle",
      rotation: 0,
      vRot: 0,
    });

    // Occasional bright thruster ember
    if (Math.random() > 0.68) {
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 6,
        y: y + 4,
        vx: -vx * 0.25 + (Math.random() - 0.5) * 95,
        vy: 180 + Math.random() * 120,
        size: 2.5 + Math.random() * 2,
        color: "#FDE047",
        life: 0.34,
        maxLife: 0.34,
        gravity: 220,
        drag: 0.96,
        shape: "ember",
        rotation: 0,
        vRot: 0,
      });
    }

    // Soft billowing smoke trail
    if (Math.random() > 0.42) {
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 8,
        y: y + 9,
        vx: -vx * 0.1 + (Math.random() - 0.5) * 32,
        vy: 45 + Math.random() * 45,
        size: 6.5 + Math.random() * 6,
        color: lowFuel ? "#64748B" : "#E2E8F0",
        life: 0.52,
        maxLife: 0.52,
        gravity: -45,
        drag: 0.92,
        shape: "smoke",
        rotation: 0,
        vRot: 0,
      });
    }
  }

  public spawnRocketTrail(x: number, y: number): void {
    this.pushParticle({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      size: 5.5 + Math.random() * 5,
      color: Math.random() > 0.35 ? "#FF9100" : "#E2E8F0",
      life: 0.38,
      maxLife: 0.38,
      gravity: -30,
      drag: 0.92,
      shape: "smoke",
      rotation: 0,
      vRot: 0,
    });
  }

  public spawnMuzzleFlashSparks(x: number, y: number, angle: number): void {
    for (let i = 0; i < 4; i++) {
      const spread = (Math.random() - 0.5) * 0.65;
      const speed = 130 + Math.random() * 190;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        size: 2.5 + Math.random() * 2.5,
        color: i === 0 ? "#FFF933" : "#FDBA74",
        life: 0.14 + Math.random() * 0.08,
        maxLife: 0.22,
        gravity: 160,
        drag: 0.9,
        shape: "shard",
        rotation: angle + spread,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  public spawnShellCasing(
    x: number,
    y: number,
    aimAngle: number,
    color = "#FACC15",
  ): void {
    if (this.casings.length >= this.maxCasings) {
      this.casings.shift();
    }
    const facingLeft = Math.cos(aimAngle) < 0;
    const ejectDir = facingLeft ? 1 : -1;
    this.casings.push({
      x,
      y,
      vx: ejectDir * (65 + Math.random() * 75),
      vy: -(110 + Math.random() * 80),
      rotation: Math.random() * Math.PI * 2,
      vRot: ejectDir * (10 + Math.random() * 14),
      color,
      life: 1.5,
      maxLife: 1.5,
      bounces: 0,
    });
  }

  /**
   * Preserved Bruno Simon-inspired vibrant neon-yellow / orange / crimson cel-shaded
   * metaball explosion, enhanced around the perimeter with lingering smoke clouds & embers.
   */
  public spawnStylizedExplosion(x: number, y: number, radius: number): void {
    const puffs: MetaballPuff[] = [];
    const puffCount = 12;
    for (let i = 0; i < puffCount; i++) {
      const angle = (Math.PI * 2 * i) / puffCount + (Math.random() - 0.5) * 0.4;
      const dist = i === 0 ? 0 : (0.24 + Math.random() * 0.56) * radius;
      puffs.push({
        ox: Math.cos(angle) * dist * 0.25,
        oy: Math.sin(angle) * dist * 0.25,
        vx: Math.cos(angle) * (dist * 1.45),
        vy: Math.sin(angle) * (dist * 1.35) - 35,
        maxRadius: (i === 0 ? 0.58 : 0.28 + Math.random() * 0.26) * radius,
        phaseOffset: Math.random() * 0.14,
      });
    }

    this.explosions.push({
      x,
      y,
      radius,
      age: 0,
      duration: 0.72,
      puffs,
    });

    // Billowing dark-warm smoke puffs rising after the initial flash
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 125;
      this.pushParticle({
        x: x + Math.cos(angle) * radius * 0.22,
        y: y + Math.sin(angle) * radius * 0.22,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 65,
        size: 14 + Math.random() * 14,
        color: i % 2 === 0 ? "#334155" : "#475569",
        life: 0.75 + Math.random() * 0.45,
        maxLife: 1.2,
        gravity: -55,
        drag: 0.93,
        shape: "smoke",
        rotation: 0,
        vRot: 0,
      });
    }

    // Flying flat-shaded ember confetti shards
    const shardColors = ["#FF4D1C", "#FF9E22", "#FFF933", "#3A2230"];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 170 + Math.random() * 440;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 95,
        size: 5 + Math.random() * 6,
        color: shardColors[i % shardColors.length] ?? "#FF6B1A",
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1.0,
        gravity: 480,
        drag: 0.97,
        shape: "shard",
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
      });
    }

    // Rising glowing embers
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 190;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        size: 2.5 + Math.random() * 3,
        color: i % 2 === 0 ? "#FFF933" : "#FB923C",
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        gravity: -28,
        drag: 0.96,
        shape: "ember",
        rotation: 0,
        vRot: 0,
      });
    }
  }

  public spawnImpactSparks(
    x: number,
    y: number,
    color: string,
    count = 7,
    nx = 0,
    ny = -1,
  ): void {
    const baseAngle = Math.atan2(ny, nx);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * 1.9;
      const speed = 95 + Math.random() * 235;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 2.8 + Math.random() * 3.5,
        color: i % 3 === 0 ? "#FFFFFF" : color,
        life: 0.24 + Math.random() * 0.2,
        maxLife: 0.44,
        gravity: 540,
        drag: 0.94,
        shape: "shard",
        rotation: angle,
        vRot: (Math.random() - 0.5) * 14,
      });
    }

    // Small impact dust puff
    this.pushParticle({
      x,
      y,
      vx: nx * 35 + (Math.random() - 0.5) * 30,
      vy: ny * 35 - 20,
      size: 7 + Math.random() * 5,
      color: "#E7E5E4",
      life: 0.34,
      maxLife: 0.34,
      gravity: -25,
      drag: 0.9,
      shape: "smoke",
      rotation: 0,
      vRot: 0,
    });
  }

  /**
   * Overhauled satisfying destruction burst: material-accurate tumbling planks/rock chunks,
   * flying sharp splinters, jungle moss leaves, and an expanding dust cloud.
   */
  public spawnTerrainBreak(
    x: number,
    y: number,
    material: TerrainMaterial,
    width = 68,
    height = 64,
  ): void {
    const style = MATERIAL_STYLES[material];
    const halfW = width * 0.45;
    const halfH = height * 0.45;

    // 1. Expanding dust cloud puffs at the break site
    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 95;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * halfW,
        y: y + (Math.random() - 0.5) * halfH,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: 11 + Math.random() * 12,
        color: style.dust,
        life: 0.55 + Math.random() * 0.35,
        maxLife: 0.9,
        gravity: -30,
        drag: 0.91,
        shape: "smoke",
        rotation: 0,
        vRot: 0,
      });
    }

    // 2. Heavy physical debris chunks that arc, spin, bounce, and splash in water
    const chunkCount = material === "wood" ? 11 : material === "rock" ? 10 : 9;
    for (let i = 0; i < chunkCount; i++) {
      const angle = -Math.PI * (0.1 + Math.random() * 0.8);
      const speed = 150 + Math.random() * 300;
      const isPlank = style.chunkKind === "wood_plank";
      const isMoss =
        material === "rock" && i >= chunkCount - 3
          ? true
          : style.chunkKind === "moss_clump";

      this.pushDebris({
        x: x + (Math.random() - 0.5) * width * 0.7,
        y: y + (Math.random() - 0.5) * height * 0.7,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 120,
        vy: Math.sin(angle) * speed - 85,
        w: isPlank ? 18 + Math.random() * 16 : 11 + Math.random() * 13,
        h: isPlank ? 5 + Math.random() * 4 : 9 + Math.random() * 11,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 16,
        color: isMoss
          ? "#22C55E"
          : i % 3 === 0
            ? style.accent
            : style.main,
        accent: isMoss ? "#86EFAC" : style.accent,
        outline: style.outline,
        life: 1.9 + Math.random() * 1.0,
        maxLife: 2.9,
        kind: isMoss ? "moss_clump" : style.chunkKind,
        bounces: 0,
        inWater: false,
      });
    }

    // 3. Crisp high-velocity splinters / rock chips
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 310;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * halfW,
        y: y + (Math.random() - 0.5) * halfH,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        size: material === "wood" ? 6 + Math.random() * 6 : 3.5 + Math.random() * 4,
        color: i % 2 === 0 ? style.accent : style.main,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity: 660,
        drag: 0.96,
        shape: material === "wood" ? "splinter" : "shard",
        rotation: angle,
        vRot: (Math.random() - 0.5) * 18,
      });
    }

    // 4. Jungle leaf flutter for mossy rocks and wooden crates
    if (material === "rock" || material === "tree" || material === "wood") {
      for (let i = 0; i < 5; i++) {
        this.pushParticle({
          x: x + (Math.random() - 0.5) * width,
          y: y - halfH * 0.5,
          vx: (Math.random() - 0.5) * 140,
          vy: -80 - Math.random() * 90,
          size: 5 + Math.random() * 4,
          color: i % 2 === 0 ? "#4ADE80" : "#22C55E",
          life: 1.1 + Math.random() * 0.6,
          maxLife: 1.7,
          gravity: 110,
          drag: 0.95,
          shape: "leaf",
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 6,
        });
      }
    }
  }

  public spawnWaterSplash(x: number, y: number, intensity = 1): void {
    const count = Math.max(5, Math.round(12 * intensity));
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 1.4;
      const speed = (130 + Math.random() * 220) * Math.min(1.4, intensity);
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 18,
        y: y - 2,
        vx: Math.sin(spread) * speed * 0.7,
        vy: -Math.abs(Math.cos(spread) * speed) - 60,
        size: 3.5 + Math.random() * 4,
        color: i % 3 === 0 ? "#FFFFFF" : "#BAE6FD",
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        gravity: 780,
        drag: 0.97,
        shape: "droplet",
        rotation: 0,
        vRot: 0,
      });
    }

    this.ripples.push({
      x,
      y,
      radius: 8,
      maxRadius: 48 * Math.max(0.6, intensity),
      life: 0.55,
      maxLife: 0.55,
    });
  }

  public spawnLandingDust(x: number, y: number, intensity = 1): void {
    const count = Math.max(4, Math.round(6 * intensity));
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.pushParticle({
        x: x + (Math.random() - 0.5) * 14,
        y: y - 2,
        vx: dir * (40 + Math.random() * 85 * intensity),
        vy: -25 - Math.random() * 40,
        size: 5 + Math.random() * 5,
        color: i % 3 === 0 ? "#86EFAC" : "#D6D3D1",
        life: 0.34 + Math.random() * 0.16,
        maxLife: 0.5,
        gravity: -15,
        drag: 0.89,
        shape: "smoke",
        rotation: 0,
        vRot: 0,
      });
    }
  }

  public spawnRespawnBurst(x: number, y: number, accentColor: string): void {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 110 + Math.random() * 140;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 3,
        color: i % 2 === 0 ? "#FFFFFF" : accentColor,
        life: 0.48 + Math.random() * 0.2,
        maxLife: 0.68,
        gravity: -40,
        drag: 0.92,
        shape: "circle",
        rotation: 0,
        vRot: 0,
      });
    }
  }

  public spawnPickupBurst(x: number, y: number, color = "#4ADE80"): void {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 75 + Math.random() * 120;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        size: 3.5 + Math.random() * 3,
        color: i % 2 === 0 ? "#FFF933" : color,
        life: 0.42,
        maxLife: 0.42,
        gravity: 90,
        drag: 0.93,
        shape: "ember",
        rotation: 0,
        vRot: 0,
      });
    }
  }

  public spawnMeleeArc(x: number, y: number, angle: number): void {
    this.meleeSlashes.push({
      x,
      y,
      angle,
      life: 0.18,
      maxLife: 0.18,
    });
  }

  /** Breaks an eliminated chibi soldier into expressive cartoon pieces that bounce & dissolve. */
  public spawnSoldierDisintegration(
    x: number,
    y: number,
    suitPrimary: string,
    suitSecondary: string,
    headgearColor: string,
    sashColor: string,
    impulseX: number,
    impulseY: number,
  ): void {
    const pieces: Array<{
      kind: DebrisKind;
      w: number;
      h: number;
      ox: number;
      oy: number;
      c: string;
      a: string;
    }> = [
      {
        kind: "ragdoll_head",
        w: 22,
        h: 22,
        ox: 0,
        oy: -16,
        c: headgearColor,
        a: sashColor,
      },
      {
        kind: "ragdoll_torso",
        w: 20,
        h: 20,
        ox: 0,
        oy: 2,
        c: suitPrimary,
        a: sashColor,
      },
      {
        kind: "ragdoll_pack",
        w: 12,
        h: 18,
        ox: -12,
        oy: 0,
        c: suitSecondary,
        a: "#FF6B1A",
      },
      {
        kind: "ragdoll_limb",
        w: 8,
        h: 14,
        ox: -7,
        oy: 15,
        c: suitSecondary,
        a: suitPrimary,
      },
      {
        kind: "ragdoll_limb",
        w: 8,
        h: 14,
        ox: 7,
        oy: 15,
        c: suitSecondary,
        a: suitPrimary,
      },
      {
        kind: "ragdoll_weapon",
        w: 24,
        h: 7,
        ox: 14,
        oy: 2,
        c: "#334155",
        a: "#94A3B8",
      },
    ];

    for (const piece of pieces) {
      this.pushDebris({
        x: x + piece.ox,
        y: y + piece.oy,
        vx: impulseX * 0.55 + (Math.random() - 0.5) * 320,
        vy: impulseY * 0.5 - 170 - Math.random() * 190,
        w: piece.w,
        h: piece.h,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 16,
        color: piece.c,
        accent: piece.a,
        outline: "#0F172A",
        life: 2.2 + Math.random() * 0.7,
        maxLife: 2.9,
        kind: piece.kind,
        bounces: 0,
        inWater: false,
      });
    }

    this.spawnImpactSparks(x, y, "#FFF933", 12);
    this.spawnImpactSparks(x, y, sashColor, 10);
  }

  public spawnDamagePopup(
    x: number,
    y: number,
    damage: number,
    isCrit = false,
  ): void {
    if (this.popups.length >= 32) {
      this.popups.shift();
    }
    this.popups.push({
      x: x + (Math.random() - 0.5) * 18,
      y: y - 34,
      vy: isCrit ? -85 : -64,
      text: `-${Math.round(damage)}`,
      color: isCrit || damage >= 42 ? "#FFF933" : "#FB7185",
      life: 0.78,
      maxLife: 0.78,
      scale: isCrit || damage >= 42 ? 1.2 : 1,
    });
  }

  public update(dt: number, map: MapDefinition): void {
    // 1. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.shape === "leaf") {
        p.vx += Math.sin(p.life * 9 + p.rotation) * 120 * dt;
      }
      const dragPow = Math.pow(p.drag, dt * 60);
      p.vx *= dragPow;
      p.vy *= dragPow;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
    }

    // 2. Stylized explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      if (!ex) continue;
      ex.age += dt;
      if (ex.age >= ex.duration) {
        this.explosions.splice(i, 1);
      }
    }

    // 3. Physical debris & ragdoll pieces
    const floorY = map.height - 44;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      if (!d) continue;
      d.life -= dt;
      if (d.life <= 0) {
        this.pushParticle({
          x: d.x,
          y: d.y,
          vx: (Math.random() - 0.5) * 35,
          vy: -35 - Math.random() * 45,
          size: 4,
          color: d.accent,
          life: 0.32,
          maxLife: 0.32,
          gravity: -50,
          drag: 0.93,
          shape: "circle",
          rotation: 0,
          vRot: 0,
        });
        this.debris.splice(i, 1);
        continue;
      }

      if (!d.inWater && d.y >= map.waterSurfaceY) {
        d.inWater = true;
        d.vy *= 0.35;
        d.vx *= 0.55;
        if (Math.abs(d.vy) > 40) {
          this.spawnWaterSplash(d.x, map.waterSurfaceY, 0.45);
        }
      }

      const grav = d.inWater ? GRAVITY * 0.22 : GRAVITY * 0.94;
      d.vy += grav * dt;
      if (d.inWater) {
        d.vx *= Math.pow(0.35, dt);
        d.vy *= Math.pow(0.4, dt);
      }

      const prevY = d.y;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rotation += d.vRot * dt;

      if (d.y > floorY) {
        d.y = floorY;
        d.vy = -d.vy * 0.38;
        d.vx *= 0.7;
        d.vRot *= 0.68;
      } else if (d.vy > 0) {
        for (const rect of map.platforms) {
          if (rect.style === "bounds") continue;
          if (
            d.x > rect.x &&
            d.x < rect.x + rect.width &&
            prevY + d.h * 0.5 <= rect.y + 14 &&
            d.y + d.h * 0.5 >= rect.y
          ) {
            d.y = rect.y - d.h * 0.5;
            d.vy = -d.vy * 0.42;
            d.vx *= 0.74;
            d.vRot *= 0.7;
            d.bounces += 1;
            break;
          }
        }
      }
    }

    // 4. Ejected shell casings
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      if (!c) continue;
      c.life -= dt;
      if (c.life <= 0) {
        this.casings.splice(i, 1);
        continue;
      }
      c.vy += GRAVITY * 0.85 * dt;
      const prevY = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.vRot * dt;

      if (c.vy > 0 && c.bounces < 3) {
        for (const rect of map.platforms) {
          if (rect.style === "bounds") continue;
          if (
            c.x > rect.x &&
            c.x < rect.x + rect.width &&
            prevY <= rect.y + 8 &&
            c.y >= rect.y
          ) {
            c.y = rect.y - 1;
            c.vy = -c.vy * 0.48;
            c.vx *= 0.68;
            c.vRot *= 0.65;
            c.bounces += 1;
            break;
          }
        }
      }
    }

    // 5. Water surface ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      if (!r) continue;
      r.life -= dt;
      if (r.life <= 0) {
        this.ripples.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.radius = 8 + (r.maxRadius - 8) * progress;
    }

    // 6. Melee slash arcs
    for (let i = this.meleeSlashes.length - 1; i >= 0; i--) {
      const m = this.meleeSlashes[i];
      if (!m) continue;
      m.life -= dt;
      if (m.life <= 0) {
        this.meleeSlashes.splice(i, 1);
      }
    }

    // 7. Damage popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      if (!pop) continue;
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      pop.y += pop.vy * dt;
      pop.vy *= Math.pow(0.25, dt);
    }
  }
}
