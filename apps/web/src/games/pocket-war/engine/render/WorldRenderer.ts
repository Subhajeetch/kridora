import { POCKET_WAR_LIMITS } from "@kridora/shared/games/pocket-war";
import {
  getPickupIconPath,
  pocketWarAssets,
} from "../../assets/AssetLoader";
import type {
  DebugOverlayOptions,
  DestructibleBlockState,
  MapDefinition,
  PickupPadState,
  PlatformRect,
} from "../../types";
import type { WaterRipple } from "../ParticleSystem";

interface AmbientCloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
}

interface AmbientBird {
  x: number;
  y: number;
  speed: number;
  flapOffset: number;
  scale: number;
}

interface PollenMote {
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
}

const OUTLINE = "#1C1917";

export class WorldRenderer {
  private readonly clouds: AmbientCloud[];
  private readonly birds: AmbientBird[];
  private readonly motes: PollenMote[];

  constructor() {
    this.clouds = [
      { x: 180, y: 110, scale: 1.15, speed: 9, alpha: 0.78 },
      { x: 640, y: 78, scale: 0.9, speed: 6.5, alpha: 0.65 },
      { x: 1180, y: 135, scale: 1.35, speed: 8, alpha: 0.72 },
      { x: 1720, y: 92, scale: 1.0, speed: 10.5, alpha: 0.68 },
      { x: 2240, y: 145, scale: 1.25, speed: 7, alpha: 0.74 },
    ];

    this.birds = [
      { x: 320, y: 180, speed: 46, flapOffset: 0.2, scale: 0.9 },
      { x: 365, y: 196, speed: 44, flapOffset: 1.3, scale: 0.75 },
      { x: 1480, y: 140, speed: 54, flapOffset: 2.1, scale: 0.85 },
      { x: 1525, y: 154, speed: 52, flapOffset: 3.4, scale: 0.7 },
    ];

    this.motes = [];
    for (let i = 0; i < 36; i++) {
      this.motes.push({
        x: ((i * 397) % 3500) + 50,
        y: ((i * 223) % 1280) + 120,
        radius: 1.6 + (i % 3) * 0.9,
        driftX: 8 + (i % 5) * 3,
        driftY: -4 - (i % 4) * 2,
        phase: i * 0.85,
      });
    }
  }

  /**
   * Draws screen-space parallax sky, misty mountains, distant jungle canopy,
   * sun shafts, clouds, and soaring birds before entering world-camera space.
   */
  public drawBackgroundLayers(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
    map: MapDefinition,
    timeSec: number,
  ): void {
    // --- LAYER 0: Sky + Sun + Clouds (parallax 0.05) ---
    const skyImg = pocketWarAssets.getLoadedImage(map.assets.sky);
    if (skyImg) {
      this.drawParallaxCover(ctx, skyImg, viewW, viewH, camX, camY, 0.05);
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, viewH);
      skyGrad.addColorStop(0, map.skyTop);
      skyGrad.addColorStop(0.62, "#BAE6FD");
      skyGrad.addColorStop(1, map.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, viewW, viewH);

      // Warm glowing tropical sun
      const sunX = viewW * 0.38 - (camX - map.width * 0.5) * 0.03;
      const sunY = viewH * 0.22 - (camY - map.height * 0.5) * 0.02;
      const sunHalo = ctx.createRadialGradient(
        sunX,
        sunY,
        14,
        sunX,
        sunY,
        155,
      );
      sunHalo.addColorStop(0, "rgba(255, 253, 224, 0.98)");
      sunHalo.addColorStop(0.28, "rgba(254, 240, 138, 0.55)");
      sunHalo.addColorStop(1, "rgba(254, 240, 138, 0)");
      ctx.fillStyle = sunHalo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 155, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#FFFBEB";
      ctx.beginPath();
      ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft drifting cartoon clouds (always rendered subtly for motion)
    this.drawClouds(ctx, viewW, camX, timeSec);

    // Subtle diagonal golden sunlight shafts
    this.drawLightShafts(ctx, viewW, viewH, camX, timeSec);

    // --- LAYER 1: Misty Blue Mountains (parallax 0.18) ---
    const mountainImg = pocketWarAssets.getLoadedImage(map.assets.mountains);
    if (mountainImg) {
      this.drawTiledParallaxLayer(
        ctx,
        mountainImg,
        viewW,
        viewH,
        camX,
        camY,
        0.18,
        0.06,
        viewH * 0.12,
      );
    } else {
      this.drawFallbackMountains(ctx, viewW, viewH, camX, camY);
    }

    // Distant jungle birds gliding across the valley
    this.drawBirds(ctx, viewW, camX, timeSec);

    // --- LAYER 2: Midground Jungle Canopy & Distant Waterfalls (parallax 0.42) ---
    const midImg = pocketWarAssets.getLoadedImage(map.assets.midJungle);
    if (midImg) {
      this.drawTiledParallaxLayer(
        ctx,
        midImg,
        viewW,
        viewH,
        camX,
        camY,
        0.42,
        0.14,
        viewH * 0.16,
      );
    } else {
      this.drawFallbackMidJungle(ctx, viewW, viewH, camX, camY, timeSec);
    }
  }

  /**
   * Draws world-space animated waterfalls, terrain art (AI PNG or cartoon fallback),
   * hanging vines, destructibles, and weapon pickup pads.
   */
  public drawWorldBase(
    ctx: CanvasRenderingContext2D,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
    map: MapDefinition,
    blocks: Record<string, DestructibleBlockState>,
    pickups: Record<string, PickupPadState>,
    timeSec: number,
    nowMs: number,
  ): void {
    // 1. Soft altitude ceiling shimmer warning strip
    if (viewMinY < POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y) {
      const ceilGrad = ctx.createLinearGradient(
        0,
        POCKET_WAR_LIMITS.CEILING_Y,
        0,
        POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y,
      );
      ceilGrad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
      ceilGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = ceilGrad;
      ctx.fillRect(
        48,
        POCKET_WAR_LIMITS.CEILING_Y,
        map.width - 96,
        POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y - POCKET_WAR_LIMITS.CEILING_Y,
      );
    }

    // 2. Animated jungle waterfalls & rising mist behind islands
    for (const wf of map.waterfalls) {
      if (wf.x + wf.width < viewMinX - 80 || wf.x > viewMaxX + 80) continue;
      this.drawWaterfall(ctx, wf.x, wf.topY, wf.bottomY, wf.width, timeSec);
    }

    // 3. Layer 3 Terrain Art (AI asset aligned 1:1 to world coords, or polished cartoon fallback)
    const terrainImg = pocketWarAssets.getLoadedImage(map.assets.terrain);
    if (terrainImg) {
      ctx.drawImage(terrainImg, 0, 0, map.width, map.height);
    } else {
      this.drawBigJungleTree(ctx, 730, 445, timeSec);
      this.drawFallbackPlatforms(
        ctx,
        map,
        viewMinX,
        viewMaxX,
        viewMinY,
        viewMaxY,
        timeSec,
      );
    }

    // 4. Swaying hanging jungle vines (overlayed gently over overhangs)
    for (const vine of map.vines) {
      if (vine.x < viewMinX - 60 || vine.x > viewMaxX + 60) continue;
      this.drawSwayingVine(ctx, vine.x, vine.topY, vine.length, vine.phase, timeSec);
    }

    // 5. Destructible crates, plank barricades, mossy boulders, and barrels
    this.drawDestructibles(
      ctx,
      blocks,
      viewMinX,
      viewMaxX,
      viewMinY,
      viewMaxY,
      timeSec,
    );

    // 6. Floating weapon & supply pickup pads
    this.drawPickups(
      ctx,
      pickups,
      viewMinX,
      viewMaxX,
      viewMinY,
      viewMaxY,
      timeSec,
      nowMs,
    );
  }

  /**
   * Draws the translucent river surface, splash ripples, and ambient floating pollen motes
   * on top of soldiers so wading looks natural.
   */
  public drawWorldWaterOverlay(
    ctx: CanvasRenderingContext2D,
    viewMinX: number,
    viewMaxX: number,
    viewMaxY: number,
    map: MapDefinition,
    ripples: readonly WaterRipple[],
    timeSec: number,
  ): void {
    // Floating golden pollen motes in world space
    ctx.save();
    for (const m of this.motes) {
      const mx = (m.x + timeSec * m.driftX) % map.width;
      const my = m.y + Math.sin(timeSec * 1.4 + m.phase) * 18;
      if (mx < viewMinX - 10 || mx > viewMaxX + 10) continue;
      const alpha = 0.28 + Math.sin(timeSec * 2.2 + m.phase) * 0.16;
      ctx.fillStyle = `rgba(254, 249, 195, ${alpha})`;
      ctx.beginPath();
      ctx.arc(mx, my, m.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (viewMaxY < map.waterSurfaceY - 30) return;

    const startX = Math.max(0, Math.floor(viewMinX / 40) * 40 - 40);
    const endX = Math.min(map.width, Math.ceil(viewMaxX / 40) * 40 + 80);
    const surfY = map.waterSurfaceY;
    const depth = map.height - surfY;

    ctx.save();
    // Translucent river body
    const waterGrad = ctx.createLinearGradient(0, surfY, 0, map.height);
    waterGrad.addColorStop(0, "rgba(56, 189, 248, 0.52)");
    waterGrad.addColorStop(0.35, "rgba(14, 116, 144, 0.68)");
    waterGrad.addColorStop(1, "rgba(12, 74, 110, 0.88)");
    ctx.fillStyle = waterGrad;

    ctx.beginPath();
    ctx.moveTo(startX, map.height);
    for (let x = startX; x <= endX; x += 28) {
      const wave =
        Math.sin(x * 0.025 + timeSec * 3.1) * 3.2 +
        Math.cos(x * 0.06 - timeSec * 2.1) * 1.6;
      ctx.lineTo(x, surfY + wave);
    }
    ctx.lineTo(endX, map.height);
    ctx.closePath();
    ctx.fill();

    // Bright cartoon surface foam ribbon
    ctx.strokeStyle = "rgba(224, 242, 254, 0.9)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += 24) {
      const wave =
        Math.sin(x * 0.025 + timeSec * 3.1) * 3.2 +
        Math.cos(x * 0.06 - timeSec * 2.1) * 1.6;
      if (x === startX) ctx.moveTo(x, surfY + wave);
      else ctx.lineTo(x, surfY + wave);
    }
    ctx.stroke();

    // Subtle shimmer streaks under water
    ctx.fillStyle = "rgba(186, 230, 253, 0.22)";
    for (let x = startX; x <= endX; x += 140) {
      const offset = ((timeSec * 26) % 140) - 70;
      ctx.fillRect(x + offset, surfY + 18, 52, 4);
      ctx.fillRect(x - offset * 0.6 + 35, surfY + Math.min(44, depth * 0.4), 34, 3);
    }

    // Dynamic splash ripples
    for (const r of ripples) {
      const alpha = Math.max(0, r.life / r.maxLife) * 0.85;
      ctx.strokeStyle = `rgba(240, 249, 255, ${alpha})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(r.x, surfY + 2, r.radius, r.radius * 0.24, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Optional screen-space Layer 4 foreground foliage parallax framing (`1.15` factor).
   */
  public drawForegroundParallax(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camX: number,
    map: MapDefinition,
  ): void {
    const fgImg = pocketWarAssets.getLoadedImage(map.assets.foreground);
    if (!fgImg) return;

    const drawH = Math.min(viewH * 0.34, 260);
    const aspect = fgImg.naturalWidth / Math.max(1, fgImg.naturalHeight);
    const drawW = drawH * aspect;
    const offset = -((camX * 1.15) % drawW);

    ctx.save();
    ctx.globalAlpha = 0.82;
    for (let x = offset - drawW; x < viewW + drawW; x += drawW) {
      ctx.drawImage(fgImg, x, viewH - drawH + 14, drawW, drawH);
    }
    ctx.restore();
  }

  /**
   * Collision & spawn alignment debug overlay (`F3` or Pause menu).
   * Helps verify AI terrain art alignment against exact hitboxes.
   */
  public drawCollisionDebug(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    blocks: Record<string, DestructibleBlockState>,
    debug: DebugOverlayOptions,
    viewMinX: number,
    viewMaxX: number,
  ): void {
    ctx.save();

    if (debug.showCollisions) {
      // Static platforms
      for (const p of map.platforms) {
        if (p.x + p.width < viewMinX || p.x > viewMaxX) continue;
        ctx.fillStyle = p.isOneWay
          ? "rgba(250, 204, 21, 0.24)"
          : "rgba(34, 211, 238, 0.22)";
        ctx.strokeStyle = p.isOneWay ? "#FACC15" : "#22D3EE";
        ctx.lineWidth = 2;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.strokeRect(p.x, p.y, p.width, p.height);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 10px monospace";
        ctx.fillText(
          `${p.style ?? "solid"} (${p.x},${p.y}) ${p.width}x${p.height}`,
          p.x + 4,
          p.y + 13,
        );
      }

      // Slopes
      ctx.strokeStyle = "#4ADE80";
      ctx.lineWidth = 4;
      for (const s of map.slopes) {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }

      // Destructible blocks
      for (const b of Object.values(blocks)) {
        if (b.destroyed) continue;
        ctx.fillStyle = "rgba(249, 115, 22, 0.25)";
        ctx.strokeStyle = "#F97316";
        ctx.lineWidth = 2;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
      }

      // Water surface & ceiling soft zone lines
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, map.waterSurfaceY);
      ctx.lineTo(map.width, map.waterSurfaceY);
      ctx.stroke();

      ctx.strokeStyle = "#FB7185";
      ctx.beginPath();
      ctx.moveTo(0, POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y);
      ctx.lineTo(map.width, POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (debug.showSpawns) {
      map.spawnPoints.forEach((sp, idx) => {
        if (sp.x < viewMinX - 40 || sp.x > viewMaxX + 40) return;
        ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
        ctx.strokeStyle = "#34D399";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`S${idx}`, sp.x, sp.y + 4);
      });

      for (const pad of map.pickupPads) {
        if (pad.x < viewMinX - 50 || pad.x > viewMaxX + 50) continue;
        ctx.strokeStyle = "#C084FC";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, POCKET_WAR_LIMITS.PICKUP_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private drawParallaxCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
    factor: number,
  ): void {
    const scale = Math.max(
      (viewW * 1.15) / img.naturalWidth,
      (viewH * 1.15) / img.naturalHeight,
    );
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (viewW - drawW) * 0.5 - (camX - 1800) * factor;
    const dy = (viewH - drawH) * 0.5 - (camY - 800) * factor * 0.5;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  private drawTiledParallaxLayer(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
    factorX: number,
    factorY: number,
    baseY: number,
  ): void {
    const drawH = Math.max(viewH * 0.92, 620);
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const drawW = drawH * aspect;
    const offsetX = -((camX * factorX) % drawW);
    const offsetY = baseY - (camY - 800) * factorY;

    for (let x = offsetX - drawW; x < viewW + drawW; x += drawW) {
      ctx.drawImage(img, x, offsetY, drawW + 1, drawH);
    }
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    camX: number,
    timeSec: number,
  ): void {
    const span = viewW + 420;
    ctx.save();
    for (const c of this.clouds) {
      const rawX = (c.x + timeSec * c.speed - camX * 0.08) % span;
      const x = rawX < -180 ? rawX + span : rawX;
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = "#FFFFFF";
      const s = c.scale;
      ctx.beginPath();
      ctx.arc(x, c.y, 26 * s, 0, Math.PI * 2);
      ctx.arc(x + 26 * s, c.y - 8 * s, 32 * s, 0, Math.PI * 2);
      ctx.arc(x + 58 * s, c.y - 2 * s, 24 * s, 0, Math.PI * 2);
      ctx.arc(x + 28 * s, c.y + 8 * s, 26 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLightShafts(
    ctx: CanvasRenderingContext2D,
    _viewW: number,
    viewH: number,
    camX: number,
    timeSec: number,
  ): void {
    ctx.save();
    const baseShift = -(camX * 0.07) % 420;
    for (let i = -1; i < 5; i++) {
      const x = baseShift + i * 380 + Math.sin(timeSec * 0.4 + i) * 12;
      const grad = ctx.createLinearGradient(x, 0, x + 220, viewH * 0.85);
      grad.addColorStop(0, "rgba(255, 251, 235, 0.14)");
      grad.addColorStop(1, "rgba(255, 251, 235, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 115, 0);
      ctx.lineTo(x + 310, viewH * 0.9);
      ctx.lineTo(x + 165, viewH * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBirds(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    camX: number,
    timeSec: number,
  ): void {
    const span = viewW + 340;
    ctx.save();
    ctx.strokeStyle = "rgba(30, 58, 95, 0.58)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    for (const b of this.birds) {
      const rawX = (b.x + timeSec * b.speed - camX * 0.14) % span;
      const x = rawX < -100 ? rawX + span : rawX;
      const y = b.y + Math.sin(timeSec * 1.8 + b.flapOffset) * 14;
      const wing = Math.sin(timeSec * 9.5 + b.flapOffset) * 5.5 * b.scale;
      const w = 9 * b.scale;

      ctx.beginPath();
      ctx.moveTo(x - w, y + wing);
      ctx.quadraticCurveTo(x - w * 0.4, y - 4 * b.scale, x, y);
      ctx.quadraticCurveTo(x + w * 0.4, y - 4 * b.scale, x + w, y + wing);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFallbackMountains(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
  ): void {
    const shiftFar = -camX * 0.14;
    const shiftMid = -camX * 0.22;
    const yOff = -(camY - 800) * 0.06;

    // Far misty blue peaks
    ctx.fillStyle = "#93C5D8";
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -120; x <= viewW + 240; x += 140) {
      const worldSample = x - shiftFar;
      const h =
        viewH * 0.52 +
        Math.sin(worldSample * 0.0028) * 110 +
        Math.cos(worldSample * 0.0063) * 55;
      ctx.lineTo(x, viewH - h + yOff);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    // Closer dusty teal mountain silhouette
    ctx.fillStyle = "#6CA6B8";
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -120; x <= viewW + 200; x += 110) {
      const worldSample = x - shiftMid;
      const h =
        viewH * 0.4 +
        Math.sin(worldSample * 0.0042 + 1.2) * 85 +
        Math.cos(worldSample * 0.009) * 36;
      ctx.lineTo(x, viewH - h + yOff);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();
  }

  private drawFallbackMidJungle(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camX: number,
    camY: number,
    timeSec: number,
  ): void {
    const shift = -camX * 0.36;
    const yOff = -(camY - 800) * 0.12;

    // Misty distant jungle canopy hills
    ctx.fillStyle = "#4D8B86";
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = -80; x <= viewW + 140; x += 65) {
      const sample = x - shift;
      const bump =
        viewH * 0.28 +
        Math.sin(sample * 0.006) * 58 +
        Math.abs(Math.sin(sample * 0.025)) * 26;
      ctx.lineTo(x, viewH - bump + yOff);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    // Soft atmospheric valley mist at bottom
    const mistGrad = ctx.createLinearGradient(0, viewH * 0.65, 0, viewH);
    mistGrad.addColorStop(0, "rgba(224, 242, 254, 0)");
    mistGrad.addColorStop(
      1,
      `rgba(224, 242, 254, ${0.32 + Math.sin(timeSec * 0.9) * 0.04})`,
    );
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, viewH * 0.65, viewW, viewH * 0.35);
  }

  private drawWaterfall(
    ctx: CanvasRenderingContext2D,
    x: number,
    topY: number,
    bottomY: number,
    width: number,
    timeSec: number,
  ): void {
    const height = bottomY - topY;
    ctx.save();

    // Translucent turquoise cascade column
    const wfGrad = ctx.createLinearGradient(x, topY, x + width, topY);
    wfGrad.addColorStop(0, "rgba(125, 211, 252, 0.25)");
    wfGrad.addColorStop(0.2, "rgba(186, 230, 253, 0.72)");
    wfGrad.addColorStop(0.5, "rgba(240, 249, 255, 0.82)");
    wfGrad.addColorStop(0.8, "rgba(125, 211, 252, 0.68)");
    wfGrad.addColorStop(1, "rgba(125, 211, 252, 0.22)");
    ctx.fillStyle = wfGrad;
    ctx.fillRect(x, topY, width, height);

    // Animated falling white foam ribbons
    const streakCount = Math.max(4, Math.floor(width / 26));
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    for (let i = 0; i < streakCount; i++) {
      const sx = x + 10 + (i / streakCount) * (width - 20);
      const sw = 5 + (i % 3) * 3;
      const scroll = (timeSec * (240 + (i % 4) * 45) + i * 97) % (height + 160);
      const sy = topY + scroll - 140;
      const clampedTop = Math.max(topY, sy);
      const clampedBottom = Math.min(bottomY, sy + 130);
      if (clampedBottom > clampedTop) {
        ctx.beginPath();
        ctx.roundRect(sx, clampedTop, sw, clampedBottom - clampedTop, 4);
        ctx.fill();
      }
    }

    // Churning white foam & rising mist cloud at waterfall plunge pool
    for (let i = 0; i < 6; i++) {
      const mx = x + (i + 0.5) * (width / 6);
      const pulse = Math.sin(timeSec * 4.2 + i * 1.4) * 6;
      const r = 24 + (i % 3) * 10 + pulse * 0.5;
      ctx.fillStyle = "rgba(240, 249, 255, 0.72)";
      ctx.beginPath();
      ctx.arc(mx, bottomY - 6 + pulse * 0.4, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Draws the iconic top-left gnarly jungle tree from Image 1 when fallback terrain is active. */
  private drawBigJungleTree(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    timeSec: number,
  ): void {
    const sway = Math.sin(timeSec * 1.4) * 4;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;

    // Gnarly curved trunk & branches
    ctx.fillStyle = "#5C4033";
    ctx.beginPath();
    ctx.moveTo(baseX - 38, baseY + 6);
    ctx.quadraticCurveTo(baseX - 18, baseY - 65, baseX + 12, baseY - 125);
    ctx.lineTo(baseX + 86, baseY - 155);
    ctx.lineTo(baseX + 94, baseY - 135);
    ctx.quadraticCurveTo(baseX + 35, baseY - 98, baseX + 32, baseY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lush layered cartoon canopy clouds
    const puffs = [
      { ox: -30, oy: -165, r: 74, c: "#15803D" },
      { ox: 48, oy: -185, r: 84, c: "#16A34A" },
      { ox: 122, oy: -158, r: 68, c: "#15803D" },
      { ox: 16, oy: -206, r: 64, c: "#4ADE80" },
      { ox: 92, oy: -190, r: 58, c: "#22C55E" },
    ];
    for (const puff of puffs) {
      ctx.fillStyle = puff.c;
      ctx.beginPath();
      ctx.arc(baseX + puff.ox + sway, baseY + puff.oy, puff.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawFallbackPlatforms(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
    timeSec: number,
  ): void {
    for (const p of map.platforms) {
      if (p.style === "bounds") continue;
      if (
        p.x + p.width < viewMinX - 40 ||
        p.x > viewMaxX + 40 ||
        p.y + p.height < viewMinY - 40 ||
        p.y > viewMaxY + 40
      ) {
        continue;
      }
      this.drawCartoonPlatform(ctx, p, timeSec);
    }
  }

  private drawCartoonPlatform(
    ctx: CanvasRenderingContext2D,
    p: PlatformRect,
    timeSec: number,
  ): void {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;

    if (p.style === "log_bridge") {
      // Fallen gnarled jungle log bridge
      ctx.fillStyle = "#6B4423";
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 10);
      ctx.fill();
      ctx.stroke();

      // Bark highlight & grain lines
      ctx.fillStyle = "#8B5A2B";
      ctx.fillRect(p.x + 12, p.y + 4, p.width - 24, 7);
      ctx.strokeStyle = "#3E2723";
      ctx.lineWidth = 2;
      for (let gx = p.x + 36; gx < p.x + p.width - 30; gx += 58) {
        ctx.beginPath();
        ctx.moveTo(gx, p.y + 8);
        ctx.lineTo(gx + 26, p.y + 18);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (p.style === "river_rock") {
      // Rounded dark wet river boulder
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.height);
      ctx.quadraticCurveTo(p.x + p.width * 0.12, p.y, p.x + p.width * 0.5, p.y);
      ctx.quadraticCurveTo(
        p.x + p.width * 0.88,
        p.y,
        p.x + p.width,
        p.y + p.height,
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#64748B";
      ctx.beginPath();
      ctx.ellipse(
        p.x + p.width * 0.42,
        p.y + 16,
        p.width * 0.25,
        8,
        -0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
      return;
    }

    // Floating moss island / cliff / rock arch with jagged cartoon stone underbelly
    const isFloating = p.style === "moss_island";
    ctx.fillStyle = p.style === "rock_arch" ? "#4B453F" : "#575049";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + 16);
    ctx.lineTo(p.x + p.width, p.y + 16);
    if (isFloating) {
      // Tapered rocky floating island silhouette matching Image 1
      ctx.lineTo(p.x + p.width - 26, p.y + p.height * 0.62);
      ctx.lineTo(p.x + p.width * 0.66, p.y + p.height);
      ctx.lineTo(p.x + p.width * 0.44, p.y + p.height * 0.84);
      ctx.lineTo(p.x + p.width * 0.24, p.y + p.height * 0.94);
      ctx.lineTo(p.x + 22, p.y + p.height * 0.56);
    } else {
      ctx.lineTo(p.x + p.width, p.y + p.height);
      ctx.lineTo(p.x, p.y + p.height);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner stone facet shading
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.moveTo(p.x + p.width * 0.52, p.y + 22);
    ctx.lineTo(p.x + p.width - 8, p.y + 22);
    ctx.lineTo(p.x + p.width * 0.72, p.y + p.height * 0.82);
    ctx.lineTo(p.x + p.width * 0.46, p.y + p.height * 0.65);
    ctx.closePath();
    ctx.fill();

    // Thick bright green moss cap overhanging the top edge (Image 1 signature)
    const mossDepth = 24;
    ctx.fillStyle = "#22C55E";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y + 4);
    ctx.quadraticCurveTo(p.x + p.width * 0.5, p.y - 5, p.x + p.width + 4, p.y + 4);
    ctx.lineTo(p.x + p.width + 4, p.y + mossDepth);

    const scallops = Math.max(4, Math.floor(p.width / 42));
    for (let i = scallops; i >= 0; i--) {
      const sx = p.x + (i / scallops) * p.width;
      const dip = i % 2 === 0 ? mossDepth + 12 : mossDepth - 3;
      ctx.lineTo(sx, p.y + dip);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sunlit lime highlight band on top of moss
    ctx.fillStyle = "#86EFAC";
    ctx.fillRect(p.x + 8, p.y + 2, p.width - 16, 6);

    // Swaying grass blades along top
    const bladeStep = 34;
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 2.4;
    for (let bx = p.x + 18; bx < p.x + p.width - 18; bx += bladeStep) {
      const sway = Math.sin(timeSec * 2.4 + bx * 0.03) * 3.5;
      ctx.beginPath();
      ctx.moveTo(bx, p.y + 2);
      ctx.lineTo(bx - 4 + sway, p.y - 12);
      ctx.moveTo(bx + 5, p.y + 2);
      ctx.lineTo(bx + 10 + sway, p.y - 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawSwayingVine(
    ctx: CanvasRenderingContext2D,
    topX: number,
    topY: number,
    length: number,
    phase: number,
    timeSec: number,
  ): void {
    const sway = Math.sin(timeSec * 1.9 + phase) * 14;
    const midX = topX + sway * 0.45;
    const midY = topY + length * 0.52;
    const endX = topX + sway;
    const endY = topY + length;

    ctx.save();
    ctx.strokeStyle = "#15803D";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();

    // Cartoon leaves along the vine
    const leafCount = Math.max(3, Math.floor(length / 32));
    for (let i = 1; i <= leafCount; i++) {
      const t = i / (leafCount + 0.5);
      const inv = 1 - t;
      const lx = inv * inv * topX + 2 * inv * t * midX + t * t * endX;
      const ly = inv * inv * topY + 2 * inv * t * midY + t * t * endY;
      const side = i % 2 === 0 ? 1 : -1;

      ctx.fillStyle = i % 2 === 0 ? "#4ADE80" : "#22C55E";
      ctx.strokeStyle = "#14532D";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(
        lx + side * 6,
        ly,
        6.5,
        3.2,
        side * 0.45,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawDestructibles(
    ctx: CanvasRenderingContext2D,
    blocks: Record<string, DestructibleBlockState>,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
    timeSec: number,
  ): void {
    for (const b of Object.values(blocks)) {
      if (b.destroyed) continue;
      if (
        b.x + b.width < viewMinX - 20 ||
        b.x > viewMaxX + 20 ||
        b.y + b.height < viewMinY - 20 ||
        b.y > viewMaxY + 20
      ) {
        continue;
      }

      const damageRatio = 1 - b.hp / Math.max(1, b.maxHp);
      ctx.save();
      ctx.lineJoin = "round";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;

      if (b.material === "wood") {
        // Detailed jungle supply crate / plank barricade
        ctx.fillStyle = "#B45309";
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 4);
        ctx.fill();
        ctx.stroke();

        // Lighter inner panel & diagonal brace
        ctx.fillStyle = "#D97706";
        ctx.fillRect(b.x + 6, b.y + 6, b.width - 12, b.height - 12);
        ctx.strokeStyle = "#78350F";
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 6, b.y + 6, b.width - 12, b.height - 12);
        ctx.beginPath();
        ctx.moveTo(b.x + 6, b.y + 6);
        ctx.lineTo(b.x + b.width - 6, b.y + b.height - 6);
        ctx.stroke();
      } else if (b.material === "barrel") {
        // Red explosive fuel barrel with glowing yellow hazard stripe
        const pulse = damageRatio > 0.3 ? Math.sin(timeSec * 18) * 0.5 + 0.5 : 0;
        ctx.fillStyle = pulse > 0.5 ? "#EF4444" : "#DC2626";
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FACC15";
        ctx.fillRect(b.x + 2, b.y + b.height * 0.34, b.width - 4, 12);
        ctx.fillStyle = "#991B1B";
        ctx.fillRect(b.x + 2, b.y + 6, b.width - 4, 4);
        ctx.fillRect(b.x + 2, b.y + b.height - 10, b.width - 4, 4);
      } else {
        // Brittle mossy boulder
        ctx.fillStyle = "#64615B";
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.width, b.height, 14);
        ctx.fill();
        ctx.stroke();

        // Top green moss tuft
        ctx.fillStyle = "#22C55E";
        ctx.beginPath();
        ctx.roundRect(b.x + 5, b.y + 2, b.width - 10, 11, 5);
        ctx.fill();
      }

      // Dynamic fracture cracks when damaged
      if (damageRatio > 0.15) {
        ctx.strokeStyle = "#18181B";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(b.x + b.width * 0.25, b.y + b.height * 0.18);
        ctx.lineTo(b.x + b.width * 0.52, b.y + b.height * 0.48);
        ctx.lineTo(b.x + b.width * 0.34, b.y + b.height * 0.82);
        if (damageRatio > 0.5) {
          ctx.moveTo(b.x + b.width * 0.52, b.y + b.height * 0.48);
          ctx.lineTo(b.x + b.width * 0.84, b.y + b.height * 0.36);
          ctx.lineTo(b.x + b.width * 0.72, b.y + b.height * 0.85);
        }
        ctx.stroke();

        // Compact damage bar above block
        const ratio = Math.max(0, b.hp / b.maxHp);
        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.fillRect(b.x + 4, b.y - 9, b.width - 8, 5);
        ctx.fillStyle = ratio > 0.4 ? "#FACC15" : "#EF4444";
        ctx.fillRect(b.x + 5, b.y - 8, (b.width - 10) * ratio, 3);
      }

      ctx.restore();
    }
  }

  private drawPickups(
    ctx: CanvasRenderingContext2D,
    pickups: Record<string, PickupPadState>,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
    timeSec: number,
    nowMs: number,
  ): void {
    for (const pad of Object.values(pickups)) {
      if (
        pad.x < viewMinX - 60 ||
        pad.x > viewMaxX + 60 ||
        pad.y < viewMinY - 60 ||
        pad.y > viewMaxY + 60
      ) {
        continue;
      }

      const isReady = nowMs >= pad.availableAt;
      const accent =
        pad.kind === "medkit"
          ? "#22C55E"
          : pad.kind === "grenade_pack"
            ? "#F97316"
            : pad.kind === "weapon_rpg7"
              ? "#EF4444"
              : "#38BDF8";

      ctx.save();
      ctx.translate(pad.x, pad.y);

      // Pedestal glowing ring on ground
      ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 22, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isReady ? accent : "rgba(148, 163, 184, 0.45)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 22, 21, 6, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (!isReady) {
        // Radial respawn progress ring
        const remaining = pad.availableAt - nowMs;
        const pct = Math.max(
          0,
          Math.min(1, 1 - remaining / POCKET_WAR_LIMITS.PICKUP_RESPAWN_MS),
        );
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 14, -Math.PI * 0.5, -Math.PI * 0.5 + pct * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      // Hovering bobbing crate / weapon badge
      const bob = Math.sin(timeSec * 3.8 + pad.x * 0.02) * 5;
      ctx.translate(0, bob);

      // Soft beacon halo
      const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
      halo.addColorStop(0, `${accent}55`);
      halo.addColorStop(1, `${accent}00`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      // Badge disc
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const iconPath = getPickupIconPath(pad.kind);
      const iconImg = iconPath ? pocketWarAssets.getLoadedImage(iconPath) : null;

      if (iconImg) {
        ctx.drawImage(iconImg, -14, -14, 28, 28);
      } else if (pad.kind === "medkit") {
        // White medkit box with bright green cross
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(-10, -8, 20, 16, 3);
        ctx.fill();
        ctx.fillStyle = "#16A34A";
        ctx.fillRect(-2.5, -5.5, 5, 11);
        ctx.fillRect(-5.5, -2.5, 11, 5);
      } else if (pad.kind === "grenade_pack") {
        ctx.fillStyle = "#4D7C0F";
        ctx.strokeStyle = "#F8FAFC";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 2, 7.5, 9.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FACC15";
        ctx.fillRect(-3, -10, 6, 4);
      } else {
        // Crisp stylized gun silhouette fallback
        ctx.fillStyle = "#F8FAFC";
        ctx.fillRect(-11, -3, 22, 5);
        ctx.fillRect(-8, 2, 5, 6);
        ctx.fillStyle = accent;
        ctx.fillRect(6, -2, 6, 3);
      }

      // Label tag underneath
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(15, 23, 42, 0.92)";
      ctx.lineWidth = 3;
      ctx.strokeText(pad.label, 0, -25);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(pad.label, 0, -25);

      ctx.restore();
    }
  }
}
