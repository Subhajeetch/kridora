import { socket } from "@/lib/socket";
import {
  CHARACTER_CATALOG,
  EVENT_KIND_PLAYER_RESPAWN,
  GRAVITY_PX,
  INPUT_FLAG_BOOST,
  INPUT_FLAG_DROP,
  INPUT_FLAG_MELEE,
  INPUT_FLAG_PICKUP,
  INPUT_FLAG_RELOAD,
  INPUT_FLAG_SCOPED,
  INPUT_FLAG_SHOOT,
  INPUT_FLAG_SWITCH_WEAPON,
  INPUT_FLAG_THROW_BOMB,
  MAP_CATALOG,
  PLAYER_FLAG_ALIVE,
  PLAYER_FLAG_BOOSTING,
  PLAYER_FLAG_GROUNDED,
  PLAYER_FLAG_IN_WATER,
  PLAYER_FLAG_OVERHEATED,
  PLAYER_FLAG_RELOADING,
  PLAYER_FLAG_SCOPED,
  POCKET_WAR_LIMITS,
  PROJ_KIND_BOMB,
  PROJ_KIND_ROCKET,
  PW_BIN_TYPE_INPUT,
  PocketWarPhysicsWorld,
  WEAPON_CATALOG,
  computeGrenadeLaunch,
  decodeServerSnapshot,
  encodeClientInput,
  killWeaponIdToIndex,
  mToPx,
  unpackPlayerTuple,
  type CollisionMapData,
  type HudTelemetry,
  type InputControlFrame,
  type MapDefinition,
  type PlayerHitboxTarget,
  type PlayerScoreRow,
  type PocketWarCharacterId,
  type PocketWarKillFeedEntry,
  type PocketWarState,
  type RenderPlayerState,
  type ServerSnapshotPacket,
  type SnapshotEventTuple,
  type SnapshotPlayerState,
  type SnapshotProjectileTuple,
  type SoldierStepEvents,
  type WeaponId,
} from "../types";

export interface InterpolatedProjectile {
  id: number;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  killWeaponIdx: number;
}

export interface NetClientCallbacks {
  onServerEvents: (events: readonly SnapshotEventTuple[]) => void;
  onKillFeed: (entries: readonly PocketWarKillFeedEntry[]) => void;
  onLocalStepEvents: (
    events: SoldierStepEvents,
    x: number,
    y: number,
    vx: number,
    isBoosting: boolean,
    jetpackFuel: number,
  ) => void;
  onLocalShot: (
    originX: number,
    originY: number,
    aimAngle: number,
    weaponId: WeaponId,
  ) => void;
  onLocalReload: () => void;
}

interface PendingInputEntry {
  seq: number;
  moveX: number;
  boost: boolean;
  dropThrough: boolean;
  isScoped: boolean;
  aimAngle: number;
  steps: number;
  sentAt: number;
}

interface BufferedSnapshotFrame {
  receivedAt: number;
  tick: number;
  players: Map<string, SnapshotPlayerState>;
  projectiles: Map<number, SnapshotProjectileTuple>;
}

interface VisualAnimState {
  runCycle: number;
  hitFlash: number;
  muzzleFlash: number;
  recoilOffset: number;
  meleeAnim: number;
  throwAnim: number;
}

interface PlayerRosterMeta {
  username: string;
  characterId: PocketWarCharacterId;
  connected: boolean;
}

const INTERP_DELAY_MS = 100;
const PROJECTILE_INTERP_DELAY_MS = 55;
const MAX_EXTRAPOLATION_MS = 80;
const MAX_PENDING_INPUTS = 90;
const MAX_SNAPSHOT_BUFFER = 16;
const INPUT_SEND_INTERVAL_MS = 33; // 30 Hz heartbeat + instant edge/shot packets
const RECONCILE_DEADBAND_PX = 26;
const RECONCILE_VEL_DEADBAND_PX = 160;
const RECONCILE_DRIFT_MIN_PX = 2.5;
const RECONCILE_FUEL_DEADBAND = 6;
const RECONCILE_SNAP_THRESHOLD_PX = 380;
const RECONCILE_SMOOTH_THRESHOLD_PX = 3.5;
const EDGE_ACTION_MASK =
  INPUT_FLAG_RELOAD |
  INPUT_FLAG_THROW_BOMB |
  INPUT_FLAG_MELEE |
  INPUT_FLAG_SWITCH_WEAPON |
  INPUT_FLAG_PICKUP;

interface PredictedProjectilePreview {
  id: number;
  kind: number;
  killWeaponIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  expiresAt: number;
}

interface SentSnapshotSample {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

/**
 * Authoritative multiplayer netcode + local prediction controller for Pocket War.
 * - Runs shared Planck.js `PocketWarPhysicsWorld` at fixed 60 Hz for local prediction.
 * - Streams compact msgpack `ClientInputPacket` frames at ~30 Hz (or immediately on edge triggers).
 * - Reconciles against server `acks[userId]` with unacked input replay + exponential visual smoothing.
 * - Smoothly interpolates remote players & projectiles via a 100 ms jitter buffer.
 */
export class PocketWarNetClient {
  private readonly localUserId: string;
  private readonly callbacks: NetClientCallbacks;
  private map: MapDefinition;
  private physics: PocketWarPhysicsWorld;

  private rosterMeta = new Map<string, PlayerRosterMeta>();
  private latestPlayers = new Map<string, SnapshotPlayerState>();
  private snapshotBuffer: BufferedSnapshotFrame[] = [];
  private anims = new Map<string, VisualAnimState>();
  private destroyedBlockIds = new Set<string>();
  private pickupCooldownUntil = new Map<string, number>();

  private pendingInputs: PendingInputEntry[] = [];
  private nextSeq = 1;
  private lastServerTick = 0;
  private soloWaitEndsAt: number | null = null;

  private stepsSinceLastSend = 0;
  private lastInputSendAt = 0;
  private lastLocalBombAt = 0;
  private lastLocalShotAtPerf = 0;
  private localReloadingUntil = 0;
  private localSwitchOverride: { slot: 0 | 1; until: number } | null = null;
  private nextPredictedProjId = -1;
  private predictedProjectiles: PredictedProjectilePreview[] = [];
  private knownServerProjIds = new Set<number>();
  private sentSnapshots = new Map<number, SentSnapshotSample>();
  private unackedShots: Array<{ seq: number; weaponId: WeaponId }> = [];
  private unackedBombs: number[] = [];
  private predictedShotAcksPending = 0;

  private localX = 680;
  private localY = 390;
  private localVx = 0;
  private localVy = 0;
  private localAimAngle = 0;
  private localGrounded = false;
  private localInWater = false;
  private localBoosting = false;
  private localFuel = 100;
  private localOverheatedUntil = 0;
  private localAlive = true;

  private visualOffsetX = 0;
  private visualOffsetY = 0;

  private attached = false;
  private readonly boundOnBinary: (bytes: Uint8Array) => void;

  constructor(
    initialState: PocketWarState,
    localUserId: string,
    callbacks: NetClientCallbacks,
    collisionData?: CollisionMapData | null,
  ) {
    this.localUserId = localUserId;
    this.callbacks = callbacks;
    this.map = MAP_CATALOG[initialState.settings.mapId];
    this.physics = new PocketWarPhysicsWorld(
      this.map,
      initialState.blocks,
      collisionData,
    );
    this.soloWaitEndsAt = initialState.soloWaitEndsAt;

    this.boundOnBinary = (bytes: Uint8Array) => {
      this.handleBinaryFrame(bytes);
    };

    this.seedFromFullState(initialState);
  }

  public start(): void {
    if (this.attached) return;
    this.attached = true;
    socket.onBinary(this.boundOnBinary);
  }

  public stop(): void {
    if (!this.attached) return;
    this.attached = false;
    socket.offBinary(this.boundOnBinary);
  }

  public getPhysicsWorld(): PocketWarPhysicsWorld {
    return this.physics;
  }

  public getMap(): MapDefinition {
    return this.map;
  }

  public getDestroyedBlockIds(): ReadonlySet<string> {
    return this.destroyedBlockIds;
  }

  public getPickupCooldownUntil(): ReadonlyMap<string, number> {
    return this.pickupCooldownUntil;
  }

  public getSoloWaitEndsAt(): number | null {
    return this.soloWaitEndsAt;
  }

  /**
   * Rebuilds the client Planck world seamlessly when `collision.json` finishes
   * loading asynchronously, preserving the local soldier's live position & velocity.
   */
  public applyCollisionData(
    collisionData: CollisionMapData,
    currentState: PocketWarState,
  ): void {
    const blocksCopy = { ...currentState.blocks };
    for (const id of this.destroyedBlockIds) {
      const blk = blocksCopy[id];
      if (blk) {
        blocksCopy[id] = { ...blk, destroyed: true, hp: 0 };
      }
    }

    const nextWorld = new PocketWarPhysicsWorld(
      this.map,
      blocksCopy,
      collisionData,
    );

    if (this.localAlive) {
      const soldier = nextWorld.ensureSoldier(
        this.localUserId,
        this.localX,
        this.localY,
      );
      nextWorld.teleportSoldier(
        this.localUserId,
        this.localX,
        this.localY,
        this.localVx,
        this.localVy,
      );
      soldier.jetpackFuel = this.localFuel;
      soldier.overheatedUntil = this.localOverheatedUntil;
    }

    this.physics = nextWorld;
  }

  /**
   * Keeps static roster metadata (username, chosen character, online status,
   * solo-wait banner fallback) synchronized whenever a JSON `pocket-war:state` arrives.
   */
  public syncRosterFromState(state: PocketWarState): void {
    const onlineSet = new Set(state.onlineUserIds);
    for (const player of Object.values(state.players)) {
      this.rosterMeta.set(player.userId, {
        username: player.username,
        characterId: player.characterId,
        connected: onlineSet.size === 0 ? true : onlineSet.has(player.userId),
      });
    }
    if (this.lastServerTick === 0) {
      this.soloWaitEndsAt = state.soloWaitEndsAt;
    }
  }

  private seedFromFullState(state: PocketWarState): void {
    this.syncRosterFromState(state);

    for (const blk of Object.values(state.blocks)) {
      if (blk.destroyed) {
        this.destroyedBlockIds.add(blk.id);
      }
    }

    const now = Date.now();
    for (const pk of Object.values(state.pickups)) {
      if (pk.availableAt > now) {
        this.pickupCooldownUntil.set(pk.id, pk.availableAt);
      }
    }

    for (const p of Object.values(state.players)) {
      const slot = p.weapons[p.activeSlot];
      let flags = 0;
      if (p.isAlive) flags |= PLAYER_FLAG_ALIVE;
      if (p.isBoosting) flags |= PLAYER_FLAG_BOOSTING;
      if (p.isScoped) flags |= PLAYER_FLAG_SCOPED;

      const snap: SnapshotPlayerState = {
        userId: p.userId,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        aimAngle: p.aimAngle,
        hp: p.hp,
        maxHp: p.maxHp,
        livesLeft: p.livesLeft,
        jetpackFuel: p.jetpackFuel,
        flags,
        activeSlot: p.activeSlot,
        ammo: slot.ammo,
        reserveAmmo: slot.reserveAmmo,
        bombsLeft: p.bombsLeft,
        kills: p.kills,
        deaths: p.deaths,
        damageDealt: p.damageDealt,
        respawnMsLeft:
          !p.isAlive && p.respawnAt !== null
            ? Math.max(0, p.respawnAt - now)
            : 0,
        invulnMsLeft: p.isAlive ? Math.max(0, p.invulnerableUntil - now) : 0,
        reloadPct: 0,
        weapon0: p.weapons[0].weaponId,
        weapon1: p.weapons[1].weaponId,
      };
      this.latestPlayers.set(p.userId, snap);

      if (p.userId === this.localUserId) {
        this.localX = p.x;
        this.localY = p.y;
        this.localVx = p.vx;
        this.localVy = p.vy;
        this.localAimAngle = p.aimAngle;
        this.localFuel = p.jetpackFuel;
        this.localAlive = p.isAlive;
        if (p.isAlive) {
          const s = this.physics.ensureSoldier(this.localUserId, p.x, p.y);
          s.jetpackFuel = p.jetpackFuel;
        }
      }
    }
  }

  public getAnim(userId: string): VisualAnimState {
    let entry = this.anims.get(userId);
    if (!entry) {
      entry = {
        runCycle: 0,
        hitFlash: 0,
        muzzleFlash: 0,
        recoilOffset: 0,
        meleeAnim: 0,
        throwAnim: 0,
      };
      this.anims.set(userId, entry);
    }
    return entry;
  }

  public triggerMuzzleKick(userId: string, recoil: number): void {
    const a = this.getAnim(userId);
    a.muzzleFlash = 1;
    a.recoilOffset = Math.min(7.5, recoil * 0.036);
  }

  public triggerHitFlash(userId: string): void {
    this.getAnim(userId).hitFlash = 1;
  }

  public triggerMeleeAnim(userId: string): void {
    this.getAnim(userId).meleeAnim = 1;
  }

  public triggerThrowAnim(userId: string): void {
    this.getAnim(userId).throwAnim = 1;
  }

  /**
   * Runs one fixed 60 Hz (`POCKET_WAR_LIMITS.FIXED_DT`) prediction tick for the local soldier.
   */
  public stepPrediction(frame: InputControlFrame, nowMs: number): void {
    this.localAimAngle = frame.aimAngle;
    this.stepsSinceLastSend += 1;

    if (!this.localAlive) {
      this.localBoosting = false;
      return;
    }

    const meta = this.rosterMeta.get(this.localUserId);
    const charDef = CHARACTER_CATALOG[meta?.characterId ?? "rex"];
    const soldier = this.physics.ensureSoldier(
      this.localUserId,
      this.localX,
      this.localY,
    );

    const stepEv = this.physics.applySoldierControl(
      soldier,
      {
        moveX: frame.moveX,
        boost: frame.boost,
        dropThrough: frame.dropThrough,
        isScoped: frame.isScoped,
      },
      charDef,
      POCKET_WAR_LIMITS.FIXED_DT,
      nowMs,
    );

    this.physics.stepWorld(POCKET_WAR_LIMITS.FIXED_DT);

    const pos = soldier.body.getPosition();
    const vel = soldier.body.getLinearVelocity();
    this.localX = mToPx(pos.x);
    this.localY = mToPx(pos.y);
    this.localVx = mToPx(vel.x);
    this.localVy = mToPx(vel.y);
    this.localGrounded = soldier.isGrounded;
    this.localInWater = soldier.inWater;
    this.localBoosting = soldier.isBoosting;
    this.localFuel = soldier.jetpackFuel;
    this.localOverheatedUntil = soldier.overheatedUntil;

    this.callbacks.onLocalStepEvents(
      stepEv,
      this.localX,
      this.localY,
      this.localVx,
      this.localBoosting,
      this.localFuel,
    );

    if (this.predictedProjectiles.length > 0) {
      const dt = POCKET_WAR_LIMITS.FIXED_DT;
      for (let i = this.predictedProjectiles.length - 1; i >= 0; i--) {
        const g = this.predictedProjectiles[i]!;
        if (nowMs >= g.expiresAt) {
          this.predictedProjectiles.splice(i, 1);
          continue;
        }
        const isBomb = g.kind === PROJ_KIND_BOMB;
        const nx = g.x + g.vx * dt;
        const ny = g.y + g.vy * dt + (isBomb ? 0.5 * GRAVITY_PX * dt * dt : 0);
        const hit = this.physics.rayCastSegment(
          g.x,
          g.y,
          nx,
          ny,
          this.localUserId,
          [],
        );
        if (hit.hit) {
          if (isBomb) {
            const dot = g.vx * hit.nx + g.vy * hit.ny;
            g.vx = (g.vx - 2 * dot * hit.nx) * 0.45;
            g.vy = (g.vy - 2 * dot * hit.ny) * 0.45;
            g.x = hit.x + hit.nx * 3;
            g.y = hit.y + hit.ny * 3;
          } else {
            this.predictedProjectiles.splice(i, 1);
          }
        } else {
          g.x = nx;
          g.y = ny;
          if (isBomb) {
            g.vy += GRAVITY_PX * dt;
          }
        }
      }
    }
  }

  public setLocalActiveSlotOverride(slot: 0 | 1): void {
    this.localSwitchOverride = { slot, until: Date.now() + 260 };
  }

  public notifyLocalManualReload(weaponId: WeaponId, nowEpochMs: number): void {
    const def = WEAPON_CATALOG[weaponId];
    this.localReloadingUntil = nowEpochMs + def.reloadTimeMs;
  }

  public consumePredictedShotAck(): boolean {
    if (this.predictedShotAcksPending > 0) {
      this.predictedShotAcksPending -= 1;
      return true;
    }
    return false;
  }

  public getRemoteHitTargets(): PlayerHitboxTarget[] {
    const targets: PlayerHitboxTarget[] = [];
    for (const p of this.latestPlayers.values()) {
      if (p.userId === this.localUserId) continue;
      if ((p.flags & PLAYER_FLAG_ALIVE) === 0 || p.invulnMsLeft > 0) continue;
      targets.push({
        userId: p.userId,
        x: p.x,
        y: p.y,
        radius: POCKET_WAR_LIMITS.PLAYER_RADIUS_PX + 7,
      });
    }
    return targets;
  }

  private resolveLocalWeaponState(
    frame: InputControlFrame,
    nowEpochMs: number,
  ): {
    activeSlot: 0 | 1;
    weaponId: WeaponId;
    predictedAmmo: number;
    predictedReserve: number;
    isReloading: boolean;
    predictedBombsLeft: number;
  } {
    const me = this.latestPlayers.get(this.localUserId);
    const meta = this.rosterMeta.get(this.localUserId);
    const charDef = CHARACTER_CATALOG[meta?.characterId ?? "rex"];

    const activeSlot =
      this.localSwitchOverride && nowEpochMs < this.localSwitchOverride.until
        ? this.localSwitchOverride.slot
        : (me?.activeSlot ?? frame.activeSlot);
    const w0 = me ? me.weapon0 : charDef.primaryWeaponId;
    const w1 = me ? me.weapon1 : charDef.secondaryWeaponId;
    const weaponId = activeSlot === 1 ? w1 : w0;
    const def = WEAPON_CATALOG[weaponId];

    let unackedForWeapon = 0;
    for (const s of this.unackedShots) {
      if (s.weaponId === weaponId) unackedForWeapon += 1;
    }

    const baseAmmo = me ? me.ammo : def.magSize;
    const predictedAmmo = Math.max(0, baseAmmo - unackedForWeapon);
    const predictedReserve = me ? me.reserveAmmo : def.defaultReserveAmmo;
    const serverReloading = Boolean(
      me && (me.flags & PLAYER_FLAG_RELOADING) !== 0,
    );
    const isReloading =
      serverReloading || nowEpochMs < this.localReloadingUntil;
    const baseBombs = me?.bombsLeft ?? charDef.startingBombs;
    const predictedBombsLeft = Math.max(
      0,
      baseBombs - this.unackedBombs.length,
    );

    return {
      activeSlot,
      weaponId,
      predictedAmmo,
      predictedReserve,
      isReloading,
      predictedBombsLeft,
    };
  }

  /**
   * Sends a binary `ClientInputPacket` at 30 Hz (or immediately on edge triggers & local shots).
   */
  public maybeSendInput(
    frame: InputControlFrame,
    flags: number,
    nowPerfMs: number,
    nowEpochMs: number,
    shootPressed = false,
  ): void {
    const wState = this.resolveLocalWeaponState(frame, nowEpochMs);
    const wDef = WEAPON_CATALOG[wState.weaponId];
    const canLocalShootNow =
      this.localAlive &&
      (flags & INPUT_FLAG_SHOOT) !== 0 &&
      !wState.isReloading &&
      nowPerfMs - this.lastLocalShotAtPerf >= wDef.fireRateMs &&
      wState.predictedAmmo > 0;

    const hasEdgeAction =
      (flags & EDGE_ACTION_MASK) !== 0 || shootPressed || canLocalShootNow;
    const due =
      nowPerfMs - this.lastInputSendAt >= INPUT_SEND_INTERVAL_MS &&
      this.stepsSinceLastSend > 0;
    if (!due && !hasEdgeAction) return;

    this.lastInputSendAt = nowPerfMs;
    const steps = Math.min(6, this.stepsSinceLastSend);
    this.stepsSinceLastSend = 0;

    const seq = this.nextSeq++;

    if (canLocalShootNow) {
      this.lastLocalShotAtPerf = nowPerfMs;
      this.unackedShots.push({ seq, weaponId: wState.weaponId });
      this.predictedShotAcksPending = Math.min(
        8,
        this.predictedShotAcksPending + 1,
      );

      const originX = this.localX + Math.cos(frame.aimAngle) * 28;
      const originY = this.localY - 2 + Math.sin(frame.aimAngle) * 28;

      if (wDef.projectileType === "rocket") {
        this.predictedProjectiles.push({
          id: this.nextPredictedProjId--,
          kind: PROJ_KIND_ROCKET,
          killWeaponIdx: killWeaponIdToIndex("rpg7"),
          x: originX,
          y: originY,
          vx: Math.cos(frame.aimAngle) * wDef.bulletSpeed,
          vy: Math.sin(frame.aimAngle) * wDef.bulletSpeed,
          expiresAt: nowEpochMs + 450,
        });
      }

      this.callbacks.onLocalShot(
        originX,
        originY,
        frame.aimAngle,
        wState.weaponId,
      );

      if (wState.predictedAmmo - 1 <= 0 && wState.predictedReserve !== 0) {
        this.localReloadingUntil = nowEpochMs + wDef.reloadTimeMs;
        this.callbacks.onLocalReload();
      }
    }

    if ((flags & INPUT_FLAG_THROW_BOMB) !== 0 && this.localAlive) {
      if (
        wState.predictedBombsLeft > 0 &&
        nowEpochMs - this.lastLocalBombAt >= POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS
      ) {
        this.lastLocalBombAt = nowEpochMs;
        this.unackedBombs.push(seq);
        this.triggerThrowAnim(this.localUserId);
        const launch = computeGrenadeLaunch(
          this.localX,
          this.localY,
          frame.aimAngle,
          this.localVx,
          this.localVy,
        );
        this.predictedProjectiles.push({
          id: this.nextPredictedProjId--,
          kind: PROJ_KIND_BOMB,
          killWeaponIdx: killWeaponIdToIndex("grenade"),
          x: launch.x,
          y: launch.y,
          vx: launch.vx,
          vy: launch.vy,
          expiresAt: nowEpochMs + 450,
        });
      }
    }
    const packetBytes = encodeClientInput({
      t: PW_BIN_TYPE_INPUT,
      seq,
      mx: Math.max(-100, Math.min(100, Math.round(frame.moveX * 100))),
      fl: flags,
      aim: Math.max(-6284, Math.min(6284, Math.round(frame.aimAngle * 1000))),
      sl: frame.activeSlot,
      ct: this.lastServerTick,
      st: steps,
    });

    socket.sendBinary(packetBytes);

    if (this.localAlive) {
      this.sentSnapshots.set(seq, {
        x: this.localX,
        y: this.localY,
        vx: this.localVx,
        vy: this.localVy,
        fuel: this.localFuel,
      });
      if (this.sentSnapshots.size > MAX_PENDING_INPUTS) {
        const firstKey = this.sentSnapshots.keys().next().value;
        if (firstKey !== undefined) this.sentSnapshots.delete(firstKey);
      }

      this.pendingInputs.push({
        seq,
        moveX: Math.max(-1, Math.min(1, Math.round(frame.moveX * 100) / 100)),
        boost: (flags & INPUT_FLAG_BOOST) !== 0,
        dropThrough: (flags & INPUT_FLAG_DROP) !== 0,
        isScoped: (flags & INPUT_FLAG_SCOPED) !== 0,
        aimAngle: frame.aimAngle,
        steps,
        sentAt: nowEpochMs,
      });
      if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
        this.pendingInputs.splice(
          0,
          this.pendingInputs.length - MAX_PENDING_INPUTS,
        );
      }
    }
  }

  /**
   * Decays visual reconciliation error offset and character animation timers each render frame.
   */
  public updateVisualSmoothing(dtSec: number): void {
    const decay = Math.exp(-14 * dtSec);
    this.visualOffsetX *= decay;
    this.visualOffsetY *= decay;
    if (Math.abs(this.visualOffsetX) < 0.25) this.visualOffsetX = 0;
    if (Math.abs(this.visualOffsetY) < 0.25) this.visualOffsetY = 0;

    for (const [userId, anim] of this.anims.entries()) {
      anim.hitFlash = Math.max(0, anim.hitFlash - dtSec * 5.2);
      anim.muzzleFlash = Math.max(0, anim.muzzleFlash - dtSec * 14);
      anim.recoilOffset = Math.max(0, anim.recoilOffset - dtSec * 36);
      anim.meleeAnim = Math.max(0, anim.meleeAnim - dtSec * 4.6);
      anim.throwAnim = Math.max(0, anim.throwAnim - dtSec * 3.8);

      if (userId === this.localUserId) {
        if (this.localGrounded && Math.abs(this.localVx) > 20) {
          anim.runCycle += Math.abs(this.localVx) * dtSec * 0.042;
        }
      } else {
        const snap = this.latestPlayers.get(userId);
        if (
          snap &&
          (snap.flags & PLAYER_FLAG_GROUNDED) !== 0 &&
          Math.abs(snap.vx) > 20
        ) {
          anim.runCycle += Math.abs(snap.vx) * dtSec * 0.042;
        }
      }
    }
  }

  private handleBinaryFrame(bytes: Uint8Array): void {
    const pkt = decodeServerSnapshot(bytes);
    if (!pkt) return;
    if (pkt.tick <= this.lastServerTick) return;

    this.lastServerTick = pkt.tick;
    this.soloWaitEndsAt = pkt.solo;

    // 1. Sync destroyed blocks into local Planck world
    for (const blockId of pkt.db) {
      if (!this.destroyedBlockIds.has(blockId)) {
        this.destroyedBlockIds.add(blockId);
        this.physics.removeBlock(blockId);
      }
    }

    // 2. Sync pickup cooldowns
    const nowEpoch = Date.now();
    this.pickupCooldownUntil.clear();
    for (const [padId, msLeft] of pkt.pk) {
      if (msLeft > 0) {
        this.pickupCooldownUntil.set(padId, nowEpoch + msLeft);
      }
    }

    // 3. Unpack players & projectiles into jitter buffer
    const playersMap = new Map<string, SnapshotPlayerState>();
    for (const tuple of pkt.p) {
      const unpacked = unpackPlayerTuple(tuple);
      playersMap.set(unpacked.userId, unpacked);
      this.latestPlayers.set(unpacked.userId, unpacked);
    }

    const projMap = new Map<number, SnapshotProjectileTuple>();
    const activeProjIds = new Set<number>();
    for (const pr of pkt.pr) {
      projMap.set(pr[0], pr);
      activeProjIds.add(pr[0]);
      if (
        (pr[1] === PROJ_KIND_BOMB || pr[1] === PROJ_KIND_ROCKET) &&
        !this.knownServerProjIds.has(pr[0]) &&
        this.predictedProjectiles.length > 0
      ) {
        let bestIdx = -1;
        let bestDist = 360;
        for (let i = 0; i < this.predictedProjectiles.length; i++) {
          const pg = this.predictedProjectiles[i]!;
          if (pg.kind !== pr[1]) continue;
          const d = Math.hypot(pg.x - pr[2], pg.y - pr[3]);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          this.predictedProjectiles.splice(bestIdx, 1);
        }
      }
    }
    this.knownServerProjIds = activeProjIds;

    this.snapshotBuffer.push({
      receivedAt: performance.now(),
      tick: pkt.tick,
      players: playersMap,
      projectiles: projMap,
    });
    if (this.snapshotBuffer.length > MAX_SNAPSHOT_BUFFER) {
      this.snapshotBuffer.shift();
    }

    // 4. Reconcile local player
    const localSnap = playersMap.get(this.localUserId);
    const localRespawned = pkt.ev.some(
      (ev) => ev[0] === EVENT_KIND_PLAYER_RESPAWN && ev[6] === this.localUserId,
    );
    if (localSnap) {
      this.reconcileLocalPlayer(localSnap, pkt, localRespawned, nowEpoch);
    }

    // 5. Emit authoritative events & kill feed entries
    if (pkt.ev.length > 0) {
      this.callbacks.onServerEvents(pkt.ev);
    }
    if (pkt.kf.length > 0) {
      this.callbacks.onKillFeed(pkt.kf);
    }
  }

  private reconcileLocalPlayer(
    serverState: SnapshotPlayerState,
    pkt: ServerSnapshotPacket,
    forceRespawnSnap: boolean,
    nowEpoch: number,
  ): void {
    const serverAlive = (serverState.flags & PLAYER_FLAG_ALIVE) !== 0;
    const ackSeq = pkt.acks[this.localUserId] ?? 0;

    // Prune acknowledged unacked predictions
    if (ackSeq > 0) {
      while (
        this.unackedShots.length > 0 &&
        this.unackedShots[0]!.seq <= ackSeq
      ) {
        this.unackedShots.shift();
      }
      while (this.unackedBombs.length > 0 && this.unackedBombs[0]! <= ackSeq) {
        this.unackedBombs.shift();
      }
    }

    const refSnap = ackSeq > 0 ? this.sentSnapshots.get(ackSeq) : undefined;
    if (ackSeq > 0) {
      for (const k of this.sentSnapshots.keys()) {
        if (k < ackSeq) this.sentSnapshots.delete(k);
      }
    }

    // Prune acknowledged inputs
    if (ackSeq > 0 && this.pendingInputs.length > 0) {
      let cutIdx = 0;
      while (
        cutIdx < this.pendingInputs.length &&
        this.pendingInputs[cutIdx]!.seq <= ackSeq
      ) {
        cutIdx += 1;
      }
      if (cutIdx > 0) {
        this.pendingInputs.splice(0, cutIdx);
      }
    }

    if (!serverAlive) {
      if (this.localAlive) {
        this.physics.removeSoldier(this.localUserId);
      }
      this.localAlive = false;
      this.localBoosting = false;
      this.localX = serverState.x;
      this.localY = serverState.y;
      this.localVx = 0;
      this.localVy = 0;
      this.pendingInputs = [];
      this.unackedShots = [];
      this.unackedBombs = [];
      this.predictedShotAcksPending = 0;
      this.localReloadingUntil = 0;
      this.visualOffsetX = 0;
      this.visualOffsetY = 0;
      return;
    }

    const justRespawned = !this.localAlive || forceRespawnSnap;
    this.localAlive = true;

    const prevVisualX = this.localX + this.visualOffsetX;
    const prevVisualY = this.localY + this.visualOffsetY;

    const soldier = this.physics.ensureSoldier(
      this.localUserId,
      serverState.x,
      serverState.y,
    );

    if (justRespawned) {
      this.physics.teleportSoldier(
        this.localUserId,
        serverState.x,
        serverState.y,
        serverState.vx,
        serverState.vy,
      );
      soldier.jetpackFuel = serverState.jetpackFuel;
      soldier.overheatedUntil =
        (serverState.flags & PLAYER_FLAG_OVERHEATED) !== 0
          ? Math.max(this.localOverheatedUntil, nowEpoch + 300)
          : 0;
      this.pendingInputs = [];
      this.unackedShots = [];
      this.unackedBombs = [];
      this.predictedShotAcksPending = 0;
      this.localReloadingUntil = 0;
      this.localX = serverState.x;
      this.localY = serverState.y;
      this.localVx = serverState.vx;
      this.localVy = serverState.vy;
      this.localFuel = serverState.jetpackFuel;
      this.localOverheatedUntil = soldier.overheatedUntil;
      this.visualOffsetX = 0;
      this.visualOffsetY = 0;
      return;
    }

    // Deadband reconciliation: if prediction & server match closely, nudge smoothly with zero pop!
    if (refSnap) {
      const dx = serverState.x - refSnap.x;
      const dy = serverState.y - refSnap.y;
      const posErr = Math.hypot(dx, dy);
      const velErr = Math.hypot(
        serverState.vx - refSnap.vx,
        serverState.vy - refSnap.vy,
      );
      const fuelDiff = Math.abs(serverState.jetpackFuel - refSnap.fuel);
      if (
        posErr <= RECONCILE_DEADBAND_PX &&
        velErr <= RECONCILE_VEL_DEADBAND_PX &&
        fuelDiff <= RECONCILE_FUEL_DEADBAND
      ) {
        if (posErr > RECONCILE_DRIFT_MIN_PX) {
          const nudgeX = dx * 0.15;
          const nudgeY = dy * 0.15;
          this.localX += nudgeX;
          this.localY += nudgeY;
          this.visualOffsetX -= nudgeX;
          this.visualOffsetY -= nudgeY;
          this.physics.teleportSoldier(
            this.localUserId,
            this.localX,
            this.localY,
            this.localVx,
            this.localVy,
          );
        }
        this.localFuel = Math.max(
          0,
          Math.min(
            100,
            this.localFuel + (serverState.jetpackFuel - refSnap.fuel) * 0.25,
          ),
        );
        soldier.jetpackFuel = this.localFuel;
        if ((serverState.flags & PLAYER_FLAG_BOOSTING) !== 0) {
          soldier.lastBoostAt = nowEpoch;
        }
        if ((serverState.flags & PLAYER_FLAG_OVERHEATED) !== 0) {
          this.localOverheatedUntil = Math.max(
            this.localOverheatedUntil,
            nowEpoch + 300,
          );
          soldier.overheatedUntil = this.localOverheatedUntil;
        }
        return;
      }
    }

    // Full authoritative rollback + replay only when server diverged significantly
    this.physics.teleportSoldier(
      this.localUserId,
      serverState.x,
      serverState.y,
      serverState.vx,
      serverState.vy,
    );
    soldier.jetpackFuel = serverState.jetpackFuel;
    if ((serverState.flags & PLAYER_FLAG_BOOSTING) !== 0) {
      soldier.lastBoostAt = this.pendingInputs[0]?.sentAt ?? nowEpoch;
    }
    soldier.overheatedUntil =
      (serverState.flags & PLAYER_FLAG_OVERHEATED) !== 0
        ? Math.max(this.localOverheatedUntil, nowEpoch + 300)
        : 0;

    // Replay unacknowledged inputs on top of authoritative server state
    const meta = this.rosterMeta.get(this.localUserId);
    const charDef = CHARACTER_CATALOG[meta?.characterId ?? "rex"];
    for (const pending of this.pendingInputs) {
      for (let i = 0; i < pending.steps; i++) {
        this.physics.applySoldierControl(
          soldier,
          {
            moveX: pending.moveX,
            boost: pending.boost,
            dropThrough: pending.dropThrough,
            isScoped: pending.isScoped,
          },
          charDef,
          POCKET_WAR_LIMITS.FIXED_DT,
          pending.sentAt,
        );
        this.physics.stepWorld(POCKET_WAR_LIMITS.FIXED_DT);
      }
    }

    const pos = soldier.body.getPosition();
    const vel = soldier.body.getLinearVelocity();
    const reconciledX = mToPx(pos.x);
    const reconciledY = mToPx(pos.y);

    const errX = prevVisualX - reconciledX;
    const errY = prevVisualY - reconciledY;
    const errDist = Math.hypot(errX, errY);

    if (errDist > RECONCILE_SNAP_THRESHOLD_PX) {
      this.visualOffsetX = 0;
      this.visualOffsetY = 0;
    } else if (errDist > RECONCILE_SMOOTH_THRESHOLD_PX) {
      this.visualOffsetX = errX;
      this.visualOffsetY = errY;
    }

    this.localX = reconciledX;
    this.localY = reconciledY;
    this.localVx = mToPx(vel.x);
    this.localVy = mToPx(vel.y);
    this.localGrounded = soldier.isGrounded;
    this.localInWater = soldier.inWater;
    this.localBoosting = soldier.isBoosting;
    this.localFuel = soldier.jetpackFuel;
    this.localOverheatedUntil = soldier.overheatedUntil;
  }

  public getLocalRenderPosition(): { x: number; y: number } {
    return {
      x: this.localX + this.visualOffsetX,
      y: this.localY + this.visualOffsetY,
    };
  }

  public isLocalAlive(): boolean {
    return this.localAlive;
  }

  public getLocalVelocity(): { vx: number; vy: number } {
    return { vx: this.localVx, vy: this.localVy };
  }

  /**
   * Produces all player states for the current render frame:
   * - Local player uses 60 Hz predicted position + smoothed reconciliation offset.
   * - Remote players use 100 ms buffered interpolation with zero teleporting.
   */
  public getRenderPlayers(
    nowPerfMs: number,
    localFrame: InputControlFrame,
  ): RenderPlayerState[] {
    const out: RenderPlayerState[] = [];
    const renderTime = nowPerfMs - INTERP_DELAY_MS;
    const { before, after, alpha, extrapSec } =
      this.findInterpBracket(renderTime);

    for (const [userId, latest] of this.latestPlayers.entries()) {
      const meta = this.rosterMeta.get(userId);
      const anim = this.getAnim(userId);
      const activeWeaponId: WeaponId =
        latest.activeSlot === 1 ? latest.weapon1 : latest.weapon0;

      if (userId === this.localUserId) {
        const localPos = this.getLocalRenderPosition();
        out.push({
          userId,
          username: meta?.username ?? "You",
          characterId: meta?.characterId ?? "rex",
          isAlive: this.localAlive,
          hp: latest.hp,
          maxHp: latest.maxHp,
          livesLeft: latest.livesLeft,
          x: localPos.x,
          y: localPos.y,
          vx: this.localVx,
          vy: this.localVy,
          aimAngle: this.localAimAngle,
          isBoosting: this.localBoosting,
          jetpackFuel: this.localFuel,
          isOverheated: Date.now() < this.localOverheatedUntil,
          isScoped: localFrame.isScoped,
          isInvulnerable: latest.invulnMsLeft > 0,
          isReloading: (latest.flags & PLAYER_FLAG_RELOADING) !== 0,
          reloadPct: latest.reloadPct,
          activeWeaponId,
          bombsLeft: latest.bombsLeft,
          runCycle: anim.runCycle,
          hitFlash: anim.hitFlash,
          muzzleFlash: anim.muzzleFlash,
          recoilOffset: anim.recoilOffset,
          meleeAnim: anim.meleeAnim,
          throwAnim: anim.throwAnim,
          inWater: this.localInWater,
          isGrounded: this.localGrounded,
        });
        continue;
      }

      const pA = before?.players.get(userId);
      const pB = after?.players.get(userId);
      let rx = latest.x;
      let ry = latest.y;
      let rvx = latest.vx;
      let rvy = latest.vy;
      let rAim = latest.aimAngle;
      let rFlags = latest.flags;

      if (pA && pB && pA !== pB) {
        const jumpDist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
        if (jumpDist > 260) {
          rx = pB.x;
          ry = pB.y;
          rAim = pB.aimAngle;
        } else {
          rx = lerp(pA.x, pB.x, alpha);
          ry = lerp(pA.y, pB.y, alpha);
          rAim = lerpAngle(pA.aimAngle, pB.aimAngle, alpha);
        }
        rvx = lerp(pA.vx, pB.vx, alpha);
        rvy = lerp(pA.vy, pB.vy, alpha);
        rFlags = alpha >= 0.5 ? pB.flags : pA.flags;
      } else if (pB && extrapSec > 0) {
        rx = pB.x + pB.vx * extrapSec;
        ry = pB.y + pB.vy * extrapSec;
        rvx = pB.vx;
        rvy = pB.vy;
        rAim = pB.aimAngle;
        rFlags = pB.flags;
      }

      const alive = (rFlags & PLAYER_FLAG_ALIVE) !== 0;

      out.push({
        userId,
        username: meta?.username ?? "Rival",
        characterId: meta?.characterId ?? "nova",
        isAlive: alive,
        hp: latest.hp,
        maxHp: latest.maxHp,
        livesLeft: latest.livesLeft,
        x: rx,
        y: ry,
        vx: rvx,
        vy: rvy,
        aimAngle: rAim,
        isBoosting: (rFlags & PLAYER_FLAG_BOOSTING) !== 0,
        jetpackFuel: latest.jetpackFuel,
        isOverheated: (rFlags & PLAYER_FLAG_OVERHEATED) !== 0,
        isScoped: (rFlags & PLAYER_FLAG_SCOPED) !== 0,
        isInvulnerable: latest.invulnMsLeft > 0,
        isReloading: (rFlags & PLAYER_FLAG_RELOADING) !== 0,
        reloadPct: latest.reloadPct,
        activeWeaponId,
        bombsLeft: latest.bombsLeft,
        runCycle: anim.runCycle,
        hitFlash: anim.hitFlash,
        muzzleFlash: anim.muzzleFlash,
        recoilOffset: anim.recoilOffset,
        meleeAnim: anim.meleeAnim,
        throwAnim: anim.throwAnim,
        inWater: (rFlags & PLAYER_FLAG_IN_WATER) !== 0,
        isGrounded: (rFlags & PLAYER_FLAG_GROUNDED) !== 0,
      });
    }

    return out;
  }

  /**
   * Produces interpolated server rockets & bouncing grenades with minimal 55 ms buffer
   * plus immediate 0-ms local predicted grenade previews before the first server snapshot arrives.
   */
  public getRenderProjectiles(nowPerfMs: number): InterpolatedProjectile[] {
    const renderTime = nowPerfMs - PROJECTILE_INTERP_DELAY_MS;
    const { before, after, alpha, extrapSec } =
      this.findInterpBracket(renderTime);
    const refFrame = after ?? before;
    const out: InterpolatedProjectile[] = [];

    if (refFrame) {
      for (const [id, prB] of refFrame.projectiles.entries()) {
        const prA = before?.projectiles.get(id);
        let x = prB[2];
        let y = prB[3];
        let vx = prB[4];
        let vy = prB[5];

        if (prA && prA !== prB) {
          x = lerp(prA[2], prB[2], alpha);
          y = lerp(prA[3], prB[3], alpha);
          vx = lerp(prA[4], prB[4], alpha);
          vy = lerp(prA[5], prB[5], alpha);
        } else if (extrapSec > 0) {
          x += vx * extrapSec;
          y += vy * extrapSec;
        }

        out.push({
          id,
          kind: prB[1],
          x,
          y,
          vx,
          vy,
          killWeaponIdx: prB[6],
        });
      }
    }

    for (const pg of this.predictedProjectiles) {
      out.push({
        id: pg.id,
        kind: pg.kind,
        x: pg.x,
        y: pg.y,
        vx: pg.vx,
        vy: pg.vy,
        killWeaponIdx: pg.killWeaponIdx,
      });
    }

    return out;
  }

  private findInterpBracket(renderTime: number): {
    before: BufferedSnapshotFrame | null;
    after: BufferedSnapshotFrame | null;
    alpha: number;
    extrapSec: number;
  } {
    const buf = this.snapshotBuffer;
    if (buf.length === 0) {
      return { before: null, after: null, alpha: 0, extrapSec: 0 };
    }
    if (buf.length === 1) {
      const only = buf[0]!;
      const extrap = Math.max(
        0,
        Math.min(MAX_EXTRAPOLATION_MS, renderTime - only.receivedAt),
      );
      return {
        before: only,
        after: only,
        alpha: 1,
        extrapSec: extrap / 1000,
      };
    }

    const first = buf[0]!;
    if (renderTime <= first.receivedAt) {
      return { before: first, after: first, alpha: 0, extrapSec: 0 };
    }

    const last = buf[buf.length - 1]!;
    if (renderTime >= last.receivedAt) {
      const extrap = Math.max(
        0,
        Math.min(MAX_EXTRAPOLATION_MS, renderTime - last.receivedAt),
      );
      return {
        before: last,
        after: last,
        alpha: 1,
        extrapSec: extrap / 1000,
      };
    }

    for (let i = buf.length - 2; i >= 0; i--) {
      const a = buf[i]!;
      const b = buf[i + 1]!;
      if (renderTime >= a.receivedAt && renderTime <= b.receivedAt) {
        const span = Math.max(1, b.receivedAt - a.receivedAt);
        return {
          before: a,
          after: b,
          alpha: Math.max(0, Math.min(1, (renderTime - a.receivedAt) / span)),
          extrapSec: 0,
        };
      }
    }

    return { before: last, after: last, alpha: 1, extrapSec: 0 };
  }

  public buildHudTelemetry(
    localFrame: InputControlFrame,
    nowEpoch: number,
  ): HudTelemetry {
    const me = this.latestPlayers.get(this.localUserId);
    const meta = this.rosterMeta.get(this.localUserId);
    const charDef = CHARACTER_CATALOG[meta?.characterId ?? "rex"];

    const activeSlot =
      this.localSwitchOverride && nowEpoch < this.localSwitchOverride.until
        ? this.localSwitchOverride.slot
        : me
          ? me.activeSlot
          : localFrame.activeSlot;
    const primaryWeaponId = me ? me.weapon0 : charDef.primaryWeaponId;
    const secondaryWeaponId = me ? me.weapon1 : charDef.secondaryWeaponId;
    const activeWeaponId =
      activeSlot === 1 ? secondaryWeaponId : primaryWeaponId;
    const def = WEAPON_CATALOG[activeWeaponId];
    const wState = this.resolveLocalWeaponState(localFrame, nowEpoch);

    let nearbyPickupLabel: string | null = null;
    if (this.localAlive) {
      for (const pad of this.map.pickupPads) {
        const cdUntil = this.pickupCooldownUntil.get(pad.id) ?? 0;
        if (cdUntil > nowEpoch) continue;
        if (
          Math.hypot(this.localX - pad.x, this.localY - pad.y) <=
          POCKET_WAR_LIMITS.PICKUP_RADIUS + 42
        ) {
          if (pad.kind === "medkit" && (me?.hp ?? 0) >= (me?.maxHp ?? 100)) {
            continue;
          }
          if (
            pad.kind === "grenade_pack" &&
            (me?.bombsLeft ?? 0) >= POCKET_WAR_LIMITS.MAX_GRENADES
          ) {
            continue;
          }
          const padWeaponMap: Partial<Record<typeof pad.kind, WeaponId>> = {
            weapon_spas12: "spas12",
            weapon_barrett50: "barrett50",
            weapon_rpg7: "rpg7",
            weapon_m4a1: "m4a1",
          };
          const padWeaponId = padWeaponMap[pad.kind];
          if (
            padWeaponId &&
            me &&
            activeWeaponId === padWeaponId &&
            me.ammo >= def.magSize &&
            me.reserveAmmo >= def.defaultReserveAmmo
          ) {
            continue;
          }
          nearbyPickupLabel = padWeaponId ? `Pick up ${pad.label}` : pad.label;
          break;
        }
      }
    }

    let alivePlayersCount = 0;
    for (const p of this.latestPlayers.values()) {
      if ((p.flags & PLAYER_FLAG_ALIVE) !== 0) {
        alivePlayersCount += 1;
      }
    }

    const bombElapsed = nowEpoch - this.lastLocalBombAt;
    const bombCooldownRatio = Math.max(
      0,
      Math.min(1, bombElapsed / POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS),
    );
    const isOverheated = nowEpoch < this.localOverheatedUntil;

    return {
      hp: me?.hp ?? charDef.maxHp,
      maxHp: me?.maxHp ?? charDef.maxHp,
      isAlive: this.localAlive,
      livesLeft: me?.livesLeft ?? POCKET_WAR_LIMITS.STARTING_LIVES,
      maxLives: POCKET_WAR_LIMITS.STARTING_LIVES,
      respawnSecondsLeft: me ? Math.ceil(me.respawnMsLeft / 1000) : 0,
      isInvulnerable: (me?.invulnMsLeft ?? 0) > 0,
      jetpackFuel: Math.round(this.localFuel),
      isBoosting: this.localBoosting,
      isOverheated,
      isLowFuel: this.localFuel < 25 || isOverheated,
      activeSlot,
      primaryWeaponId,
      secondaryWeaponId,
      activeWeaponId,
      ammo: wState.predictedAmmo,
      magSize: def.magSize,
      reserveAmmo: wState.predictedReserve,
      isReloading: wState.isReloading,
      reloadProgress: wState.isReloading
        ? Math.max(
            (me?.reloadPct ?? 0) / 100,
            this.localReloadingUntil > nowEpoch
              ? 1 - (this.localReloadingUntil - nowEpoch) / def.reloadTimeMs
              : 0,
          )
        : 0,
      bombsLeft: wState.predictedBombsLeft,
      maxBombs: POCKET_WAR_LIMITS.MAX_GRENADES,
      bombCooldownRatio,
      isScoped: localFrame.isScoped,
      kills: me?.kills ?? 0,
      deaths: me?.deaths ?? 0,
      damageDealt: me?.damageDealt ?? 0,
      nearbyPickupLabel,
      soloWaitEndsAt: this.soloWaitEndsAt,
      alivePlayersCount,
    };
  }

  public buildScoreRows(): PlayerScoreRow[] {
    const rows: PlayerScoreRow[] = [];
    for (const [userId, snap] of this.latestPlayers.entries()) {
      const meta = this.rosterMeta.get(userId);
      rows.push({
        userId,
        username: meta?.username ?? "Player",
        characterId: meta?.characterId ?? "rex",
        isAlive: (snap.flags & PLAYER_FLAG_ALIVE) !== 0,
        livesLeft: snap.livesLeft,
        kills: snap.kills,
        deaths: snap.deaths,
        damageDealt: snap.damageDealt,
        connected: meta?.connected ?? true,
      });
    }
    rows.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      if (b.livesLeft !== a.livesLeft) return b.livesLeft - a.livesLeft;
      return b.damageDealt - a.damageDealt;
    });
    return rows;
  }
}
