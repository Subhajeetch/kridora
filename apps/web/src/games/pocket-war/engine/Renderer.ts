import type {
  DebugOverlayOptions,
  DestructibleBlockState,
  MapDefinition,
  PickupPadState,
  RenderPlayerState,
  TrajectoryPoint,
} from "../types";
import type {
  DebrisChunk,
  ParticleSystem,
  StylizedExplosion,
} from "./ParticleSystem";
import type { LocalProjectile } from "./Physics";
import { drawWorldSoldier } from "./render/CharacterRigRenderer";
import { WorldRenderer } from "./render/WorldRenderer";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  trauma: number;
  shakeTime: number;
}

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  viewW: number;
  viewH: number;
  map: MapDefinition;
  blocks: Record<string, DestructibleBlockState>;
  pickups: Record<string, PickupPadState>;
  players: readonly RenderPlayerState[];
  localUserId: string;
  spectateTargetId: string | null;
  projectiles: readonly LocalProjectile[];
  particles: ParticleSystem;
  grenadePreview: readonly TrajectoryPoint[];
  aimWorldX: number;
  aimWorldY: number;
  isScoped: boolean;
  isMobile: boolean;
  debug: DebugOverlayOptions;
  timeSec: number;
  nowMs: number;
  dt: number;
}

export class GameRenderer {
  public camera: CameraState = {
    x: 1600,
    y: 720,
    zoom: 1,
    trauma: 0,
    shakeTime: 0,
  };

  private readonly worldRenderer = new WorldRenderer();
  private damageVignette = 0;

  public addTrauma(amount: number): void {
    this.camera.trauma = Math.min(1, this.camera.trauma + amount);
  }

  public triggerDamageVignette(amount = 0.65): void {
    this.damageVignette = Math.min(1, Math.max(this.damageVignette, amount));
  }

  public screenToWorld(
    screenX: number,
    screenY: number,
    viewW: number,
    viewH: number,
  ): { x: number; y: number } {
    const z = Math.max(0.2, this.camera.zoom);
    return {
      x: (screenX - viewW * 0.5) / z + this.camera.x,
      y: (screenY - viewH * 0.5) / z + this.camera.y,
    };
  }

  public worldToScreen(
    worldX: number,
    worldY: number,
    viewW: number,
    viewH: number,
  ): { x: number; y: number } {
    return {
      x: (worldX - this.camera.x) * this.camera.zoom + viewW * 0.5,
      y: (worldY - this.camera.y) * this.camera.zoom + viewH * 0.5,
    };
  }

  public renderFrame(params: RenderFrameParams): void {
    const {
      ctx,
      viewW,
      viewH,
      map,
      blocks,
      pickups,
      players,
      localUserId,
      spectateTargetId,
      projectiles,
      particles,
      grenadePreview,
      aimWorldX,
      aimWorldY,
      isScoped,
      isMobile,
      debug,
      timeSec,
      nowMs,
      dt,
    } = params;

    // 1. Resolve focus target (local alive soldier, spectated survivor, or first player)
    const focusId = spectateTargetId ?? localUserId;
    const focusPlayer =
      players.find((p) => p.userId === focusId && p.isAlive) ??
      players.find((p) => p.isAlive) ??
      players[0];

    // 2. Smooth zoom transition (mobile scales slightly wider; 5X scope widens tactical view)
    const baseZoom = isMobile
      ? Math.max(0.68, Math.min(0.86, viewW / 1080))
      : Math.max(0.88, Math.min(1.06, viewW / 1380));
    const targetZoom = isScoped ? baseZoom * 0.7 : baseZoom;
    const zoomLerp = 1 - Math.exp(-7.5 * dt);
    this.camera.zoom += (targetZoom - this.camera.zoom) * zoomLerp;

    // 3. Smooth camera follow with directional aim look-ahead
    if (focusPlayer) {
      const lookScale = isScoped ? 1.85 : 1;
      const isLocalFocus = focusPlayer.userId === localUserId;
      let lookaheadX = Math.cos(focusPlayer.aimAngle) * 75 * lookScale;
      let lookaheadY = Math.sin(focusPlayer.aimAngle) * 52 * lookScale;

      if (isLocalFocus && !isMobile) {
        lookaheadX = Math.max(
          -190 * lookScale,
          Math.min(190 * lookScale, (aimWorldX - focusPlayer.x) * 0.22 * lookScale),
        );
        lookaheadY = Math.max(
          -125 * lookScale,
          Math.min(125 * lookScale, (aimWorldY - focusPlayer.y) * 0.18 * lookScale),
        );
      }

      const targetX = focusPlayer.x + lookaheadX;
      const targetY = focusPlayer.y + lookaheadY;
      const smooth = 1 - Math.exp(-7.2 * dt);
      this.camera.x += (targetX - this.camera.x) * smooth;
      this.camera.y += (targetY - this.camera.y) * smooth;
    }

    // Clamp camera safely within map edges for current zoom
    const halfWorldW = (viewW * 0.5) / this.camera.zoom;
    const halfWorldH = (viewH * 0.5) / this.camera.zoom;
    if (halfWorldW * 2 >= map.width) {
      this.camera.x = map.width * 0.5;
    } else {
      this.camera.x = Math.max(
        halfWorldW,
        Math.min(map.width - halfWorldW, this.camera.x),
      );
    }
    if (halfWorldH * 2 >= map.height) {
      this.camera.y = map.height * 0.5;
    } else {
      this.camera.y = Math.max(
        halfWorldH,
        Math.min(map.height - halfWorldH, this.camera.y),
      );
    }

    // 4. Smooth squared-trauma shake decay
    this.camera.trauma = Math.max(0, this.camera.trauma - dt * 1.45);
    this.camera.shakeTime += dt * 44;
    const shakeMag = this.camera.trauma * this.camera.trauma;
    const shakeX = Math.sin(this.camera.shakeTime * 1.31) * 26 * shakeMag;
    const shakeY = Math.cos(this.camera.shakeTime * 1.73) * 22 * shakeMag;
    const shakeRot = Math.sin(this.camera.shakeTime * 0.97) * 0.02 * shakeMag;

    // 5. Screen-space parallax backdrop (Sky, Mountains, Mid-Jungle, Clouds, Birds)
    this.worldRenderer.drawBackgroundLayers(
      ctx,
      viewW,
      viewH,
      this.camera.x,
      this.camera.y,
      map,
      timeSec,
    );

    // Compute visible world frustum for culling
    const pad = 90;
    const viewMinX = this.camera.x - halfWorldW - pad;
    const viewMaxX = this.camera.x + halfWorldW + pad;
    const viewMinY = this.camera.y - halfWorldH - pad;
    const viewMaxY = this.camera.y + halfWorldH + pad;

    // --- ENTER WORLD SPACE ---
    ctx.save();
    ctx.translate(viewW * 0.5 + shakeX, viewH * 0.5 + shakeY);
    if (shakeMag > 0.002) {
      ctx.rotate(shakeRot);
    }
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 6. Waterfalls, terrain platforms/art, hanging vines, destructibles, pickup pads
    this.worldRenderer.drawWorldBase(
      ctx,
      viewMinX,
      viewMaxX,
      viewMinY,
      viewMaxY,
      map,
      blocks,
      pickups,
      timeSec,
      nowMs,
    );

    // 7. Ejected brass shell casings & physical debris/ragdoll chunks
    this.drawShellCasings(ctx, particles, viewMinX, viewMaxX, viewMinY, viewMaxY);
    this.drawDebris(ctx, particles, viewMinX, viewMaxX, viewMinY, viewMaxY);

    // 8. Dashed tactical aim line (matches Image 1 crisp dashed sightline while aiming/flying)
    const localPlayer = players.find(
      (p) => p.userId === localUserId && p.isAlive,
    );
    if (localPlayer) {
      this.drawAimGuide(ctx, localPlayer, isScoped);
    }

    // 9. Parabolic grenade trajectory preview when holding throw
    if (grenadePreview.length > 1) {
      this.drawGrenadePreview(ctx, grenadePreview, timeSec);
    }

    // 10. Living soldiers
    for (const player of players) {
      if (!player.isAlive) continue;
      if (
        player.x < viewMinX - 60 ||
        player.x > viewMaxX + 60 ||
        player.y < viewMinY - 80 ||
        player.y > viewMaxY + 80
      ) {
        continue;
      }
      drawWorldSoldier(
        ctx,
        player,
        player.userId === localUserId,
        timeSec,
        nowMs,
      );
    }

    // 11. Melee slash arcs
    this.drawMeleeSlashes(ctx, particles);

    // 12. Active bullets, pellets, rockets, and bouncing grenades
    this.drawProjectiles(ctx, projectiles, viewMinX, viewMaxX, viewMinY, viewMaxY, timeSec);

    // 13. Translucent river surface, ripples, and floating jungle pollen
    this.worldRenderer.drawWorldWaterOverlay(
      ctx,
      viewMinX,
      viewMaxX,
      viewMaxY,
      map,
      particles.ripples,
      timeSec,
    );

    // 14. Sparks, splinters, smoke puffs, water droplets, embers
    this.drawParticles(ctx, particles, viewMinX, viewMaxX, viewMinY, viewMaxY);

    // 15. Preserved 4-pass Bruno Simon cel-shaded metaball explosions
    for (const ex of particles.explosions) {
      if (
        ex.x + ex.radius * 1.6 < viewMinX ||
        ex.x - ex.radius * 1.6 > viewMaxX ||
        ex.y + ex.radius * 1.6 < viewMinY ||
        ex.y - ex.radius * 1.6 > viewMaxY
      ) {
        continue;
      }
      this.drawStylizedExplosion(ctx, ex);
    }

    // 16. Floating combat damage popups
    for (const pop of particles.popups) {
      const alpha = Math.max(0, pop.life / pop.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(17 * pop.scale)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // 17. Collision & spawn alignment debug overlay (`F3`)
    if (debug.showCollisions || debug.showSpawns) {
      this.worldRenderer.drawCollisionDebug(
        ctx,
        map,
        blocks,
        debug,
        viewMinX,
        viewMaxX,
      );
    }

    // 18. Desktop tactical crosshair
    if (!isMobile && localPlayer && focusPlayer?.userId === localUserId) {
      this.drawCrosshair(ctx, aimWorldX, aimWorldY, isScoped);
    }

    ctx.restore();
    // --- EXIT WORLD SPACE ---

    // 19. Optional Layer 4 foreground foliage parallax
    this.worldRenderer.drawForegroundParallax(ctx, viewW, viewH, this.camera.x, map);

    // 20. Subtle red screen-edge damage vignette when local player takes a hit
    if (this.damageVignette > 0.01) {
      this.damageVignette = Math.max(0, this.damageVignette - dt * 2.2);
      const vig = ctx.createRadialGradient(
        viewW * 0.5,
        viewH * 0.5,
        Math.min(viewW, viewH) * 0.3,
        viewW * 0.5,
        viewH * 0.5,
        Math.max(viewW, viewH) * 0.72,
      );
      vig.addColorStop(0, "rgba(239, 68, 68, 0)");
      vig.addColorStop(1, `rgba(220, 38, 38, ${this.damageVignette * 0.42})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  private drawAimGuide(
    ctx: CanvasRenderingContext2D,
    player: RenderPlayerState,
    isScoped: boolean,
  ): void {
    const startDist = 36;
    const length = isScoped ? 440 : 185;
    const cos = Math.cos(player.aimAngle);
    const sin = Math.sin(player.aimAngle);

    ctx.save();
    ctx.strokeStyle = isScoped
      ? "rgba(255, 255, 255, 0.72)"
      : "rgba(255, 255, 255, 0.48)";
    ctx.lineWidth = isScoped ? 2.4 : 2;
    ctx.setLineDash([12, 12]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(player.x + cos * startDist, player.y - 2 + sin * startDist);
    ctx.lineTo(
      player.x + cos * (startDist + length),
      player.y - 2 + sin * (startDist + length),
    );
    ctx.stroke();
    ctx.restore();
  }

  private drawGrenadePreview(
    ctx: CanvasRenderingContext2D,
    points: readonly TrajectoryPoint[],
    timeSec: number,
  ): void {
    ctx.save();
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (!pt) continue;
      const ratio = 1 - i / points.length;
      const r = 2.6 + ratio * 2.4;
      ctx.fillStyle = `rgba(255, 249, 51, ${0.22 + ratio * 0.72})`;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const end = points[points.length - 1];
    if (end) {
      const pulse = 9 + Math.sin(timeSec * 14) * 2.5;
      ctx.strokeStyle = "rgba(255, 115, 0, 0.85)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(end.x, end.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMeleeSlashes(
    ctx: CanvasRenderingContext2D,
    particles: ParticleSystem,
  ): void {
    for (const slash of particles.meleeSlashes) {
      const t = 1 - slash.life / slash.maxLife;
      const alpha = Math.max(0, 1 - t);
      ctx.save();
      ctx.translate(slash.x, slash.y);
      ctx.rotate(slash.angle);
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 7 * (1 - t * 0.5);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(14, 0, 38 + t * 14, -0.85, 0.85);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(18, 0, 44 + t * 14, -0.7, 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawProjectiles(
    ctx: CanvasRenderingContext2D,
    projectiles: readonly LocalProjectile[],
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
    timeSec: number,
  ): void {
    for (const p of projectiles) {
      if (
        p.x < viewMinX ||
        p.x > viewMaxX ||
        p.y < viewMinY ||
        p.y > viewMaxY
      ) {
        continue;
      }

      ctx.save();
      if (p.kind === "bomb") {
        // Cartoon pineapple frag grenade with blinking danger LED
        const spin = p.age * (p.vx >= 0 ? 9 : -9);
        const urgency = p.age / Math.max(0.1, p.maxAge);
        const pulse = Math.sin(timeSec * (16 + urgency * 26)) > 0;

        ctx.translate(p.x, p.y);
        ctx.rotate(spin);

        ctx.fillStyle = "#3F6212";
        ctx.strokeStyle = "#18181B";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 1, 6.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Spoon & fuse cap
        ctx.fillStyle = "#94A3B8";
        ctx.fillRect(-3, -9, 6, 3.5);
        ctx.strokeRect(-3, -9, 6, 3.5);

        // Blinking warning indicator
        ctx.fillStyle = pulse ? "#FFF933" : "#EF4444";
        ctx.beginPath();
        ctx.arc(0, 1, 2.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "rocket") {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(p.x, p.y);
        ctx.rotate(angle);

        ctx.fillStyle = "#4D7C0F";
        ctx.strokeStyle = "#18181B";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(-10, -4, 18, 8, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FF6B1A";
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(15, 0);
        ctx.lineTo(8, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#FFF933";
        ctx.beginPath();
        ctx.arc(-11, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const tailX = p.x - p.vx * 0.019;
        const tailY = p.y - p.vy * 0.019;
        ctx.strokeStyle = "rgba(15, 23, 42, 0.35)";
        ctx.lineWidth = p.kind === "pellet" ? 4.5 : 5.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.kind === "pellet" ? 2.5 : 3.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.kind === "pellet" ? 1.8 : 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawShellCasings(
    ctx: CanvasRenderingContext2D,
    particles: ParticleSystem,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
  ): void {
    for (const c of particles.casings) {
      if (
        c.x < viewMinX ||
        c.x > viewMaxX ||
        c.y < viewMinY ||
        c.y > viewMaxY
      ) {
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life * 2);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = "#18181B";
      ctx.lineWidth = 1;
      ctx.fillRect(-3, -1.4, 6, 2.8);
      ctx.strokeRect(-3, -1.4, 6, 2.8);
      ctx.restore();
    }
  }

  private drawDebris(
    ctx: CanvasRenderingContext2D,
    particles: ParticleSystem,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
  ): void {
    for (const d of particles.debris) {
      if (
        d.x < viewMinX ||
        d.x > viewMaxX ||
        d.y < viewMinY ||
        d.y > viewMaxY
      ) {
        continue;
      }
      this.drawDebrisChunk(ctx, d);
    }
  }

  private drawDebrisChunk(ctx: CanvasRenderingContext2D, d: DebrisChunk): void {
    const fadeAlpha = d.life < 0.65 ? Math.max(0, d.life / 0.65) : 1;
    const scale = d.life < 0.45 ? 0.45 + (d.life / 0.45) * 0.55 : 1;

    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rotation);
    ctx.scale(scale, scale);
    ctx.strokeStyle = d.outline;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";

    if (d.kind === "ragdoll_head") {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(0, 0, d.w * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.accent;
      ctx.fillRect(-d.w * 0.35, -3, d.w * 0.7, 4);
    } else if (d.kind === "rock_chunk" || d.kind === "mud_clod") {
      const hw = d.w * 0.5;
      const hh = d.h * 0.5;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(-hw, -hh * 0.3);
      ctx.lineTo(-hw * 0.3, -hh);
      ctx.lineTo(hw * 0.7, -hh * 0.7);
      ctx.lineTo(hw, hh * 0.4);
      ctx.lineTo(hw * 0.2, hh);
      ctx.lineTo(-hw * 0.8, hh * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (d.kind === "wood_plank") {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.accent;
      ctx.fillRect(-d.w * 0.42, -d.h * 0.3, d.w * 0.84, 2);
    } else if (d.kind === "moss_clump") {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(-d.w * 0.2, 0, d.h * 0.45, 0, Math.PI * 2);
      ctx.arc(d.w * 0.2, -1, d.h * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect(-d.w * 0.5, -d.h * 0.5, d.w, d.h, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.accent;
      ctx.fillRect(-d.w * 0.45, -d.h * 0.45, d.w * 0.9, 3);
    }

    ctx.restore();
  }

  private drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: ParticleSystem,
    viewMinX: number,
    viewMaxX: number,
    viewMinY: number,
    viewMaxY: number,
  ): void {
    for (const p of particles.particles) {
      if (
        p.x < viewMinX ||
        p.x > viewMaxX ||
        p.y < viewMinY ||
        p.y > viewMaxY
      ) {
        continue;
      }

      const ratio = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = p.shape === "smoke" ? ratio * 0.48 : ratio;
      ctx.fillStyle = p.color;

      if (p.shape === "shard") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7);
      } else if (p.shape === "splinter") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.moveTo(-p.size, 0);
        ctx.lineTo(0, -p.size * 0.28);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size * 0.28);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === "leaf") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "droplet") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.45 + ratio * 0.55), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === "ember") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + ratio * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const radius =
          p.size * (p.shape === "smoke" ? 1.45 - ratio * 0.42 : ratio);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.6, radius), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /**
   * Preserved 4-pass unified metaball silhouette renderer matching Bruno Simon's iconic
   * explosion palette: Crimson outer rim -> Bold tangerine band -> Lemon-yellow core -> Boiling cutouts.
   */
  private drawStylizedExplosion(
    ctx: CanvasRenderingContext2D,
    ex: StylizedExplosion,
  ): void {
    const t = Math.min(1, ex.age / ex.duration);
    const expand = 1 - Math.pow(1 - Math.min(1, t * 2.4), 3);
    const shrink = t > 0.52 ? 1 - (t - 0.52) / 0.48 : 1;

    ctx.save();

    // Soft warm glow halo
    const glowGrad = ctx.createRadialGradient(
      ex.x,
      ex.y,
      10,
      ex.x,
      ex.y,
      ex.radius * 1.55,
    );
    glowGrad.addColorStop(0, `rgba(255, 240, 40, ${0.42 * (1 - t)})`);
    glowGrad.addColorStop(0.55, `rgba(255, 65, 10, ${0.28 * (1 - t)})`);
    glowGrad.addColorStop(1, "rgba(255, 30, 0, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, ex.radius * 1.55, 0, Math.PI * 2);
    ctx.fill();

    // Expanding shockwave ring
    if (t < 0.45) {
      const ringT = t / 0.45;
      ctx.strokeStyle = `rgba(255, 249, 51, ${(1 - ringT) * 0.78})`;
      ctx.lineWidth = 6 * (1 - ringT);
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius * (0.35 + ringT * 1.1), 0, Math.PI * 2);
      ctx.stroke();
    }

    const computed = ex.puffs
      .map((p) => {
        const localT = Math.max(
          0,
          Math.min(1, (t - p.phaseOffset) / (1 - p.phaseOffset)),
        );
        const r = p.maxRadius * expand * shrink * (1 - localT * 0.18);
        return {
          px: ex.x + p.ox + p.vx * expand * 0.55,
          py: ex.y + p.oy + p.vy * expand * 0.55,
          r: Math.max(0, r),
        };
      })
      .filter((c) => c.r > 1.5);

    // Pass 1: Crimson-red outer rim
    ctx.fillStyle = "#FF2200";
    for (const c of computed) {
      ctx.beginPath();
      ctx.arc(c.px, c.py, c.r * 1.14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pass 2: Bold tangerine-orange contour band
    ctx.fillStyle = "#FF7300";
    for (const c of computed) {
      ctx.beginPath();
      ctx.arc(c.px, c.py, c.r * 0.98, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pass 3: Blinding lemon-yellow unified core
    ctx.fillStyle = "#FFF933";
    for (const c of computed) {
      ctx.beginPath();
      ctx.arc(c.px, c.py, c.r * 0.79, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pass 4: Boiling orange cutouts as the blast dissipates
    if (t > 0.22) {
      ctx.fillStyle = "#FF5500";
      for (let i = 0; i < computed.length; i += 2) {
        const c = computed[i];
        if (!c) continue;
        ctx.beginPath();
        ctx.arc(
          c.px + c.r * 0.22,
          c.py - c.r * 0.18,
          c.r * 0.34 * t,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isScoped: boolean,
  ): void {
    const r = isScoped ? 16 : 11;
    const outer = isScoped ? 26 : 18;
    ctx.save();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isScoped ? "#38BDF8" : "#FFF933";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - outer, y);
    ctx.lineTo(x - r + 4, y);
    ctx.moveTo(x + r - 4, y);
    ctx.lineTo(x + outer, y);
    ctx.moveTo(x, y - outer);
    ctx.lineTo(x, y - r + 4);
    ctx.moveTo(x, y + r - 4);
    ctx.lineTo(x, y + outer);
    ctx.stroke();

    ctx.fillStyle = "#EF4444";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
