import {
  POCKET_WAR_LIMITS,
  type CharacterDefinition,
  type DestructibleBlockState,
  type KillWeaponIconId,
  type MapDefinition,
  type PlatformRect,
  type SlopeSegment,
  type TrajectoryPoint,
} from "../types";

export const PLAYER_HALF_W = 16;
export const PLAYER_HALF_H = 24;
export const GRAVITY = 980;
export const GRENADE_GRAVITY = GRAVITY * 0.92;
export const GRENADE_THROW_SPEED = 490;
export const GRENADE_FUSE_SEC = 2.2;

export interface LocalSoldierBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  wasGrounded: boolean;
  inWater: boolean;
  wasInWater: boolean;
  isBoosting: boolean;
  jetpackFuel: number;
  overheatedUntil: number;
  lastBoostAt: number;
  stepDistance: number;
}

export interface SoldierStepEvents {
  justLanded: boolean;
  landingSpeed: number;
  justEnteredWater: boolean;
  justExitedWater: boolean;
  footstepTriggered: boolean;
  overheatedTriggered: boolean;
}

export interface LocalProjectile {
  id: string;
  ownerId: string;
  kind: "bullet" | "pellet" | "rocket" | "bomb";
  weaponId: KillWeaponIconId;
  weaponLabel: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  gravity: number;
  damage: number;
  blastRadius: number;
  knockback: number;
  color: string;
  age: number;
  maxAge: number;
  bounces: number;
  inWater: boolean;
}

export interface MoveInput {
  moveX: number; // -1..1
  boost: boolean;
  dropThrough: boolean;
  isScoped?: boolean;
}

export interface RayHit {
  t: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export interface ProjectileStepResult {
  hitWorld: boolean;
  hitBlockId: string | null;
  bounced: boolean;
  waterSplashed: boolean;
  expired: boolean;
  impactNx: number;
  impactNy: number;
}

/**
 * Swept segment-vs-AABB intersection returning entry parameter `t` in [0, 1]
 * and outward surface normal `(nx, ny)`. Prevents high-speed tunneling.
 */
export function sweepSegmentAABB(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): RayHit | null {
  const dx = x1 - x0;
  const dy = y1 - y0;

  let tMin = 0;
  let tMax = 1;
  let nx = 0;
  let ny = 0;

  // X slab
  if (Math.abs(dx) < 1e-8) {
    if (x0 < minX || x0 > maxX) return null;
  } else {
    const invD = 1 / dx;
    let t1 = (minX - x0) * invD;
    let t2 = (maxX - x0) * invD;
    let hitNx = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      hitNx = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      nx = hitNx;
      ny = 0;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  // Y slab
  if (Math.abs(dy) < 1e-8) {
    if (y0 < minY || y0 > maxY) return null;
  } else {
    const invD = 1 / dy;
    let t1 = (minY - y0) * invD;
    let t2 = (maxY - y0) * invD;
    let hitNy = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      hitNy = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      nx = 0;
      ny = hitNy;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  if (tMin < 0 || tMin > 1) return null;
  return {
    t: tMin,
    x: x0 + dx * tMin,
    y: y0 + dy * tMin,
    nx,
    ny,
  };
}

/** Swept segment vs line segment (used for map slopes). */
function sweepSegmentSlope(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  slope: SlopeSegment,
): RayHit | null {
  const rx = x1 - x0;
  const ry = y1 - y0;
  const sx = slope.x2 - slope.x1;
  const sy = slope.y2 - slope.y1;

  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-8) return null;

  const qpx = slope.x1 - x0;
  const qpy = slope.y1 - y0;

  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  // Upward-pointing unit normal of the slope
  const len = Math.hypot(sx, sy) || 1;
  let nx = sy / len;
  let ny = -sx / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }

  return {
    t,
    x: x0 + rx * t,
    y: y0 + ry * t,
    nx,
    ny,
  };
}

export function overlaps(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rect: PlatformRect,
): boolean {
  return (
    cx + hw > rect.x &&
    cx - hw < rect.x + rect.width &&
    cy + hh > rect.y &&
    cy - hh < rect.y + rect.height
  );
}

export function pointInRect(
  px: number,
  py: number,
  rect: PlatformRect,
): boolean {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/** Evaluates slope surface Y at a given world X if X lies within slope bounds. */
function sampleSlopeY(slope: SlopeSegment, x: number): number | null {
  const minX = Math.min(slope.x1, slope.x2);
  const maxX = Math.max(slope.x1, slope.x2);
  if (x < minX || x > maxX) return null;
  const span = slope.x2 - slope.x1;
  if (Math.abs(span) < 1e-4) return null;
  const ratio = (x - slope.x1) / span;
  return slope.y1 + (slope.y2 - slope.y1) * ratio;
}

export function stepSoldierPhysics(
  body: LocalSoldierBody,
  input: MoveInput,
  charDef: CharacterDefinition,
  map: MapDefinition,
  blocks: Record<string, DestructibleBlockState>,
  dt: number,
  now: number,
): SoldierStepEvents {
  body.wasGrounded = body.isGrounded;
  body.wasInWater = body.inWater;

  const prevBottom = body.y + PLAYER_HALF_H;
  const prevVy = body.vy;
  let overheatedTriggered = false;

  // Determine water immersion at feet/waist
  const submergedDepth = body.y + PLAYER_HALF_H * 0.4 - map.waterSurfaceY;
  body.inWater = submergedDepth > 0;

  // Horizontal speed: slight slowdown when 5X scoped or wading in river
  const scopeScale = input.isScoped ? 0.78 : 1;
  const waterScale = body.inWater ? 0.68 : 1;
  const targetVx = input.moveX * charDef.moveSpeed * scopeScale * waterScale;
  const accel = body.inWater ? 9 : body.isGrounded ? 19 : 11;
  body.vx += (targetVx - body.vx) * Math.min(1, accel * dt);
  if (Math.abs(input.moveX) < 0.05 && Math.abs(body.vx) < 4) {
    body.vx = 0;
  }

  // Jetpack thrust, extended fuel burn, and soft ceiling cushion
  const canBoost =
    input.boost && now >= body.overheatedUntil && body.jetpackFuel > 0.5;
  if (canBoost) {
    body.isBoosting = true;
    body.lastBoostAt = now;
    body.jetpackFuel = Math.max(
      0,
      body.jetpackFuel - charDef.jetpackDrainPerSec * dt,
    );
    if (body.jetpackFuel <= 0.5) {
      body.overheatedUntil = now + POCKET_WAR_LIMITS.JETPACK_OVERHEAT_MS;
      body.isBoosting = false;
      overheatedTriggered = true;
    }

    let ceilingFactor = 1;
    if (body.y < POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y) {
      ceilingFactor = Math.max(
        0.12,
        (body.y - POCKET_WAR_LIMITS.CEILING_Y) /
          (POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y - POCKET_WAR_LIMITS.CEILING_Y),
      );
    }

    // Extra launch kick out of water so swimming -> flying feels snappy
    const waterBoostAssist = body.inWater ? 1.25 : 1;
    body.vy -= charDef.jetpackThrust * ceilingFactor * waterBoostAssist * dt;
    if (body.vy < -500) body.vy = -500;
  } else {
    body.isBoosting = false;
    if (now >= body.overheatedUntil && now - body.lastBoostAt > 350) {
      const regenRate = body.isGrounded ? 48 : body.inWater ? 32 : 14;
      body.jetpackFuel = Math.min(100, body.jetpackFuel + regenRate * dt);
    }
  }

  // Gravity & buoyant water forces
  if (body.inWater) {
    const buoyancy = Math.min(1180, submergedDepth * 14);
    body.vy += (GRAVITY * 0.62 - buoyancy) * dt;
    // Water drag
    body.vy *= Math.pow(0.18, dt);
    body.vx *= Math.pow(0.45, dt);
    if (body.vy > 280) body.vy = 280;
  } else {
    body.vy = Math.min(900, body.vy + GRAVITY * dt);
  }

  // Integrate X and resolve solid walls (excluding one-way platforms)
  const prevX = body.x;
  body.x += body.vx * dt;

  const resolveHorizontal = (rect: PlatformRect) => {
    if (rect.isOneWay) return;
    if (overlaps(body.x, body.y, PLAYER_HALF_W, PLAYER_HALF_H, rect)) {
      if (body.vx > 0) {
        body.x = rect.x - PLAYER_HALF_W;
      } else if (body.vx < 0) {
        body.x = rect.x + rect.width + PLAYER_HALF_W;
      } else {
        // Gentle minimum-penetration pushout so a player never sticks inside an edge
        const leftPen = body.x + PLAYER_HALF_W - rect.x;
        const rightPen = rect.x + rect.width - (body.x - PLAYER_HALF_W);
        body.x += leftPen < rightPen ? -leftPen : rightPen;
      }
      body.vx = 0;
    }
  };

  for (const rect of map.platforms) {
    resolveHorizontal(rect);
  }
  for (const block of Object.values(blocks)) {
    if (!block.destroyed) {
      resolveHorizontal(block);
    }
  }

  // Integrate Y and resolve vertical collisions
  body.y += body.vy * dt;
  body.isGrounded = false;

  const resolveVertical = (rect: PlatformRect) => {
    if (!overlaps(body.x, body.y, PLAYER_HALF_W, PLAYER_HALF_H, rect)) return;

    if (rect.isOneWay) {
      if (!input.dropThrough && body.vy >= 0 && prevBottom <= rect.y + 12) {
        body.y = rect.y - PLAYER_HALF_H;
        body.vy = 0;
        body.isGrounded = true;
      }
      return;
    }

    if (body.vy > 0) {
      body.y = rect.y - PLAYER_HALF_H;
      body.vy = 0;
      body.isGrounded = true;
    } else if (body.vy < 0) {
      body.y = rect.y + rect.height + PLAYER_HALF_H;
      body.vy = 0;
    }
  };

  for (const rect of map.platforms) {
    resolveVertical(rect);
  }
  for (const block of Object.values(blocks)) {
    if (!block.destroyed) {
      resolveVertical(block);
    }
  }

  // Resolve smooth walking over map slopes (fallen log approach, mossy ramps)
  if (!input.dropThrough && body.vy >= -40) {
    for (const slope of map.slopes) {
      const surfaceY = sampleSlopeY(slope, body.x);
      if (surfaceY === null) continue;
      const feetY = body.y + PLAYER_HALF_H;
      if (prevBottom <= surfaceY + 14 && feetY >= surfaceY - 4) {
        body.y = surfaceY - PLAYER_HALF_H;
        if (body.vy > 0) body.vy = 0;
        body.isGrounded = true;
      }
    }
  }

  // Strict world boundary clamp (impossible to fall out or soft-lock)
  body.x = Math.max(
    48 + PLAYER_HALF_W,
    Math.min(map.width - 48 - PLAYER_HALF_W, body.x),
  );
  body.y = Math.max(
    POCKET_WAR_LIMITS.CEILING_Y + PLAYER_HALF_H,
    Math.min(map.height - 40 - PLAYER_HALF_H, body.y),
  );

  // Footstep distance accumulator
  let footstepTriggered = false;
  if (body.isGrounded && !body.inWater && Math.abs(body.vx) > 45) {
    body.stepDistance += Math.abs(body.x - prevX);
    if (body.stepDistance >= 64) {
      body.stepDistance = 0;
      footstepTriggered = true;
    }
  } else {
    body.stepDistance = 0;
  }

  const justLanded = !body.wasGrounded && body.isGrounded && prevVy > 130;
  const justEnteredWater = !body.wasInWater && body.inWater;
  const justExitedWater = body.wasInWater && !body.inWater;

  return {
    justLanded,
    landingSpeed: prevVy,
    justEnteredWater,
    justExitedWater,
    footstepTriggered,
    overheatedTriggered,
  };
}

/**
 * Computes grenade spawn origin and short parabolic initial velocity.
 * Shared by both actual grenade throws and the live trajectory preview.
 */
export function computeGrenadeLaunch(
  soldierX: number,
  soldierY: number,
  aimAngle: number,
  soldierVx: number,
  soldierVy: number,
): { x: number; y: number; vx: number; vy: number } {
  const cos = Math.cos(aimAngle);
  const sin = Math.sin(aimAngle);
  return {
    x: soldierX + cos * 22,
    y: soldierY - 4 + sin * 22,
    vx: cos * GRENADE_THROW_SPEED + soldierVx * 0.25,
    vy: sin * GRENADE_THROW_SPEED + soldierVy * 0.18 - 115,
  };
}

/**
 * Steps a projectile (bullet, pellet, rocket, or bouncing grenade) using continuous
 * swept segment collision so fast rounds never tunnel through thin ledges or crates.
 */
export function stepProjectile(
  proj: LocalProjectile,
  map: MapDefinition,
  blocks: Record<string, DestructibleBlockState>,
  dt: number,
): ProjectileStepResult {
  proj.prevX = proj.x;
  proj.prevY = proj.y;
  proj.age += dt;

  if (proj.age >= proj.maxAge) {
    return {
      hitWorld: false,
      hitBlockId: null,
      bounced: false,
      waterSplashed: false,
      expired: true,
      impactNx: 0,
      impactNy: -1,
    };
  }

  // Apply gravity to every dynamic projectile
  let waterSplashed = false;
  if (proj.kind === "bomb") {
    const nowInWater = proj.y >= map.waterSurfaceY;
    if (nowInWater && !proj.inWater) {
      proj.inWater = true;
      waterSplashed = true;
      proj.vx *= 0.55;
      proj.vy *= 0.45;
    }
    if (proj.inWater) {
      proj.vy += GRENADE_GRAVITY * 0.28 * dt;
      proj.vx *= Math.pow(0.28, dt);
      proj.vy *= Math.pow(0.32, dt);
    } else {
      proj.vy += GRENADE_GRAVITY * dt;
    }
  } else {
    proj.vy += proj.gravity * dt;
  }

  const nextX = proj.x + proj.vx * dt;
  const nextY = proj.y + proj.vy * dt;

  // Find earliest continuous collision along segment (x, y) -> (nextX, nextY)
  let bestHit: RayHit | null = null;
  let bestBlockId: string | null = null;
  const pad = proj.kind === "bomb" ? 6 : 1;

  // 1. Destructible blocks
  for (const block of Object.values(blocks)) {
    if (block.destroyed) continue;
    const hit = sweepSegmentAABB(
      proj.x,
      proj.y,
      nextX,
      nextY,
      block.x - pad,
      block.y - pad,
      block.x + block.width + pad,
      block.y + block.height + pad,
    );
    if (hit && (!bestHit || hit.t < bestHit.t)) {
      bestHit = hit;
      bestBlockId = block.id;
    }
  }

  // 2. Static map platforms
  for (const rect of map.platforms) {
    if (rect.isOneWay) {
      // Only bombs falling downward interact with one-way platforms (like the log bridge)
      if (proj.kind !== "bomb" || proj.vy <= 0 || proj.y > rect.y + 4) {
        continue;
      }
    }
    const hit = sweepSegmentAABB(
      proj.x,
      proj.y,
      nextX,
      nextY,
      rect.x - pad,
      rect.y - pad,
      rect.x + rect.width + pad,
      rect.y + rect.height + pad,
    );
    if (hit && (!bestHit || hit.t < bestHit.t)) {
      // One-way ledges only reflect top impacts
      if (rect.isOneWay && hit.ny >= 0) continue;
      bestHit = hit;
      bestBlockId = null;
    }
  }

  // 3. Map slopes (bombs bounce cleanly along slope normals)
  if (proj.kind === "bomb" && proj.vy >= -20) {
    for (const slope of map.slopes) {
      const hit = sweepSegmentSlope(proj.x, proj.y, nextX, nextY, slope);
      if (hit && (!bestHit || hit.t < bestHit.t)) {
        bestHit = hit;
        bestBlockId = null;
      }
    }
  }

  if (bestHit) {
    if (proj.kind === "bomb") {
      // Reflect velocity along surface normal with realistic bounce & roll damping
      proj.x = bestHit.x + bestHit.nx * 1.5;
      proj.y = bestHit.y + bestHit.ny * 1.5;

      const dot = proj.vx * bestHit.nx + proj.vy * bestHit.ny;
      if (dot < 0) {
        const restitution = proj.inWater ? 0.25 : 0.52;
        proj.vx -= (1 + restitution) * dot * bestHit.nx;
        proj.vy -= (1 + restitution) * dot * bestHit.ny;

        // Tangential rolling friction on ground/slopes
        const tx = -bestHit.ny;
        const ty = bestHit.nx;
        const tangentSpeed = proj.vx * tx + proj.vy * ty;
        proj.vx -= tangentSpeed * 0.22 * tx;
        proj.vy -= tangentSpeed * 0.22 * ty;

        if (Math.abs(proj.vy) < 35 && bestHit.ny < -0.5) {
          proj.vy = 0;
        }
        if (Math.abs(proj.vx) < 12 && bestHit.ny < -0.5) {
          proj.vx = 0;
        }
      }

      const significantBounce = Math.hypot(proj.vx, proj.vy) > 65;
      proj.bounces += 1;

      return {
        hitWorld: false,
        hitBlockId: null,
        bounced: significantBounce,
        waterSplashed,
        expired: false,
        impactNx: bestHit.nx,
        impactNy: bestHit.ny,
      };
    }

    // Bullet / pellet / rocket impacted solid terrain or block
    proj.x = bestHit.x;
    proj.y = bestHit.y;
    return {
      hitWorld: true,
      hitBlockId: bestBlockId,
      bounced: false,
      waterSplashed,
      expired: false,
      impactNx: bestHit.nx,
      impactNy: bestHit.ny,
    };
  }

  // Check bullet/rocket splash entering water (non-blocking visual cue)
  if (
    proj.kind !== "bomb" &&
    !proj.inWater &&
    proj.y < map.waterSurfaceY &&
    nextY >= map.waterSurfaceY
  ) {
    proj.inWater = true;
    waterSplashed = true;
  }

  proj.x = nextX;
  proj.y = nextY;

  return {
    hitWorld: false,
    hitBlockId: null,
    bounced: false,
    waterSplashed,
    expired: false,
    impactNx: 0,
    impactNy: -1,
  };
}

/**
 * Simulates the exact parabolic grenade path using `stepProjectile` so the
 * aiming dotted trajectory preview matches real bounces and gravity.
 */
export function predictGrenadeTrajectory(
  originX: number,
  originY: number,
  vx: number,
  vy: number,
  map: MapDefinition,
  blocks: Record<string, DestructibleBlockState>,
  pointCount = 18,
): TrajectoryPoint[] {
  const sim: LocalProjectile = {
    id: "preview",
    ownerId: "preview",
    kind: "bomb",
    weaponId: "grenade",
    weaponLabel: "Frag Grenade",
    x: originX,
    y: originY,
    prevX: originX,
    prevY: originY,
    vx,
    vy,
    gravity: GRENADE_GRAVITY,
    damage: 0,
    blastRadius: 0,
    knockback: 0,
    color: "#FFFFFF",
    age: 0,
    maxAge: GRENADE_FUSE_SEC,
    bounces: 0,
    inWater: originY >= map.waterSurfaceY,
  };

  const points: TrajectoryPoint[] = [{ x: originX, y: originY }];
  const simDt = 1 / 60;
  const sampleEvery = 3;

  for (let step = 1; step <= pointCount * sampleEvery; step++) {
    const res = stepProjectile(sim, map, blocks, simDt);
    if (step % sampleEvery === 0) {
      points.push({ x: sim.x, y: sim.y });
    }
    if (res.expired) break;
  }

  return points;
}
