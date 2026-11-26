import { getPickupIconPath, pocketWarAssets } from "../../assets/AssetLoader";
import type {
  DebugOverlayOptions,
  DestructibleBlockDef,
  MapDefinition,
  PickupPadDef,
  PlatformRect,
  PocketWarPhysicsWorld,
} from "../../types";

export interface WorldRenderCamera {
  x: number;
  y: number;
  zoom: number;
  viewW: number;
  viewH: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

interface CachedParallaxCanvas {
  img: HTMLImageElement;
  w: number;
  h: number;
  canvas: HTMLCanvasElement;
}

function drawParallaxLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cam: WorldRenderCamera,
  map: MapDefinition,
  factorX: number,
  factorY: number,
  alpha = 1,
  cache?: Map<string, CachedParallaxCanvas>,
  cacheKey?: string,
): void {
  const scale = Math.max(
    cam.viewW / img.naturalWidth,
    cam.viewH / img.naturalHeight,
    1.08,
  );
  const drawW = Math.max(1, Math.round(img.naturalWidth * scale));
  const drawH = Math.max(1, Math.round(img.naturalHeight * scale));

  let source: HTMLImageElement | HTMLCanvasElement = img;
  if (cache && cacheKey && typeof document !== "undefined") {
    const hit = cache.get(cacheKey);
    if (hit && hit.img === img && hit.w === drawW && hit.h === drawH) {
      source = hit.canvas;
    } else {
      const c = document.createElement("canvas");
      c.width = drawW;
      c.height = drawH;
      const cctx = c.getContext("2d");
      if (cctx) {
        cctx.drawImage(img, 0, 0, drawW, drawH);
        cache.set(cacheKey, { img, w: drawW, h: drawH, canvas: c });
        source = c;
      }
    }
  }

  const normX = Math.max(0, Math.min(1, cam.x / Math.max(1, map.width)));
  const normY = Math.max(0, Math.min(1, cam.y / Math.max(1, map.height)));

  const overflowX = Math.max(0, drawW - cam.viewW);
  const overflowY = Math.max(0, drawH - cam.viewH);

  const scrollX = -(
    normX * overflowX +
    (cam.x - map.width * 0.5) * factorX * 0.12
  );
  const wrappedX = (((scrollX % drawW) + drawW) % drawW) - drawW;
  const drawY = Math.round(-normY * overflowY * factorY);

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let x = Math.round(wrappedX); x < cam.viewW + 4; x += drawW - 2) {
    ctx.drawImage(source, x, drawY);
  }
  ctx.restore();
}

/**
 * Renders the 4-layer Emerald Falls jungle environment with pre-baked terrain/backdrop
 * caches, viewport-culled animated waterfalls/vines/river, destructibles, pickups, and F3 debug chains.
 */
export class WorldArtworkRenderer {
  private parallaxCache = new Map<string, CachedParallaxCanvas>();
  private terrainCache: {
    mapId: string;
    hasTerrainImg: boolean;
    canvas: HTMLCanvasElement;
  } | null = null;

  public drawBackdrop(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    cam: WorldRenderCamera,
    timeSec: number,
  ): void {
    const skyImg = pocketWarAssets.getLoadedImage(map.assets.sky);
    if (skyImg) {
      drawParallaxLayer(
        ctx,
        skyImg,
        cam,
        map,
        0.04,
        0.15,
        1,
        this.parallaxCache,
        "sky",
      );
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, cam.viewH);
      skyGrad.addColorStop(0, map.skyTop);
      skyGrad.addColorStop(0.7, map.skyBottom);
      skyGrad.addColorStop(1, "#BCE8FA");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    }

    const sunX = cam.viewW * 0.42 - (cam.x / map.width) * 90;
    const sunY = cam.viewH * 0.22;
    const sunHalo = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, 160);
    sunHalo.addColorStop(0, "rgba(255, 253, 224, 0.92)");
    sunHalo.addColorStop(0.28, "rgba(255, 248, 196, 0.42)");
    sunHalo.addColorStop(1, "rgba(255, 248, 196, 0)");
    ctx.fillStyle = sunHalo;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

    const mtnImg = pocketWarAssets.getLoadedImage(map.assets.mountains);
    if (mtnImg) {
      drawParallaxLayer(
        ctx,
        mtnImg,
        cam,
        map,
        0.18,
        0.3,
        0.95,
        this.parallaxCache,
        "mountains",
      );
    } else {
      this.drawProceduralMountains(ctx, cam);
    }

    const midImg = pocketWarAssets.getLoadedImage(map.assets.midJungle);
    if (midImg) {
      drawParallaxLayer(
        ctx,
        midImg,
        cam,
        map,
        0.42,
        0.48,
        0.96,
        this.parallaxCache,
        "midJungle",
      );
    } else {
      this.drawProceduralMidJungle(ctx, cam, timeSec);
    }
  }

  private drawProceduralMountains(
    ctx: CanvasRenderingContext2D,
    cam: WorldRenderCamera,
  ): void {
    const offset = -(cam.x * 0.14) % 720;
    ctx.save();
    ctx.fillStyle = "rgba(92, 146, 166, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, cam.viewH);
    for (let x = offset - 720; x < cam.viewW + 720; x += 240) {
      ctx.lineTo(x + 110, cam.viewH * 0.38);
      ctx.lineTo(x + 240, cam.viewH * 0.64);
    }
    ctx.lineTo(cam.viewW, cam.viewH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawProceduralMidJungle(
    ctx: CanvasRenderingContext2D,
    cam: WorldRenderCamera,
    timeSec: number,
  ): void {
    const offset = -(cam.x * 0.32) % 480;
    ctx.save();
    ctx.fillStyle = "rgba(45, 114, 96, 0.55)";
    ctx.beginPath();
    ctx.moveTo(0, cam.viewH);
    for (let x = offset - 480; x < cam.viewW + 480; x += 160) {
      const sway = Math.sin(timeSec * 0.7 + x * 0.01) * 4;
      ctx.quadraticCurveTo(
        x + 80,
        cam.viewH * 0.54 + sway,
        x + 160,
        cam.viewH * 0.7,
      );
    }
    ctx.lineTo(cam.viewW, cam.viewH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private getOrBakeTerrainCanvas(map: MapDefinition): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null;
    const terrainImg = pocketWarAssets.getLoadedImage(map.assets.terrain);
    const hasTerrainImg = Boolean(terrainImg);

    if (
      this.terrainCache &&
      this.terrainCache.mapId === map.id &&
      this.terrainCache.hasTerrainImg === hasTerrainImg
    ) {
      return this.terrainCache.canvas;
    }

    const canvas = document.createElement("canvas");
    canvas.width = map.width;
    canvas.height = map.height;
    const tctx = canvas.getContext("2d");
    if (!tctx) return null;

    if (terrainImg) {
      tctx.drawImage(terrainImg, 0, 0, map.width, map.height);
    } else {
      for (const plat of map.platforms) {
        if (plat.style === "bounds") continue;
        this.drawProceduralPlatform(tctx, plat);
      }
      for (const slope of map.slopes) {
        tctx.save();
        tctx.strokeStyle = "#4D7C0F";
        tctx.lineWidth = 10;
        tctx.lineCap = "round";
        tctx.beginPath();
        tctx.moveTo(slope.x1, slope.y1);
        tctx.lineTo(slope.x2, slope.y2);
        tctx.stroke();

        tctx.strokeStyle = "#84CC16";
        tctx.lineWidth = 4;
        tctx.beginPath();
        tctx.moveTo(slope.x1, slope.y1 - 3);
        tctx.lineTo(slope.x2, slope.y2 - 3);
        tctx.stroke();
        tctx.restore();
      }
    }

    this.terrainCache = { mapId: map.id, hasTerrainImg, canvas };
    return canvas;
  }

  public drawWorldGeometry(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    cam: WorldRenderCamera,
    destroyedBlockIds: ReadonlySet<string>,
    pickupCooldownUntil: ReadonlyMap<string, number>,
    timeSec: number,
    nowEpoch: number,
  ): void {
    const halfW = (cam.viewW * 0.5) / Math.max(0.25, cam.zoom) + 96;
    const halfH = (cam.viewH * 0.5) / Math.max(0.25, cam.zoom) + 96;
    const viewLeft = cam.x - halfW;
    const viewRight = cam.x + halfW;
    const viewTop = cam.y - halfH;
    const viewBottom = cam.y + halfH;

    const baked = this.getOrBakeTerrainCanvas(map);
    if (baked) {
      const sx = Math.max(0, Math.floor(viewLeft));
      const sy = Math.max(0, Math.floor(viewTop));
      const ex = Math.min(map.width, Math.ceil(viewRight));
      const ey = Math.min(map.height, Math.ceil(viewBottom));
      const sw = ex - sx;
      const sh = ey - sy;
      if (sw > 0 && sh > 0) {
        ctx.drawImage(baked, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    }

    this.drawVines(ctx, map, timeSec, viewLeft, viewRight);

    for (const block of map.destructibles) {
      if (destroyedBlockIds.has(block.id)) continue;
      if (block.x + block.width < viewLeft || block.x > viewRight) continue;
      if (block.y + block.height < viewTop || block.y > viewBottom) continue;
      this.drawDestructibleBlock(ctx, block, timeSec);
    }

    for (const pad of map.pickupPads) {
      if (pad.x + 60 < viewLeft || pad.x - 60 > viewRight) continue;
      if (pad.y + 60 < viewTop || pad.y - 60 > viewBottom) continue;
      const cdUntil = pickupCooldownUntil.get(pad.id) ?? 0;
      const msLeft = Math.max(0, cdUntil - nowEpoch);
      this.drawPickupPad(ctx, pad, msLeft, timeSec);
    }
  }

  public drawWaterSurface(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    timeSec: number,
  ): void {
    const wy = map.waterSurfaceY;
    const h = map.height - wy;

    ctx.save();
    const grad = ctx.createLinearGradient(0, wy, 0, map.height);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.56)");
    grad.addColorStop(0.35, "rgba(14, 165, 233, 0.74)");
    grad.addColorStop(1, "rgba(7, 89, 133, 0.92)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, wy, map.width, h);

    ctx.strokeStyle = "rgba(224, 242, 254, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= map.width; x += 64) {
      const waveY = wy + Math.sin(x * 0.022 + timeSec * 3.4) * 3.5;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    for (let x = 80; x < map.width; x += 210) {
      const sx = x + Math.sin(timeSec * 1.8 + x) * 18;
      ctx.fillRect(sx, wy + 18, 65, 4);
      ctx.fillRect(sx + 38, wy + 44, 42, 3);
    }
    ctx.restore();
  }

  private drawProceduralPlatform(
    ctx: CanvasRenderingContext2D,
    plat: PlatformRect,
  ): void {
    ctx.save();

    if (plat.style === "log_bridge") {
      const logGrad = ctx.createLinearGradient(
        0,
        plat.y,
        0,
        plat.y + plat.height,
      );
      logGrad.addColorStop(0, "#92400E");
      logGrad.addColorStop(0.5, "#78350F");
      logGrad.addColorStop(1, "#451A03");
      ctx.fillStyle = logGrad;
      drawRoundedRect(ctx, plat.x, plat.y, plat.width, plat.height + 6, 12);
      ctx.fill();
      ctx.strokeStyle = "#1C1917";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.strokeStyle = "rgba(28, 25, 23, 0.45)";
      ctx.lineWidth = 2;
      for (let x = plat.x + 28; x < plat.x + plat.width - 28; x += 62) {
        ctx.beginPath();
        ctx.moveTo(x, plat.y + 8);
        ctx.lineTo(x + 34, plat.y + 16);
        ctx.stroke();
      }
      ctx.fillStyle = "#65A30D";
      for (let x = plat.x + 20; x < plat.x + plat.width - 40; x += 95) {
        drawRoundedRect(ctx, x, plat.y - 3, 44, 8, 4);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (plat.style === "river_rock") {
      ctx.fillStyle = "#57534E";
      drawRoundedRect(ctx, plat.x, plat.y, plat.width, plat.height, 26);
      ctx.fill();
      ctx.strokeStyle = "#1C1917";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#78716C";
      drawRoundedRect(
        ctx,
        plat.x + 8,
        plat.y + 6,
        plat.width - 16,
        plat.height * 0.35,
        14,
      );
      ctx.fill();
      ctx.restore();
      return;
    }

    const isArch = plat.style === "rock_arch";
    const rockGrad = ctx.createLinearGradient(
      0,
      plat.y,
      0,
      plat.y + plat.height,
    );
    rockGrad.addColorStop(0, isArch ? "#64748B" : "#6B5B4D");
    rockGrad.addColorStop(0.55, isArch ? "#475569" : "#4A3F35");
    rockGrad.addColorStop(1, isArch ? "#1E293B" : "#29231E");

    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(plat.x, plat.y + 12);
    ctx.lineTo(plat.x + plat.width, plat.y + 12);
    ctx.lineTo(plat.x + plat.width - 8, plat.y + plat.height * 0.72);
    const notches = Math.max(3, Math.floor(plat.width / 88));
    for (let i = notches; i >= 0; i--) {
      const nx = plat.x + (plat.width * i) / notches;
      const ny =
        i % 2 === 0
          ? plat.y + plat.height
          : plat.y + plat.height - Math.min(28, plat.height * 0.22);
      ctx.lineTo(nx, ny);
    }
    ctx.lineTo(plat.x + 8, plat.y + plat.height * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#1C1917";
    ctx.lineWidth = 3.2;
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(
      plat.x + 14,
      plat.y + 28,
      Math.max(10, plat.width - 28),
      Math.max(8, plat.height * 0.26),
    );

    const mossGrad = ctx.createLinearGradient(0, plat.y - 6, 0, plat.y + 24);
    mossGrad.addColorStop(0, "#84CC16");
    mossGrad.addColorStop(0.55, "#4D7C0F");
    mossGrad.addColorStop(1, "#365314");

    ctx.fillStyle = mossGrad;
    drawRoundedRect(ctx, plat.x - 4, plat.y - 4, plat.width + 8, 22, 10);
    ctx.fill();
    ctx.strokeStyle = "#14532D";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.fillStyle = "#A3E635";
    for (let gx = plat.x + 16; gx < plat.x + plat.width - 18; gx += 36) {
      ctx.beginPath();
      ctx.moveTo(gx, plat.y - 2);
      ctx.lineTo(gx + 6, plat.y - 12);
      ctx.lineTo(gx + 13, plat.y - 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawVines(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    timeSec: number,
    viewLeft: number,
    viewRight: number,
  ): void {
    ctx.save();
    for (const v of map.vines) {
      if (v.x + 28 < viewLeft || v.x - 28 > viewRight) continue;
      const sway = Math.sin(timeSec * 1.65 + v.phase) * 14;
      ctx.strokeStyle = "#365314";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(v.x, v.topY);
      ctx.quadraticCurveTo(
        v.x + sway * 0.5,
        v.topY + v.length * 0.55,
        v.x + sway,
        v.topY + v.length,
      );
      ctx.stroke();

      ctx.fillStyle = "#65A30D";
      for (let t = 0.25; t <= 0.9; t += 0.25) {
        const lx = v.x + sway * t * t;
        const ly = v.topY + v.length * t;
        const dir = Math.round(t * 10) % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.ellipse(lx + dir * 6, ly, 6, 3, dir * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawDestructibleBlock(
    ctx: CanvasRenderingContext2D,
    block: DestructibleBlockDef,
    timeSec: number,
  ): void {
    ctx.save();

    if (block.material === "barrel") {
      const grad = ctx.createLinearGradient(
        block.x,
        0,
        block.x + block.width,
        0,
      );
      grad.addColorStop(0, "#991B1B");
      grad.addColorStop(0.45, "#EF4444");
      grad.addColorStop(1, "#7F1D1D");
      ctx.fillStyle = grad;
      drawRoundedRect(ctx, block.x, block.y, block.width, block.height, 6);
      ctx.fill();
      ctx.strokeStyle = "#1C1917";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = "#FACC15";
      ctx.fillRect(
        block.x + 2,
        block.y + block.height * 0.36,
        block.width - 4,
        12,
      );
      ctx.fillStyle = "#1C1917";
      ctx.font = "900 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "!",
        block.x + block.width * 0.5,
        block.y + block.height * 0.36 + 6,
      );

      const glow = 0.25 + Math.sin(timeSec * 5 + block.x) * 0.12;
      ctx.strokeStyle = `rgba(251, 146, 60, ${glow})`;
      ctx.lineWidth = 2;
      drawRoundedRect(
        ctx,
        block.x - 2,
        block.y - 2,
        block.width + 4,
        block.height + 4,
        7,
      );
      ctx.stroke();
    } else if (block.material === "rock" || block.material === "concrete") {
      ctx.fillStyle = "#64748B";
      drawRoundedRect(ctx, block.x, block.y, block.width, block.height, 12);
      ctx.fill();
      ctx.strokeStyle = "#1E293B";
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(block.x + 14, block.y + 12);
      ctx.lineTo(block.x + block.width * 0.5, block.y + block.height * 0.52);
      ctx.lineTo(block.x + block.width - 14, block.y + block.height - 16);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#B45309";
      drawRoundedRect(ctx, block.x, block.y, block.width, block.height, 5);
      ctx.fill();
      ctx.strokeStyle = "#451A03";
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.strokeStyle = "#78350F";
      ctx.lineWidth = 3.2;
      ctx.strokeRect(
        block.x + 6,
        block.y + 6,
        Math.max(4, block.width - 12),
        Math.max(4, block.height - 12),
      );
      ctx.beginPath();
      ctx.moveTo(block.x + 6, block.y + 6);
      ctx.lineTo(block.x + block.width - 6, block.y + block.height - 6);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPickupPad(
    ctx: CanvasRenderingContext2D,
    pad: PickupPadDef,
    msLeft: number,
    timeSec: number,
  ): void {
    const ready = msLeft <= 0;
    const accent =
      pad.kind === "medkit"
        ? "#22C55E"
        : pad.kind === "grenade_pack"
          ? "#F97316"
          : "#38BDF8";

    ctx.save();
    ctx.translate(pad.x, pad.y);

    ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    drawRoundedRect(ctx, -26, 16, 52, 9, 4);
    ctx.fill();
    ctx.fillStyle = ready ? accent : "rgba(148, 163, 184, 0.45)";
    ctx.fillRect(-18, 18, 36, 3);

    if (!ready) {
      const pct = Math.max(0, Math.min(1, 1 - msLeft / 18000));
      ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(0, 0, 15, -Math.PI * 0.5, -Math.PI * 0.5 + pct * Math.PI * 2);
      ctx.stroke();

      ctx.font = "800 10px ui-monospace, monospace";
      ctx.fillStyle = "#CBD5E1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.ceil(msLeft / 1000)}s`, 0, 0);
      ctx.restore();
      return;
    }

    const bob = Math.sin(timeSec * 3.8 + pad.x * 0.01) * 5;
    ctx.translate(0, bob - 4);

    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 32);
    glow.addColorStop(0, `${accent}66`);
    glow.addColorStop(1, `${accent}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    drawRoundedRect(ctx, -22, -16, 44, 32, 9);
    ctx.fill();
    ctx.stroke();

    const iconPath = getPickupIconPath(pad.kind);
    const iconImg = iconPath ? pocketWarAssets.getLoadedImage(iconPath) : null;

    if (iconImg) {
      ctx.drawImage(iconImg, -16, -12, 32, 24);
    } else if (pad.kind === "medkit") {
      ctx.fillStyle = "#22C55E";
      ctx.fillRect(-3.5, -10, 7, 20);
      ctx.fillRect(-10, -3.5, 20, 7);
    } else if (pad.kind === "grenade_pack") {
      ctx.fillStyle = "#F97316";
      ctx.beginPath();
      ctx.arc(0, 2, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FACC15";
      ctx.fillRect(-3, -10, 6, 4);
    } else {
      ctx.fillStyle = "#E0F2FE";
      ctx.fillRect(-14, -3, 28, 6);
      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(-4, 2, 6, 7);
    }

    ctx.font = "800 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
    ctx.lineWidth = 3;
    ctx.strokeText(pad.label, 0, 20);
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(pad.label, 0, 20);

    ctx.restore();
  }

  public drawDebugOverlay(
    ctx: CanvasRenderingContext2D,
    map: MapDefinition,
    physics: PocketWarPhysicsWorld,
    debug: DebugOverlayOptions,
  ): void {
    ctx.save();

    if (debug.showCollisions) {
      for (const chain of physics.collisionChains) {
        if (chain.points.length < 2) continue;
        ctx.strokeStyle = chain.loop ? "#22D3EE" : "#FACC15";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const first = chain.points[0]!;
        ctx.moveTo(first[0], first[1]);
        for (let i = 1; i < chain.points.length; i++) {
          const pt = chain.points[i]!;
          ctx.lineTo(pt[0], pt[1]);
        }
        if (chain.loop) ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = "#A3E635";
        for (const pt of chain.points) {
          ctx.fillRect(pt[0] - 2.5, pt[1] - 2.5, 5, 5);
        }
      }

      ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(0, map.waterSurfaceY);
      ctx.lineTo(map.width, map.waterSurfaceY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (debug.showSpawns || debug.showCollisions) {
      map.spawnPoints.forEach((pt, idx) => {
        ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
        ctx.strokeStyle = "#34D399";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = "800 10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ECFDF5";
        ctx.fillText(`S${idx}`, pt.x, pt.y);
      });

      for (const pad of map.pickupPads) {
        ctx.strokeStyle = "#F472B6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "700 9px ui-monospace, monospace";
        ctx.fillStyle = "#FCE7F3";
        ctx.textAlign = "center";
        ctx.fillText(`${pad.id} (${pad.x},${pad.y})`, pad.x, pad.y - 32);
      }
    }

    ctx.restore();
  }
}
