import {
  Box,
  Chain,
  Circle,
  Edge,
  Vec2,
  World,
  type Body,
  type Contact,
  type Fixture,
} from "planck";
import {
  POCKET_WAR_LIMITS,
  type CharacterDefinition,
  type CollisionMapData,
  type DestructibleBlockState,
  type MapDefinition,
  type PlatformRect,
} from "./constants";

export const PPM = POCKET_WAR_LIMITS.PIXELS_PER_METER; // 30 px = 1 m
export const GRAVITY_PX = 960;
export const GRAVITY_M = GRAVITY_PX / PPM; // 32 m/s^2
export const GRENADE_THROW_SPEED_PX = 640;

export const CAT_TERRAIN = 0x0001;
export const CAT_ONE_WAY = 0x0002;
export const CAT_BLOCK = 0x0004;
export const CAT_PLAYER = 0x0008;
export const CAT_PROJECTILE = 0x0010;

export interface FixtureUserData {
  kind: "terrain" | "oneway" | "block" | "player" | "grenade" | "rocket";
  id?: string;
  topY?: number;
}

export interface SoldierControlInput {
  moveX: number; // -1..1
  boost: boolean;
  dropThrough: boolean;
  isScoped: boolean;
}

export interface SoldierSimBody {
  userId: string;
  body: Body;
  isGrounded: boolean;
  wasGrounded: boolean;
  inWater: boolean;
  wasInWater: boolean;
  isBoosting: boolean;
  jetpackFuel: number;
  overheatedUntil: number;
  lastBoostAt: number;
  dropThroughUntil: number;
  stepDistance: number;
}

export interface SoldierStepEvents {
  justLanded: boolean;
  landingSpeed: number;
  justEnteredWater: boolean;
  justExitedWater: boolean;
  footstepTriggered: boolean;
}

export interface GrenadeBodyState {
  id: number;
  ownerId: string;
  body: Body;
  age: number;
  maxAge: number;
  inWater: boolean;
  bouncedThisStep: boolean;
}

export interface RayHitResult {
  hit: boolean;
  kind: "terrain" | "block" | "player" | "none";
  x: number;
  y: number;
  nx: number;
  ny: number;
  fraction: number;
  targetId?: string;
}

export interface PlayerHitboxTarget {
  userId: string;
  x: number;
  y: number;
  radius: number;
}

export function pxToM(px: number): number {
  return px / PPM;
}

export function mToPx(m: number): number {
  return m * PPM;
}

export function computeGrenadeLaunch(
  originX: number,
  originY: number,
  aimAngle: number,
  carrierVx: number,
  carrierVy: number,
): { x: number; y: number; vx: number; vy: number } {
  const cos = Math.cos(aimAngle);
  const sin = Math.sin(aimAngle);
  return {
    x: originX + cos * 26,
    y: originY - 6 + sin * 26,
    vx: cos * GRENADE_THROW_SPEED_PX + carrierVx * 0.32,
    vy: sin * GRENADE_THROW_SPEED_PX - 135 + carrierVy * 0.25,
  };
}

function getUserData(fixture: Fixture): FixtureUserData | null {
  const raw = fixture.getUserData();
  if (typeof raw === "object" && raw !== null && "kind" in raw) {
    return raw as FixtureUserData;
  }
  return null;
}

/**
 * Shared deterministic Planck.js physics world used identically on:
 * - Cloudflare Workers server (authoritative 60 Hz simulation + raycast combat)
 * - Browser client (local player prediction + reconciliation + debug chain drawing)
 */
export class PocketWarPhysicsWorld {
  readonly world: World;
  readonly map: MapDefinition;
  readonly collisionChains: Array<{
    loop: boolean;
    points: Array<[number, number]>;
  }> = [];
  private readonly soldiers = new Map<string, SoldierSimBody>();
  private readonly blocks = new Map<string, Body>();
  private readonly grenades = new Map<number, GrenadeBodyState>();
  private simTimeMs = 0;

  constructor(
    map: MapDefinition,
    initialBlocks: Record<string, DestructibleBlockState>,
    collisionData?: CollisionMapData | null,
  ) {
    this.map = map;
    this.world = new World({
      gravity: new Vec2(0, GRAVITY_M),
    });

    this.setupContactListeners();
    this.buildWorldBounds();

    if (collisionData && collisionData.chains.length > 0) {
      this.buildTerrainFromChains(collisionData);
      this.buildOneWayPlatformsAndSlopes();
    } else {
      this.buildTerrainFromPlatforms();
    }

    this.syncBlocks(initialBlocks);
  }

  private setupContactListeners(): void {
    this.world.on("pre-solve", (contact: Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const dA = getUserData(fA);
      const dB = getUserData(fB);
      if (!dA || !dB) return;

      if (dA.kind === "oneway" || dB.kind === "oneway") {
        const oneWay = dA.kind === "oneway" ? dA : dB;
        const otherBody = dA.kind === "oneway" ? fB.getBody() : fA.getBody();
        const otherData = dA.kind === "oneway" ? dB : dA;

        if (otherData.kind === "player" && otherData.id) {
          const soldier = this.soldiers.get(otherData.id);
          const vel = otherBody.getLinearVelocity();
          const pos = otherBody.getPosition();
          const feetY = mToPx(pos.y) + POCKET_WAR_LIMITS.PLAYER_RADIUS_PX;
          const platTop = oneWay.topY ?? 0;

          if (
            vel.y < -0.2 ||
            feetY > platTop + 11 ||
            (soldier && this.simTimeMs < soldier.dropThroughUntil)
          ) {
            contact.setEnabled(false);
          }
        } else if (otherData.kind === "grenade") {
          const vel = otherBody.getLinearVelocity();
          if (vel.y < 0) {
            contact.setEnabled(false);
          }
        }
      }
    });

    this.world.on("begin-contact", (contact: Contact) => {
      const fA = contact.getFixtureA();
      const fB = contact.getFixtureB();
      const dA = getUserData(fA);
      const dB = getUserData(fB);
      if (!dA || !dB) return;

      if (dA.kind === "grenade" && dA.id) {
        const g = this.grenades.get(Number(dA.id));
        if (g) g.bouncedThisStep = true;
      } else if (dB.kind === "grenade" && dB.id) {
        const g = this.grenades.get(Number(dB.id));
        if (g) g.bouncedThisStep = true;
      }
    });
  }

  private buildWorldBounds(): void {
    const body = this.world.createBody({ type: "static" });
    const w = pxToM(this.map.width);
    const ceil = pxToM(POCKET_WAR_LIMITS.CEILING_Y);
    const wall = pxToM(48);
    const floor = pxToM(this.map.height - 40);

    const edges: Array<[Vec2, Vec2]> = [
      [new Vec2(wall, ceil), new Vec2(w - wall, ceil)],
      [new Vec2(wall, ceil), new Vec2(wall, floor)],
      [new Vec2(w - wall, ceil), new Vec2(w - wall, floor)],
      [new Vec2(wall, floor), new Vec2(w - wall, floor)],
    ];

    for (const [a, b] of edges) {
      body.createFixture({
        shape: new Edge(a, b),
        friction: 0.4,
        restitution: 0.05,
        filterCategoryBits: CAT_TERRAIN,
        filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
        userData: { kind: "terrain" } satisfies FixtureUserData,
      });
    }

    this.collisionChains.push({
      loop: true,
      points: [
        [48, POCKET_WAR_LIMITS.CEILING_Y],
        [this.map.width - 48, POCKET_WAR_LIMITS.CEILING_Y],
        [this.map.width - 48, this.map.height - 40],
        [48, this.map.height - 40],
      ],
    });
  }

  private buildTerrainFromChains(data: CollisionMapData): void {
    const body = this.world.createBody({ type: "static" });
    for (const chain of data.chains) {
      const vecs: Vec2[] = [];
      for (const [x, y] of chain.points) {
        const vx = pxToM(x);
        const vy = pxToM(y);
        const prev = vecs[vecs.length - 1];
        if (!prev || Math.hypot(vx - prev.x, vy - prev.y) >= 0.05) {
          vecs.push(new Vec2(vx, vy));
        }
      }
      if (vecs.length < 3) continue;
      if (chain.loop) {
        const first = vecs[0]!;
        const last = vecs[vecs.length - 1]!;
        if (Math.hypot(first.x - last.x, first.y - last.y) < 0.05) {
          vecs.pop();
        }
      }
      if (vecs.length < 3) continue;

      body.createFixture({
        shape: new Chain(vecs, chain.loop),
        friction: 0.45,
        restitution: 0.02,
        filterCategoryBits: CAT_TERRAIN,
        filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
        userData: { kind: "terrain" } satisfies FixtureUserData,
      });
      this.collisionChains.push({
        loop: chain.loop,
        points: vecs.map((v) => [mToPx(v.x), mToPx(v.y)]),
      });
    }
  }

  private buildOneWayPlatformsAndSlopes(): void {
    const body = this.world.createBody({ type: "static" });
    for (const plat of this.map.platforms) {
      if (!plat.isOneWay) continue;
      this.addPlatformFixture(body, plat);
    }
    for (const slope of this.map.slopes) {
      const a = new Vec2(pxToM(slope.x1), pxToM(slope.y1));
      const b = new Vec2(pxToM(slope.x2), pxToM(slope.y2));
      body.createFixture({
        shape: new Edge(a, b),
        friction: 0.4,
        filterCategoryBits: slope.isOneWay ? CAT_ONE_WAY : CAT_TERRAIN,
        filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
        userData: {
          kind: slope.isOneWay ? "oneway" : "terrain",
          topY: Math.min(slope.y1, slope.y2),
        } satisfies FixtureUserData,
      });
      this.collisionChains.push({
        loop: false,
        points: [
          [slope.x1, slope.y1],
          [slope.x2, slope.y2],
        ],
      });
    }
  }

  private buildTerrainFromPlatforms(): void {
    const body = this.world.createBody({ type: "static" });
    for (const plat of this.map.platforms) {
      if (plat.style === "bounds") continue;
      this.addPlatformFixture(body, plat);
    }
    for (const slope of this.map.slopes) {
      const a = new Vec2(pxToM(slope.x1), pxToM(slope.y1));
      const b = new Vec2(pxToM(slope.x2), pxToM(slope.y2));
      body.createFixture({
        shape: new Edge(a, b),
        friction: 0.4,
        filterCategoryBits: slope.isOneWay ? CAT_ONE_WAY : CAT_TERRAIN,
        filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
        userData: {
          kind: slope.isOneWay ? "oneway" : "terrain",
          topY: Math.min(slope.y1, slope.y2),
        } satisfies FixtureUserData,
      });
      this.collisionChains.push({
        loop: false,
        points: [
          [slope.x1, slope.y1],
          [slope.x2, slope.y2],
        ],
      });
    }
  }

  private addPlatformFixture(body: Body, plat: PlatformRect): void {
    const cx = pxToM(plat.x + plat.width * 0.5);
    const cy = pxToM(plat.y + plat.height * 0.5);
    const hx = pxToM(plat.width * 0.5);
    const hy = pxToM(plat.height * 0.5);

    body.createFixture({
      shape: new Box(hx, hy, new Vec2(cx, cy), 0),
      friction: 0.45,
      restitution: 0.02,
      filterCategoryBits: plat.isOneWay ? CAT_ONE_WAY : CAT_TERRAIN,
      filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
      userData: {
        kind: plat.isOneWay ? "oneway" : "terrain",
        topY: plat.y,
      } satisfies FixtureUserData,
    });

    this.collisionChains.push({
      loop: true,
      points: [
        [plat.x, plat.y],
        [plat.x + plat.width, plat.y],
        [plat.x + plat.width, plat.y + plat.height],
        [plat.x, plat.y + plat.height],
      ],
    });
  }

  syncBlocks(blocks: Record<string, DestructibleBlockState>): void {
    for (const [id, block] of Object.entries(blocks)) {
      const existing = this.blocks.get(id);
      if (block.destroyed) {
        if (existing) {
          this.world.destroyBody(existing);
          this.blocks.delete(id);
        }
      } else if (!existing) {
        const cx = pxToM(block.x + block.width * 0.5);
        const cy = pxToM(block.y + block.height * 0.5);
        const b = this.world.createBody({
          type: "static",
          position: new Vec2(cx, cy),
        });
        b.createFixture({
          shape: new Box(pxToM(block.width * 0.5), pxToM(block.height * 0.5)),
          friction: 0.5,
          restitution: 0.05,
          filterCategoryBits: CAT_BLOCK,
          filterMaskBits: CAT_PLAYER | CAT_PROJECTILE,
          userData: { kind: "block", id } satisfies FixtureUserData,
        });
        this.blocks.set(id, b);
      }
    }
  }

  removeBlock(blockId: string): void {
    const existing = this.blocks.get(blockId);
    if (existing) {
      this.world.destroyBody(existing);
      this.blocks.delete(blockId);
    }
  }

  ensureSoldier(userId: string, xPx: number, yPx: number): SoldierSimBody {
    const existing = this.soldiers.get(userId);
    if (existing) return existing;

    const body = this.world.createBody({
      type: "dynamic",
      position: new Vec2(pxToM(xPx), pxToM(yPx)),
      fixedRotation: true,
      linearDamping: 0.25,
      allowSleep: false,
    });

    body.createFixture({
      shape: new Circle(pxToM(POCKET_WAR_LIMITS.PLAYER_RADIUS_PX)),
      density: 1.0,
      friction: 0.08,
      restitution: 0.0,
      filterCategoryBits: CAT_PLAYER,
      filterMaskBits: CAT_TERRAIN | CAT_ONE_WAY | CAT_BLOCK,
      userData: { kind: "player", id: userId } satisfies FixtureUserData,
    });

    const soldier: SoldierSimBody = {
      userId,
      body,
      isGrounded: false,
      wasGrounded: false,
      inWater: yPx >= this.map.waterSurfaceY,
      wasInWater: false,
      isBoosting: false,
      jetpackFuel: 100,
      overheatedUntil: 0,
      lastBoostAt: 0,
      dropThroughUntil: 0,
      stepDistance: 0,
    };
    this.soldiers.set(userId, soldier);
    return soldier;
  }

  getSoldier(userId: string): SoldierSimBody | undefined {
    return this.soldiers.get(userId);
  }

  removeSoldier(userId: string): void {
    const s = this.soldiers.get(userId);
    if (s) {
      this.world.destroyBody(s.body);
      this.soldiers.delete(userId);
    }
  }

  teleportSoldier(
    userId: string,
    xPx: number,
    yPx: number,
    vxPx = 0,
    vyPx = 0,
  ): void {
    const s = this.ensureSoldier(userId, xPx, yPx);
    s.body.setPosition(new Vec2(pxToM(xPx), pxToM(yPx)));
    s.body.setLinearVelocity(new Vec2(pxToM(vxPx), pxToM(vyPx)));
    s.body.setAwake(true);
  }

  applySoldierImpulse(userId: string, dvxPx: number, dvyPx: number): void {
    const s = this.soldiers.get(userId);
    if (!s) return;
    const vel = s.body.getLinearVelocity();
    s.body.setLinearVelocity(
      new Vec2(vel.x + pxToM(dvxPx), vel.y + pxToM(dvyPx)),
    );
    s.body.setAwake(true);
  }

  /**
   * Custom arcade movement + jetpack controller operating on the fixed-rotation Planck body.
   * Must be called BEFORE `stepWorld(dt)` for each active soldier.
   */
  applySoldierControl(
    soldier: SoldierSimBody,
    input: SoldierControlInput,
    charDef: CharacterDefinition,
    dt: number,
    nowMs: number,
  ): SoldierStepEvents {
    this.simTimeMs = nowMs;
    const pos = soldier.body.getPosition();
    const vel = soldier.body.getLinearVelocity();

    const pxX = mToPx(pos.x);
    const pxY = mToPx(pos.y);
    let vx = mToPx(vel.x);
    let vy = mToPx(vel.y);

    soldier.wasGrounded = soldier.isGrounded;
    soldier.wasInWater = soldier.inWater;

    const footStart = new Vec2(pos.x, pos.y + pxToM(8));
    const footEnd = new Vec2(
      pos.x,
      pos.y + pxToM(POCKET_WAR_LIMITS.PLAYER_RADIUS_PX + 7),
    );
    let groundedHit = false;
    this.world.rayCast(footStart, footEnd, (fixture) => {
      const ud = getUserData(fixture);
      if (!ud) return -1;
      if (ud.kind === "terrain" || ud.kind === "block") {
        groundedHit = true;
        return 0;
      }
      if (
        ud.kind === "oneway" &&
        vy >= -15 &&
        nowMs >= soldier.dropThroughUntil
      ) {
        groundedHit = true;
        return 0;
      }
      return -1;
    });
    soldier.isGrounded = groundedHit && vy >= -35;

    if (input.dropThrough && soldier.isGrounded) {
      soldier.dropThroughUntil = nowMs + 220;
      soldier.isGrounded = false;
      vy = Math.max(vy, 110);
    }

    soldier.inWater =
      pxY + POCKET_WAR_LIMITS.PLAYER_RADIUS_PX * 0.45 >= this.map.waterSurfaceY;
    const waterScale = soldier.inWater ? 0.64 : 1.0;

    const moveClamp = Math.max(-1, Math.min(1, input.moveX));
    const scopeScale = input.isScoped ? 0.65 : 1.0;
    const maxSpeed = charDef.moveSpeed * scopeScale * waterScale;
    const targetVx = moveClamp * maxSpeed;
    const accel = soldier.isGrounded ? 2600 : 1450;

    if (Math.abs(moveClamp) > 0.06) {
      const delta = targetVx - vx;
      const step = Math.sign(delta) * Math.min(Math.abs(delta), accel * dt);
      vx += step;
    } else {
      const drag = soldier.isGrounded ? 2300 : 480;
      const step = Math.sign(vx) * Math.min(Math.abs(vx), drag * dt);
      vx -= step;
    }

    const isOverheated = nowMs < soldier.overheatedUntil;
    const wantsBoost =
      input.boost && !isOverheated && soldier.jetpackFuel > 0.5;
    soldier.isBoosting = wantsBoost;

    if (wantsBoost) {
      const thrustPx = charDef.jetpackThrust * (soldier.inWater ? 0.78 : 1.0);
      vy -= thrustPx * dt;
      soldier.jetpackFuel = Math.max(
        0,
        soldier.jetpackFuel - charDef.jetpackDrainPerSec * dt,
      );
      soldier.lastBoostAt = nowMs;
      if (soldier.jetpackFuel <= 0.5) {
        soldier.jetpackFuel = 0;
        soldier.overheatedUntil = nowMs + POCKET_WAR_LIMITS.JETPACK_OVERHEAT_MS;
        soldier.isBoosting = false;
      }
    } else {
      const rechargeDelay = soldier.isGrounded ? 180 : 520;
      if (nowMs - soldier.lastBoostAt >= rechargeDelay) {
        const rate = soldier.isGrounded ? 42 : 16;
        soldier.jetpackFuel = Math.min(100, soldier.jetpackFuel + rate * dt);
      }
    }

    if (pxY < POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y) {
      const depth =
        (POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y - pxY) /
        Math.max(
          1,
          POCKET_WAR_LIMITS.CEILING_SOFT_ZONE_Y - POCKET_WAR_LIMITS.CEILING_Y,
        );
      vy += depth * 720 * dt;
    }

    if (soldier.inWater) {
      vy *= 1 - 1.6 * dt;
      if (pxY > this.map.waterSurfaceY + 26) {
        vy -= 540 * dt;
      }
    }

    vx = Math.max(-720, Math.min(720, vx));
    vy = Math.max(-620, Math.min(820, vy));

    soldier.body.setLinearVelocity(new Vec2(pxToM(vx), pxToM(vy)));
    soldier.body.setAwake(true);

    // Keep player inside horizontal world bounds safely
    if (pxX < 48 || pxX > this.map.width - 48) {
      const clampedX = Math.max(48, Math.min(this.map.width - 48, pxX));
      soldier.body.setPosition(new Vec2(pxToM(clampedX), pos.y));
    }

    let footstepTriggered = false;
    if (soldier.isGrounded && Math.abs(vx) > 45) {
      soldier.stepDistance += Math.abs(vx) * dt;
      if (soldier.stepDistance >= 68) {
        soldier.stepDistance = 0;
        footstepTriggered = true;
      }
    } else {
      soldier.stepDistance = 0;
    }

    return {
      justLanded: soldier.isGrounded && !soldier.wasGrounded && vy > 90,
      landingSpeed: Math.max(0, vy),
      justEnteredWater: soldier.inWater && !soldier.wasInWater,
      justExitedWater: !soldier.inWater && soldier.wasInWater,
      footstepTriggered,
    };
  }

  spawnGrenade(
    id: number,
    ownerId: string,
    xPx: number,
    yPx: number,
    vxPx: number,
    vyPx: number,
  ): GrenadeBodyState {
    const body = this.world.createBody({
      type: "dynamic",
      position: new Vec2(pxToM(xPx), pxToM(yPx)),
      linearVelocity: new Vec2(pxToM(vxPx), pxToM(vyPx)),
      bullet: true,
      linearDamping: 0.15,
      angularDamping: 0.4,
    });

    body.createFixture({
      shape: new Circle(pxToM(9)),
      density: 1.2,
      friction: 0.35,
      restitution: 0.48,
      filterCategoryBits: CAT_PROJECTILE,
      filterMaskBits: CAT_TERRAIN | CAT_ONE_WAY | CAT_BLOCK,
      userData: { kind: "grenade", id: String(id) } satisfies FixtureUserData,
    });

    const g: GrenadeBodyState = {
      id,
      ownerId,
      body,
      age: 0,
      maxAge: POCKET_WAR_LIMITS.GRENADE_FUSE_SEC,
      inWater: yPx >= this.map.waterSurfaceY,
      bouncedThisStep: false,
    };
    this.grenades.set(id, g);
    return g;
  }

  removeGrenade(id: number): void {
    const g = this.grenades.get(id);
    if (g) {
      this.world.destroyBody(g.body);
      this.grenades.delete(id);
    }
  }

  getGrenades(): IterableIterator<GrenadeBodyState> {
    return this.grenades.values();
  }

  stepWorld(dt = POCKET_WAR_LIMITS.FIXED_DT): void {
    this.world.step(dt, 6, 2);

    for (const g of this.grenades.values()) {
      g.age += dt;
      const pos = g.body.getPosition();
      const yPx = mToPx(pos.y);
      g.inWater = yPx >= this.map.waterSurfaceY;
      if (g.inWater) {
        const v = g.body.getLinearVelocity();
        g.body.setLinearVelocity(new Vec2(v.x * 0.94, v.y * 0.92));
      }
    }
  }

  /**
   * Continuous swept raycast against Planck static terrain, destructible blocks,
   * AND explicit (optionally lag-compensated) player circle hitboxes.
   */
  rayCastSegment(
    x1Px: number,
    y1Px: number,
    x2Px: number,
    y2Px: number,
    ignoreUserId: string,
    playerTargets: readonly PlayerHitboxTarget[],
  ): RayHitResult {
    const p1 = new Vec2(pxToM(x1Px), pxToM(y1Px));
    const p2 = new Vec2(pxToM(x2Px), pxToM(y2Px));

    let best: RayHitResult = {
      hit: false,
      kind: "none",
      x: x2Px,
      y: y2Px,
      nx: 0,
      ny: -1,
      fraction: 1,
    };

    if (Math.hypot(x2Px - x1Px, y2Px - y1Px) < 0.01) {
      return best;
    }

    this.world.rayCast(p1, p2, (fixture, point, normal, fraction) => {
      const ud = getUserData(fixture);
      if (!ud) return -1;
      if (ud.kind !== "terrain" && ud.kind !== "block") {
        return -1;
      }
      if (fraction < best.fraction) {
        best = {
          hit: true,
          kind: ud.kind,
          x: mToPx(point.x),
          y: mToPx(point.y),
          nx: normal.x,
          ny: normal.y,
          fraction,
          targetId: ud.id,
        };
      }
      return fraction;
    });

    const dx = x2Px - x1Px;
    const dy = y2Px - y1Px;
    const segLenSq = dx * dx + dy * dy;

    for (const target of playerTargets) {
      if (target.userId === ignoreUserId) continue;
      const fx = x1Px - target.x;
      const fy = y1Px - target.y;
      const r = target.radius;

      const a = segLenSq;
      const b = 2 * (fx * dx + fy * dy);
      const c = fx * fx + fy * fy - r * r;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;

      const sqrtDisc = Math.sqrt(disc);
      let t = (-b - sqrtDisc) / (2 * a);
      if (t < 0) {
        t = (-b + sqrtDisc) / (2 * a);
      }
      if (t >= 0 && t <= best.fraction) {
        const hx = x1Px + dx * t;
        const hy = y1Px + dy * t;
        const len = Math.max(0.001, Math.hypot(hx - target.x, hy - target.y));
        best = {
          hit: true,
          kind: "player",
          x: hx,
          y: hy,
          nx: (hx - target.x) / len,
          ny: (hy - target.y) / len,
          fraction: t,
          targetId: target.userId,
        };
      }
    }

    return best;
  }

  hasClearLineOfSight(
    x1Px: number,
    y1Px: number,
    x2Px: number,
    y2Px: number,
  ): boolean {
    const res = this.rayCastSegment(x1Px, y1Px, x2Px, y2Px, "", []);
    return !res.hit;
  }

  predictGrenadeArc(
    startX: number,
    startY: number,
    vx: number,
    vy: number,
    steps = 18,
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    let x = startX;
    let y = startY;
    const cvx = vx;
    let cvy = vy;
    const stepDt = 0.055;

    for (let i = 0; i < steps; i++) {
      const nx = x + cvx * stepDt;
      const ny = y + cvy * stepDt + 0.5 * GRAVITY_PX * stepDt * stepDt;
      cvy += GRAVITY_PX * stepDt;
      const hit = this.rayCastSegment(x, y, nx, ny, "", []);
      if (hit.hit) {
        points.push({ x: hit.x, y: hit.y });
        break;
      }
      x = nx;
      y = ny;
      points.push({ x, y });
    }
    return points;
  }
}
