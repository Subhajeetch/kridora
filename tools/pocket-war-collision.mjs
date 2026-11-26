#!/usr/bin/env node
/**
 * Offline map-to-collision pipeline for Pocket War.
 * Reads layer3_terrain_platforms.png alpha channel -> marching squares (d3-contour)
 * -> Douglas-Peucker simplification (simplify-js) -> drops tiny specks
 * -> emits collision.json for both web public assets and packages/shared.
 *
 * Usage:
 *   node tools/pocket-war-collision.mjs --map emerald-falls --width 4400 --height 1900 --tolerance 3
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { contours } from "d3-contour";
import simplify from "simplify-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const args = {
    map: "emerald-falls",
    alphaThreshold: 128,
    tolerance: 3.0,
    minArea: 420,
    worldWidth: 4400,
    worldHeight: 1900,
    downsample: 2,
  };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--map" && val) {
      args.map = val;
      i++;
    } else if (key === "--alpha" && val) {
      args.alphaThreshold = Number(val);
      i++;
    } else if (key === "--tolerance" && val) {
      args.tolerance = Number(val);
      i++;
    } else if (key === "--min-area" && val) {
      args.minArea = Number(val);
      i++;
    } else if (key === "--width" && val) {
      args.worldWidth = Number(val);
      i++;
    } else if (key === "--height" && val) {
      args.worldHeight = Number(val);
      i++;
    } else if (key === "--downsample" && val) {
      args.downsample = Math.max(1, Math.min(8, Number(val)));
      i++;
    }
  }
  return args;
}

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) * 0.5;
}

function dedupeAndFilterRing(points, minSpacingPx) {
  const out = [];
  for (const pt of points) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= minSpacingPx) {
      out.push({ x: Math.round(pt.x), y: Math.round(pt.y) });
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < minSpacingPx) {
      out.pop();
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const mapDir = path.join(
    ROOT_DIR,
    "apps",
    "web",
    "public",
    "assets",
    "pocket-war",
    "maps",
    opts.map,
  );
  const inputPng = path.join(mapDir, "layer3_terrain_platforms.png");
  const publicCollisionOut = path.join(mapDir, "collision.json");
  const publicMapMetaOut = path.join(mapDir, "map.json");
  const sharedOutDir = path.join(
    ROOT_DIR,
    "packages",
    "shared",
    "src",
    "games",
    "pocket-war",
    "generated",
  );
  const sharedCollisionOut = path.join(
    sharedOutDir,
    `${opts.map}.collision.json`,
  );

  try {
    await fs.access(inputPng);
  } catch {
    console.error(
      `[pocket-war-collision] Missing terrain PNG at:\n  ${inputPng}\n` +
        `Generate layer3_terrain_platforms.png (transparent background) first, then re-run.`,
    );
    process.exit(1);
  }

  const meta = await sharp(inputPng).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read PNG dimensions.");
  }

  const gridW = Math.max(64, Math.round(meta.width / opts.downsample));
  const gridH = Math.max(64, Math.round(meta.height / opts.downsample));
  const scaleX = opts.worldWidth / gridW;
  const scaleY = opts.worldHeight / gridH;

  console.log(
    `[pocket-war-collision] Tracing ${opts.map} (${meta.width}x${meta.height} -> grid ${gridW}x${gridH} -> world ${opts.worldWidth}x${opts.worldHeight})`,
  );

  const rawRgba = await sharp(inputPng)
    .resize(gridW, gridH, { fit: "fill", kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const binaryGrid = new Float64Array(gridW * gridH);
  for (let i = 0; i < gridW * gridH; i++) {
    const alpha = rawRgba[i * 4 + 3] ?? 0;
    binaryGrid[i] = alpha >= opts.alphaThreshold ? 1 : 0;
  }

  const contourGenerator = contours().size([gridW, gridH]).thresholds([0.5]);
  const [multiPoly] = contourGenerator(binaryGrid);

  const chains = [];

  if (multiPoly && Array.isArray(multiPoly.coordinates)) {
    for (const polygon of multiPoly.coordinates) {
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) continue;

        const worldPoints = ring.map(([gx, gy]) => ({
          x: gx * scaleX,
          y: gy * scaleY,
        }));

        const simplified = simplify(worldPoints, opts.tolerance, true);
        const cleaned = dedupeAndFilterRing(simplified, 4);

        if (cleaned.length < 3) continue;
        const area = polygonArea(cleaned);
        if (area < opts.minArea) continue;

        chains.push({
          loop: true,
          points: cleaned.map((p) => [p.x, p.y]),
        });
      }
    }
  }

  const payload = {
    version: 1,
    mapId: opts.map.replace(/-/g, "_"),
    worldWidth: opts.worldWidth,
    worldHeight: opts.worldHeight,
    pixelsPerMeter: 30,
    generatedAt: new Date().toISOString(),
    chains,
  };

  await fs.mkdir(sharedOutDir, { recursive: true });
  const jsonText = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(publicCollisionOut, jsonText, "utf8");
  await fs.writeFile(sharedCollisionOut, jsonText, "utf8");

  try {
    await fs.access(publicMapMetaOut);
  } catch {
    const mapMetaScaffold = {
      mapId: payload.mapId,
      worldWidth: opts.worldWidth,
      worldHeight: opts.worldHeight,
      waterSurfaceY: opts.worldHeight - 170,
      killZoneY: opts.worldHeight + 120,
      note: "Use F3 Debug Mode in-game and click to copy exact world coordinates for spawns & pickups.",
    };
    await fs.writeFile(
      publicMapMetaOut,
      `${JSON.stringify(mapMetaScaffold, null, 2)}\n`,
      "utf8",
    );
  }

  const totalVerts = chains.reduce((acc, c) => acc + c.points.length, 0);
  console.log(
    `[pocket-war-collision] Wrote ${chains.length} simplified chains (${totalVerts} vertices) to:\n` +
      `  - ${publicCollisionOut}\n` +
      `  - ${sharedCollisionOut}`,
  );
}

main().catch((err) => {
  console.error("[pocket-war-collision] Failed:", err);
  process.exit(1);
});
