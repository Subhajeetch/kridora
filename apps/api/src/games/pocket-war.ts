import type { RoomPlayer } from "@kridora/shared";
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
  PW_BIN_TYPE_SNAPSHOT,
  PocketWarPhysicsWorld,
  WEAPON_CATALOG,
  computeGrenadeLaunch,
  decodeClientInput,
  encodeServerSnapshot,
  killWeaponIdToIndex,
  mToPx,
  materialToIndex,
  packPlayerTuple,
  pickRandomMapId,
  pickupKindToIndex,
  pocketWarActionPayloadSchema,
  sanitizeChatMessage,
  type ClientInputPacket,
  type DestructibleBlockState,
  type KillWeaponIconId,
  type PickupPadState,
  type PlayerHitboxTarget,
  type PocketWarCharacterId,
  type PocketWarKillFeedEntry,
  type PocketWarMapId,
  type PocketWarPlayer,
  type PocketWarState,
  type SnapshotEventTuple,
  type SnapshotProjectileTuple,
  type WeaponId,
  type WeaponSlotState,
} from "@kridora/shared/games/pocket-war";
import type {
  GameActionContext,
  RealtimeTickContext,
  ServerGameModule,
} from "./types";

interface ActiveRocket {
  id: number;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  damage: number;
  blastRadius: number;
  knockback: number;
}

interface PositionHistoryFrame {
  tick: number;
  positions: Map<string, { x: number; y: number }>;
}

interface QueuedPlayerInput {
  packet: ClientInputPacket;
  remainingSteps: number;
}

interface LiveMatchRuntime {
  mapId: PocketWarMapId;
  physics: PocketWarPhysicsWorld;
  tick: number;
  accumulator: number;
  simTimeMs: number;
  nextProjId: number;
  lastInputs: Map<string, ClientInputPacket>;
  highestSeqByUser: Map<string, number>;
  inputQueues: Map<string, QueuedPlayerInput[]>;
  extrapolatedSteps: Map<string, number>;
  latchedFlags: Map<string, number>;
  lastAcks: Record<string, number>;
  lastShotAt: Map<string, number>;
  waterNextDamageAt: Map<string, number>;
  rockets: ActiveRocket[];
  pendingEvents: SnapshotEventTuple[];
  pendingKillFeed: PocketWarKillFeedEntry[];
  history: PositionHistoryFrame[];
}

const runtimes = new Map<string, LiveMatchRuntime>();
const RECENT_DEATH_WINDOW_MS = 10_000;
const RECENT_SPAWN_WINDOW_MS = 8_000;
const MAX_LAG_COMP_TICKS = 4; // Up to 200ms rewind at 20 Hz ticks
const WATER_DAMAGE_INTERVAL_MS = 5_000;
const WATER_DAMAGE_AMOUNT = 10;
const EDGE_TRIGGER_FLAGS =
  INPUT_FLAG_SHOOT |
  INPUT_FLAG_RELOAD |
  INPUT_FLAG_THROW_BOMB |
  INPUT_FLAG_MELEE |
  INPUT_FLAG_SWITCH_WEAPON |
  INPUT_FLAG_PICKUP;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createWeaponSlot(weaponId: WeaponId): WeaponSlotState {
  const def = WEAPON_CATALOG[weaponId];
  return {
    weaponId,
    ammo: def.magSize,
    reserveAmmo: def.defaultReserveAmmo,
    reloadingUntil: 0,
  };
}

function createStarterLoadout(
  characterId: PocketWarCharacterId,
): [WeaponSlotState, WeaponSlotState] {
  const charDef = CHARACTER_CATALOG[characterId];
  return [
    createWeaponSlot(charDef.primaryWeaponId),
    createWeaponSlot(charDef.secondaryWeaponId),
  ];
}

function buildBlocksForMap(
  mapId: PocketWarMapId,
): Record<string, DestructibleBlockState> {
  const map = MAP_CATALOG[mapId];
  const blocks: Record<string, DestructibleBlockState> = {};
  for (const def of map.destructibles) {
    blocks[def.id] = { ...def, hp: def.maxHp, destroyed: false };
  }
  return blocks;
}

function buildPickupsForMap(
  mapId: PocketWarMapId,
): Record<string, PickupPadState> {
  const map = MAP_CATALOG[mapId];
  const pickups: Record<string, PickupPadState> = {};
  for (const pad of map.pickupPads) {
    pickups[pad.id] = { ...pad, availableAt: 0 };
  }
  return pickups;
}

function createDefaultPlayer(
  member: { userId: string; username: string },
  spawnIndex: number,
  mapId: PocketWarMapId,
): PocketWarPlayer {
  const defaultChar: PocketWarCharacterId =
    spawnIndex % 2 === 0 ? "rex" : "nova";
  const charDef = CHARACTER_CATALOG[defaultChar];
  const spawns = MAP_CATALOG[mapId].spawnPoints;
  const spawn = spawns[spawnIndex % spawns.length] ?? { x: 680, y: 390 };

  return {
    userId: member.userId,
    username: member.username,
    characterId: defaultChar,
    isReady: false,
    leftMatch: false,
    isAlive: true,
    livesLeft: POCKET_WAR_LIMITS.STARTING_LIVES,
    maxLives: POCKET_WAR_LIMITS.STARTING_LIVES,
    deaths: 0,
    eliminatedAt: null,
    respawnAt: null,
    invulnerableUntil: 0,
    placement: null,
    hp: charDef.maxHp,
    maxHp: charDef.maxHp,
    lastDamagedAt: 0,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    isBoosting: false,
    jetpackFuel: 100,
    jetpackOverheatedUntil: 0,
    isScoped: false,
    activeSlot: 0,
    weapons: createStarterLoadout(defaultChar),
    bombsLeft: charDef.startingBombs,
    lastBombAt: 0,
    lastMeleeAt: 0,
    kills: 0,
    damageDealt: 0,
  };
}

function completeReloadIfReady(slot: WeaponSlotState, now: number): void {
  if (slot.reloadingUntil <= 0 || now < slot.reloadingUntil) return;
  const def = WEAPON_CATALOG[slot.weaponId];
  const needed = Math.max(0, def.magSize - slot.ammo);
  if (slot.reserveAmmo === -1) {
    slot.ammo = def.magSize;
  } else {
    const taken = Math.min(needed, slot.reserveAmmo);
    slot.ammo += taken;
    slot.reserveAmmo -= taken;
  }
  slot.reloadingUntil = 0;
}

function startReload(slot: WeaponSlotState, now: number): boolean {
  if (slot.reloadingUntil > 0 && now < slot.reloadingUntil) return false;
  const def = WEAPON_CATALOG[slot.weaponId];
  if (slot.ammo >= def.magSize || slot.reserveAmmo === 0) return false;
  slot.reloadingUntil = now + def.reloadTimeMs;
  return true;
}

function getOrCreateRuntime(
  roomCode: string,
  state: PocketWarState,
): LiveMatchRuntime {
  const existing = runtimes.get(roomCode);
  if (existing && existing.mapId === state.settings.mapId) {
    return existing;
  }
  const map = MAP_CATALOG[state.settings.mapId];
  const physics = new PocketWarPhysicsWorld(map, state.blocks);
  for (const p of Object.values(state.players)) {
    if (p.isAlive) {
      const s = physics.ensureSoldier(p.userId, p.x, p.y);
      s.jetpackFuel = p.jetpackFuel;
      s.overheatedUntil = p.jetpackOverheatedUntil;
    }
  }
  const rt: LiveMatchRuntime = {
    mapId: state.settings.mapId,
    physics,
    tick: 0,
    accumulator: 0,
    simTimeMs: Date.now(),
    nextProjId: 1,
    lastInputs: new Map(),
    highestSeqByUser: new Map(),
    inputQueues: new Map(),
    extrapolatedSteps: new Map(),
    latchedFlags: new Map(),
    lastAcks: {},
    lastShotAt: new Map(),
    waterNextDamageAt: new Map(),
    rockets: [],
    pendingEvents: [],
    pendingKillFeed: [],
    history: [],
  };
  runtimes.set(roomCode, rt);
  return rt;
}

function selectSafeSpawnPoint(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  respawningUserId: string,
  now: number,
): { x: number; y: number } {
  const map = MAP_CATALOG[state.settings.mapId];
  const spawns = map.spawnPoints;
  if (spawns.length === 0) return { x: 680, y: 390 };

  const livingEnemies = Object.values(state.players).filter(
    (p) => p.isAlive && p.userId !== respawningUserId,
  );
  state.recentDeaths = state.recentDeaths.filter(
    (d) => now - d.at <= RECENT_DEATH_WINDOW_MS,
  );

  const scored = spawns.map((pt, index) => {
    let score = 0;
    if (livingEnemies.length > 0) {
      let minDist = Number.POSITIVE_INFINITY;
      let totalDist = 0;
      for (const enemy of livingEnemies) {
        const dist = Math.hypot(pt.x - enemy.x, pt.y - enemy.y);
        if (dist < minDist) minDist = dist;
        totalDist += dist;
        if (dist < 420) score -= 1200 * (1 - dist / 420) + 450;
        if (
          dist < 1200 &&
          rt.physics.hasClearLineOfSight(enemy.x, enemy.y, pt.x, pt.y)
        ) {
          score -= 480;
        }
      }
      score += Math.min(minDist, 1200) * 1.1;
      score += Math.min(totalDist / livingEnemies.length, 1400) * 0.35;
    } else {
      score = 1000;
    }

    for (const d of state.recentDeaths) {
      const dist = Math.hypot(pt.x - d.x, pt.y - d.y);
      if (dist < 320) {
        const freshness = Math.max(
          0,
          1 - (now - d.at) / RECENT_DEATH_WINDOW_MS,
        );
        score -= 400 * freshness;
      }
    }

    const lastUsed = state.recentSpawns[index];
    if (lastUsed !== undefined && now - lastUsed < RECENT_SPAWN_WINDOW_MS) {
      score -= 360 * (1 - (now - lastUsed) / RECENT_SPAWN_WINDOW_MS);
    }

    score += Math.random() * 20;
    return { pt, index, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0]!;
  state.recentSpawns[chosen.index] = now;
  return chosen.pt;
}

function respawnPlayer(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  player: PocketWarPlayer,
  now: number,
): void {
  const charDef = CHARACTER_CATALOG[player.characterId];
  const pt = selectSafeSpawnPoint(state, rt, player.userId, now);

  player.isAlive = true;
  player.respawnAt = null;
  player.hp = charDef.maxHp;
  player.maxHp = charDef.maxHp;
  player.lastDamagedAt = now;
  player.x = pt.x;
  player.y = pt.y;
  player.vx = 0;
  player.vy = 0;
  player.isBoosting = false;
  player.isScoped = false;
  player.jetpackFuel = 100;
  player.jetpackOverheatedUntil = 0;
  player.invulnerableUntil = now + POCKET_WAR_LIMITS.SPAWN_PROTECTION_MS;
  player.activeSlot = 0;
  player.weapons = createStarterLoadout(player.characterId);
  player.bombsLeft = Math.max(player.bombsLeft, 2);

  rt.inputQueues.delete(player.userId);
  rt.extrapolatedSteps.delete(player.userId);
  rt.physics.teleportSoldier(player.userId, pt.x, pt.y, 0, 0);
  const s = rt.physics.getSoldier(player.userId);
  if (s) {
    s.jetpackFuel = 100;
    s.overheatedUntil = 0;
  }

  rt.pendingEvents.push([
    EVENT_KIND_PLAYER_RESPAWN,
    Math.round(pt.x),
    Math.round(pt.y),
    0,
    0,
    player.userId,
    player.userId,
    0,
    0,
  ]);
}

function launchMatch(
  roomCode: string,
  state: PocketWarState,
  now: number,
): void {
  const allPlayers = Object.values(state.players);
  if (allPlayers.length < POCKET_WAR_LIMITS.MIN_PLAYERS) return;

  const map = MAP_CATALOG[state.settings.mapId];
  state.blocks = buildBlocksForMap(state.settings.mapId);
  state.pickups = buildPickupsForMap(state.settings.mapId);
  state.killFeed = [];
  state.recentEvents = [];
  state.recentDeaths = [];
  state.recentSpawns = {};
  state.winnerUserId = null;
  state.mvpUserId = null;
  state.setupCountdownEndsAt = null;
  state.soloWaitEndsAt = null;

  const step = Math.max(
    1,
    Math.floor(map.spawnPoints.length / Math.max(1, allPlayers.length)),
  );
  const offset = Math.floor(Math.random() * map.spawnPoints.length);

  allPlayers.forEach((player, idx) => {
    const charDef = CHARACTER_CATALOG[player.characterId];
    const spawnIdx = (offset + idx * step) % map.spawnPoints.length;
    const spawn = map.spawnPoints[spawnIdx] ?? { x: 680, y: 390 };
    state.recentSpawns[spawnIdx] = now;

    player.isAlive = true;
    player.livesLeft = POCKET_WAR_LIMITS.STARTING_LIVES;
    player.maxLives = POCKET_WAR_LIMITS.STARTING_LIVES;
    player.deaths = 0;
    player.eliminatedAt = null;
    player.respawnAt = null;
    player.invulnerableUntil = now + POCKET_WAR_LIMITS.SPAWN_PROTECTION_MS;
    player.placement = null;
    player.hp = charDef.maxHp;
    player.maxHp = charDef.maxHp;
    player.lastDamagedAt = now;
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.aimAngle = spawn.x > map.width * 0.5 ? Math.PI : 0;
    player.isBoosting = false;
    player.isScoped = false;
    player.jetpackFuel = 100;
    player.jetpackOverheatedUntil = 0;
    player.activeSlot = 0;
    player.weapons = createStarterLoadout(player.characterId);
    player.bombsLeft = charDef.startingBombs;
    player.lastBombAt = 0;
    player.lastMeleeAt = 0;
    player.kills = 0;
    player.damageDealt = 0;
  });

  state.phase = "playing";
  state.matchStartedAt = now;
  runtimes.delete(roomCode);
  getOrCreateRuntime(roomCode, state);
}

function updateSetupCountdown(
  roomCode: string,
  state: PocketWarState,
  now: number,
): void {
  if (state.phase !== "setup") return;
  const allPlayers = Object.values(state.players);
  const everyoneReady =
    allPlayers.length >= POCKET_WAR_LIMITS.MIN_PLAYERS &&
    allPlayers.every((p) => p.isReady);

  if (everyoneReady) {
    if (state.setupCountdownEndsAt === null) {
      state.setupCountdownEndsAt = now + POCKET_WAR_LIMITS.SETUP_COUNTDOWN_MS;
    } else if (now >= state.setupCountdownEndsAt) {
      launchMatch(roomCode, state, now);
    }
  } else {
    state.setupCountdownEndsAt = null;
  }
}

function applyAuthoritativeDamage(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  attackerId: string,
  victimId: string,
  damage: number,
  weaponId: KillWeaponIconId,
  weaponLabel: string,
  impulseX: number,
  impulseY: number,
  now: number,
): boolean {
  const victim = state.players[victimId];
  const attacker = state.players[attackerId];
  if (!victim || !victim.isAlive) return false;
  if (now < victim.invulnerableUntil) return false;

  const finalDmg = Math.max(1, Math.round(damage));
  victim.hp = Math.max(0, victim.hp - finalDmg);
  victim.lastDamagedAt = now;

  if (attacker && attacker.userId !== victim.userId) {
    attacker.damageDealt += finalDmg;
  }

  rt.physics.applySoldierImpulse(victimId, impulseX * 0.55, impulseY * 0.55);

  rt.pendingEvents.push([
    EVENT_KIND_HIT,
    Math.round(victim.x),
    Math.round(victim.y),
    killWeaponIdToIndex(weaponId),
    finalDmg,
    attackerId,
    victimId,
    Math.round(impulseX),
    Math.round(impulseY),
  ]);

  if (victim.hp <= 0) {
    victim.isAlive = false;
    victim.deaths += 1;
    victim.livesLeft = Math.max(0, victim.livesLeft - 1);
    victim.isBoosting = false;
    victim.isScoped = false;
    rt.physics.removeSoldier(victimId);

    state.recentDeaths.push({ x: victim.x, y: victim.y, at: now });
    if (state.recentDeaths.length > 24) {
      state.recentDeaths = state.recentDeaths.slice(-24);
    }

    if (victim.livesLeft > 0) {
      victim.respawnAt = now + POCKET_WAR_LIMITS.RESPAWN_DELAY_MS;
      victim.eliminatedAt = null;
    } else {
      const contendersRemaining = Object.values(state.players).filter(
        (p) => p.livesLeft > 0,
      ).length;
      victim.eliminatedAt = now;
      victim.respawnAt = null;
      victim.placement = contendersRemaining + 1;
    }

    if (attacker && attacker.userId !== victim.userId) {
      attacker.kills += 1;
    }

    const kfEntry: PocketWarKillFeedEntry = {
      id: makeId("kf"),
      killerId: attackerId,
      killerName: attacker ? attacker.username : "Jungle Hazard",
      victimId: victim.userId,
      victimName: victim.username,
      weaponId,
      weaponLabel,
      timestamp: now,
    };
    state.killFeed.unshift(kfEntry);
    if (state.killFeed.length > 8) {
      state.killFeed = state.killFeed.slice(0, 8);
    }
    rt.pendingKillFeed.push(kfEntry);

    rt.pendingEvents.push([
      EVENT_KIND_PLAYER_DEATH,
      Math.round(victim.x),
      Math.round(victim.y),
      killWeaponIdToIndex(weaponId),
      0,
      attackerId,
      victimId,
      Math.round(impulseX),
      Math.round(impulseY),
    ]);
    return true;
  }

  return false;
}

function applyAuthoritativeExplosion(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  actorId: string,
  x: number,
  y: number,
  radius: number,
  maxDamage: number,
  weaponId: KillWeaponIconId,
  weaponLabel: string,
  now: number,
  depth = 0,
): boolean {
  if (depth > 4) return false;
  let someoneDied = false;

  rt.pendingEvents.push([
    EVENT_KIND_EXPLOSION,
    Math.round(x),
    Math.round(y),
    Math.round(radius),
    killWeaponIdToIndex(weaponId),
    actorId,
    "",
    0,
    0,
  ]);

  for (const player of Object.values(state.players)) {
    if (!player.isAlive) continue;
    const dx = player.x - x;
    const dy = player.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) continue;

    const falloff = 1 - dist / radius;
    const dmg = Math.max(10, Math.round(maxDamage * (0.34 + 0.66 * falloff)));
    const nx = dist > 1 ? dx / dist : 0;
    const ny = dist > 1 ? dy / dist : -1;
    const selfScale = player.userId === actorId ? 0.55 : 1;

    if (
      applyAuthoritativeDamage(
        state,
        rt,
        actorId,
        player.userId,
        dmg * selfScale,
        weaponId,
        weaponLabel,
        nx * 470 * falloff,
        (ny - 0.35) * 470 * falloff,
        now,
      )
    ) {
      someoneDied = true;
    }
  }

  const triggeredBarrels: DestructibleBlockState[] = [];
  for (const block of Object.values(state.blocks)) {
    if (block.destroyed) continue;
    const cx = block.x + block.width * 0.5;
    const cy = block.y + block.height * 0.5;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist > radius + Math.max(block.width, block.height) * 0.5) continue;

    const falloff = Math.max(0.28, 1 - dist / (radius + 60));
    block.hp -= Math.round(maxDamage * 1.45 * falloff);
    if (block.hp <= 0) {
      block.hp = 0;
      block.destroyed = true;
      rt.physics.removeBlock(block.id);
      rt.pendingEvents.push([
        EVENT_KIND_BLOCK_BREAK,
        Math.round(cx),
        Math.round(cy),
        materialToIndex(block.material),
        0,
        actorId,
        block.id,
        0,
        0,
      ]);
      if (block.material === "barrel") {
        triggeredBarrels.push(block);
      }
    }
  }

  for (const barrel of triggeredBarrels) {
    if (
      applyAuthoritativeExplosion(
        state,
        rt,
        actorId,
        barrel.x + barrel.width * 0.5,
        barrel.y + barrel.height * 0.5,
        165,
        64,
        "barrel",
        "Fuel Barrel",
        now,
        depth + 1,
      )
    ) {
      someoneDied = true;
    }
  }

  return someoneDied;
}

function getLagCompensatedTargets(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  clientTick: number,
  now: number,
): PlayerHitboxTarget[] {
  const rewindTicks = Math.max(
    0,
    Math.min(MAX_LAG_COMP_TICKS, rt.tick - clientTick),
  );
  const targetTick = rt.tick - rewindTicks;
  const frame =
    rewindTicks > 0
      ? (rt.history.find((h) => h.tick === targetTick) ??
        rt.history[rt.history.length - 1])
      : undefined;

  const targets: PlayerHitboxTarget[] = [];
  for (const p of Object.values(state.players)) {
    if (!p.isAlive || now < p.invulnerableUntil) continue;
    const histPos = frame?.positions.get(p.userId);
    targets.push({
      userId: p.userId,
      x: histPos ? histPos.x : p.x,
      y: histPos ? histPos.y : p.y,
      radius: POCKET_WAR_LIMITS.PLAYER_RADIUS_PX + 7,
    });
  }
  return targets;
}

function damageBlock(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  actorId: string,
  blockId: string,
  dmg: number,
  now: number,
): boolean {
  const block = state.blocks[blockId];
  if (!block || block.destroyed) return false;
  block.hp -= Math.round(dmg);
  if (block.hp <= 0) {
    block.hp = 0;
    block.destroyed = true;
    rt.physics.removeBlock(blockId);
    const cx = block.x + block.width * 0.5;
    const cy = block.y + block.height * 0.5;
    rt.pendingEvents.push([
      EVENT_KIND_BLOCK_BREAK,
      Math.round(cx),
      Math.round(cy),
      materialToIndex(block.material),
      0,
      actorId,
      blockId,
      0,
      0,
    ]);
    if (block.material === "barrel") {
      return applyAuthoritativeExplosion(
        state,
        rt,
        actorId,
        cx,
        cy,
        165,
        64,
        "barrel",
        "Fuel Barrel",
        now,
      );
    }
  }
  return false;
}

function tryCollectPickups(
  state: PocketWarState,
  rt: LiveMatchRuntime,
  player: PocketWarPlayer,
  now: number,
  manualPickupRequested: boolean,
): void {
  const autoCollectRadius = POCKET_WAR_LIMITS.PICKUP_RADIUS + 20;
  const promptCollectRadius = POCKET_WAR_LIMITS.PICKUP_RADIUS + 42;

  for (const pad of Object.values(state.pickups)) {
    if (now < pad.availableAt) continue;
    const dist = Math.hypot(player.x - pad.x, player.y - pad.y);
    const isSupply = pad.kind === "medkit" || pad.kind === "grenade_pack";
    const canCollectNow = manualPickupRequested
      ? dist <= promptCollectRadius
      : isSupply && dist <= autoCollectRadius;
    if (!canCollectNow) continue;

    let consumed = false;
    if (pad.kind === "medkit") {
      if (player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 45);
        consumed = true;
      }
    } else if (pad.kind === "grenade_pack") {
      if (player.bombsLeft < POCKET_WAR_LIMITS.MAX_GRENADES) {
        player.bombsLeft = Math.min(
          POCKET_WAR_LIMITS.MAX_GRENADES,
          player.bombsLeft + 2,
        );
        consumed = true;
      }
    } else {
      const weaponMap: Record<
        "weapon_spas12" | "weapon_barrett50" | "weapon_rpg7" | "weapon_m4a1",
        WeaponId
      > = {
        weapon_spas12: "spas12",
        weapon_barrett50: "barrett50",
        weapon_rpg7: "rpg7",
        weapon_m4a1: "m4a1",
      };
      const nextWeaponId = weaponMap[pad.kind];
      const nextDef = WEAPON_CATALOG[nextWeaponId];
      const existingIdx: 0 | 1 | null =
        player.weapons[0].weaponId === nextWeaponId
          ? 0
          : player.weapons[1].weaponId === nextWeaponId
            ? 1
            : null;

      if (existingIdx !== null) {
        const existingSlot = player.weapons[existingIdx];
        if (
          existingSlot.ammo < nextDef.magSize ||
          existingSlot.reserveAmmo < nextDef.defaultReserveAmmo
        ) {
          existingSlot.ammo = nextDef.magSize;
          existingSlot.reserveAmmo = nextDef.defaultReserveAmmo;
          existingSlot.reloadingUntil = 0;
          player.activeSlot = existingIdx;
          consumed = true;
        }
      } else {
        player.weapons[player.activeSlot] = createWeaponSlot(nextWeaponId);
        consumed = true;
      }
    }

    if (consumed) {
      pad.availableAt = now + POCKET_WAR_LIMITS.PICKUP_RESPAWN_MS;
      rt.pendingEvents.push([
        EVENT_KIND_PICKUP,
        Math.round(pad.x),
        Math.round(pad.y),
        pickupKindToIndex(pad.kind),
        0,
        player.userId,
        pad.id,
        0,
        0,
      ]);
      if (manualPickupRequested) break;
    }
  }
}

function getRemainingMatchParticipants(
  state: PocketWarState,
): PocketWarPlayer[] {
  return Object.values(state.players).filter(
    (p) => !p.leftMatch && state.onlineUserIds.includes(p.userId),
  );
}

function syncSoloWaitState(state: PocketWarState, now: number): void {
  if (state.phase !== "playing") return;
  const nonLeftPlayers = Object.values(state.players).filter(
    (p) => !p.leftMatch,
  );
  const activeOnlineCount = nonLeftPlayers.filter((p) =>
    state.onlineUserIds.includes(p.userId),
  ).length;
  if (activeOnlineCount === 1 && nonLeftPlayers.length >= 2) {
    state.soloWaitEndsAt =
      state.soloWaitEndsAt ?? now + POCKET_WAR_LIMITS.SOLO_WAIT_GRACE_MS;
  } else {
    state.soloWaitEndsAt = null;
  }
}

type MatchCompletionContext = Pick<
  RealtimeTickContext<PocketWarState>,
  "roomCode" | "state" | "setState" | "broadcastState" | "completeMatch"
> & {
  persistState?: () => Promise<void>;
};

async function checkAndCompleteMatch(
  ctx: MatchCompletionContext,
): Promise<boolean> {
  const { state } = ctx;
  if (state.phase !== "playing") return false;
  if (state.soloWaitEndsAt !== null) return false;

  const allPlayers = Object.values(state.players);
  const contenders = allPlayers.filter((p) => p.livesLeft > 0);
  if (contenders.length > 1) return false;

  const sorted = [...allPlayers].sort((a, b) => {
    if (a.livesLeft !== b.livesLeft) return b.livesLeft - a.livesLeft;
    if ((a.eliminatedAt ?? 0) !== (b.eliminatedAt ?? 0)) {
      return (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0);
    }
    if (a.kills !== b.kills) return b.kills - a.kills;
    return b.damageDealt - a.damageDealt;
  });

  const winner = contenders[0] ?? sorted[0] ?? null;
  state.winnerUserId = winner ? winner.userId : null;

  let mvpId: string | null = null;
  let bestMetric = -1;
  const rawPlacements = sorted.map((p, idx) => {
    const rank = idx + 1;
    p.placement = rank;
    const score =
      p.kills * 150 +
      Math.max(0, (sorted.length - rank) * 60) +
      p.livesLeft * 45 +
      Math.round(p.damageDealt * 0.45);
    const metric = p.kills * 160 + p.damageDealt * 0.6 + p.livesLeft * 40;
    if (metric > bestMetric) {
      bestMetric = metric;
      mvpId = p.userId;
    }
    return { userId: p.userId, rank, score };
  });

  state.mvpUserId = mvpId;
  state.phase = "game_over";
  runtimes.delete(ctx.roomCode);

  await ctx.completeMatch({
    winnerUserId: state.winnerUserId,
    placements: rawPlacements.map((p) => ({
      userId: p.userId,
      placement: p.rank,
      xpReward: Math.round(p.score * 1.4) + (p.userId === mvpId ? 60 : 0),
      ringsReward:
        (p.rank === 1 ? 55 : p.rank === 2 ? 30 : 12) +
        (p.userId === mvpId ? 15 : 0),
    })),
  });

  ctx.setState(state);
  ctx.broadcastState();
  await ctx.persistState?.();
  return true;
}

export const pocketWarGameModule: ServerGameModule<PocketWarState> = {
  slug: "pocket-war",
  eventPrefix: "pocket-war",
  stateEvent: "pocket-war:state",
  tickIntervalMs: POCKET_WAR_LIMITS.SERVER_TICK_MS,
  soloWaitGraceMs: POCKET_WAR_LIMITS.SOLO_WAIT_GRACE_MS,

  createInitialState(members: readonly RoomPlayer[]): PocketWarState {
    const initialMapId = pickRandomMapId();
    const players: Record<string, PocketWarPlayer> = {};
    members.slice(0, POCKET_WAR_LIMITS.MAX_PLAYERS).forEach((member, index) => {
      players[member.userId] = createDefaultPlayer(
        { userId: member.userId, username: member.name },
        index,
        initialMapId,
      );
    });

    return {
      phase: "setup",
      settings: {
        mapId: initialMapId,
        friendlyFire: false,
      },
      setupCountdownEndsAt: null,
      matchStartedAt: null,
      soloWaitEndsAt: null,
      onlineUserIds: members.filter((m) => m.connected).map((m) => m.userId),
      winnerUserId: null,
      mvpUserId: null,
      players,
      blocks: buildBlocksForMap(initialMapId),
      pickups: buildPickupsForMap(initialMapId),
      killFeed: [],
      chatMessages: [],
      recentEvents: [],
      recentDeaths: [],
      recentSpawns: {},
      lastChatAtByUser: {},
    };
  },

  onPlayerRenamed(
    state: PocketWarState,
    userId: string,
    newName: string,
  ): boolean {
    const player = state.players[userId];
    if (player) {
      player.username = newName;
      return true;
    }
    return false;
  },

  onRoomPresenceChanged(
    state: PocketWarState,
    onlineUserIds: readonly string[],
    now: number,
  ): boolean {
    state.onlineUserIds = [...onlineUserIds];
    syncSoloWaitState(state, now);
    return true;
  },

  onPlayerLeft(state: PocketWarState, userId: string): boolean {
    const now = Date.now();
    state.onlineUserIds = state.onlineUserIds.filter((id) => id !== userId);

    if (state.phase === "setup") {
      if (state.players[userId]) {
        delete state.players[userId];
        const allPlayers = Object.values(state.players);
        if (
          allPlayers.length < POCKET_WAR_LIMITS.MIN_PLAYERS ||
          !allPlayers.every((p) => p.isReady)
        ) {
          state.setupCountdownEndsAt = null;
        }
        return true;
      }
      return false;
    }

    const leaving = state.players[userId];
    if (leaving) {
      leaving.leftMatch = true;
      if (leaving.livesLeft > 0) {
        const contendersBefore = Object.values(state.players).filter(
          (p) => p.livesLeft > 0,
        ).length;
        leaving.isAlive = false;
        leaving.livesLeft = 0;
        leaving.respawnAt = null;
        leaving.eliminatedAt = now;
        leaving.placement = contendersBefore;
      }
    }

    if (state.phase === "playing") {
      const remainingOnline = state.onlineUserIds.filter((id) => {
        const p = state.players[id];
        return Boolean(p && !p.leftMatch);
      }).length;
      if (remainingOnline === 1) {
        state.soloWaitEndsAt =
          state.soloWaitEndsAt ?? now + POCKET_WAR_LIMITS.SOLO_WAIT_GRACE_MS;
      }
    }

    return true;
  },

  onRoomDestroyed(roomCode: string): void {
    runtimes.delete(roomCode);
  },

  handleBinaryFrame(
    ctx: GameActionContext<PocketWarState>,
    bytes: Uint8Array,
  ): void {
    if (ctx.state.phase !== "playing") return;
    if (ctx.state.players[ctx.user.id]?.leftMatch) return;
    const pkt = decodeClientInput(bytes);
    if (!pkt) return;

    const rt = getOrCreateRuntime(ctx.roomCode, ctx.state);
    const highestSeq = rt.highestSeqByUser.get(ctx.user.id) ?? 0;
    const isClientReset = pkt.seq <= 3 && highestSeq > 20;
    if (pkt.seq <= highestSeq && !isClientReset) return;
    if (isClientReset) {
      rt.inputQueues.delete(ctx.user.id);
      rt.extrapolatedSteps.delete(ctx.user.id);
      rt.lastAcks[ctx.user.id] = 0;
    }

    const prevInput = rt.lastInputs.get(ctx.user.id);
    rt.highestSeqByUser.set(ctx.user.id, pkt.seq);
    rt.lastInputs.set(ctx.user.id, pkt);

    const prevLatched = rt.latchedFlags.get(ctx.user.id) ?? 0;
    rt.latchedFlags.set(
      ctx.user.id,
      prevLatched | (pkt.fl & EDGE_TRIGGER_FLAGS),
    );

    let steps = pkt.st !== undefined ? pkt.st : 2;
    const extrap = rt.extrapolatedSteps.get(ctx.user.id) ?? 0;
    if (extrap > 0) {
      if (
        prevInput &&
        prevInput.mx === pkt.mx &&
        prevInput.fl === pkt.fl &&
        steps > 0
      ) {
        const deduct = Math.min(steps, extrap);
        steps -= deduct;
        rt.extrapolatedSteps.set(ctx.user.id, extrap - deduct);
      } else {
        rt.extrapolatedSteps.set(ctx.user.id, 0);
      }
    }

    let queue = rt.inputQueues.get(ctx.user.id);
    if (!queue) {
      queue = [];
      rt.inputQueues.set(ctx.user.id, queue);
    }
    queue.push({ packet: pkt, remainingSteps: steps });

    // Prevent runaway input buffer backlog on network stalls (~200ms max queued)
    let totalQueuedSteps = 0;
    for (const item of queue) {
      totalQueuedSteps += item.remainingSteps;
    }
    while (queue.length > 1 && totalQueuedSteps > 12) {
      const dropped = queue.shift()!;
      totalQueuedSteps -= dropped.remainingSteps;
      rt.lastAcks[ctx.user.id] = dropped.packet.seq;
    }
  },

  async onTick(
    ctx: RealtimeTickContext<PocketWarState>,
    now: number,
    dtSec: number,
  ): Promise<void> {
    const { state } = ctx;

    const hasAnyLeftMatch = Object.values(state.players).some(
      (p) => p.leftMatch,
    );
    if (hasAnyLeftMatch && getRemainingMatchParticipants(state).length === 0) {
      await ctx.endMatch();
      return;
    }

    if (state.phase === "setup") {
      if (
        state.setupCountdownEndsAt !== null &&
        now >= state.setupCountdownEndsAt
      ) {
        launchMatch(ctx.roomCode, state, now);
        ctx.setState(state);
        ctx.broadcastState();
        await ctx.persistState();
      }
      return;
    }

    if (state.phase !== "playing") return;

    const rt = getOrCreateRuntime(ctx.roomCode, state);
    rt.tick += 1;

    // 1. Respawns, reloads, and passive health regeneration
    for (const player of Object.values(state.players)) {
      completeReloadIfReady(player.weapons[0], now);
      completeReloadIfReady(player.weapons[1], now);

      if (
        !player.isAlive &&
        player.livesLeft > 0 &&
        player.respawnAt !== null &&
        now >= player.respawnAt
      ) {
        respawnPlayer(state, rt, player, now);
        continue;
      }

      if (
        player.isAlive &&
        player.hp < player.maxHp &&
        !rt.waterNextDamageAt.has(player.userId) &&
        now - player.lastDamagedAt >=
          POCKET_WAR_LIMITS.HEALTH_REGEN_DELAY_MS + 500
      ) {
        const regenWindowMs =
          now - player.lastDamagedAt - POCKET_WAR_LIMITS.HEALTH_REGEN_DELAY_MS;
        const healAmount = Math.floor(
          (regenWindowMs / 1000) * POCKET_WAR_LIMITS.HEALTH_REGEN_PER_SEC,
        );
        if (healAmount > 0) {
          player.hp = Math.min(player.maxHp, player.hp + healAmount);
          player.lastDamagedAt += Math.round(
            (healAmount / POCKET_WAR_LIMITS.HEALTH_REGEN_PER_SEC) * 1000,
          );
        }
      }
    }

    // 2. Fixed 60 Hz Planck.js physics substeps via exact accumulator (prevents drift)
    rt.accumulator = Math.min(0.25, rt.accumulator + dtSec);
    let subSteps = 0;
    while (rt.accumulator >= POCKET_WAR_LIMITS.FIXED_DT && subSteps < 12) {
      rt.accumulator -= POCKET_WAR_LIMITS.FIXED_DT;
      subSteps += 1;
    }
    const subDt = POCKET_WAR_LIMITS.FIXED_DT;
    if (Math.abs(now - rt.simTimeMs) > 250) {
      rt.simTimeMs = now - subSteps * subDt * 1000;
    }

    const onlineSet = new Set(state.onlineUserIds);
    for (let step = 0; step < subSteps; step++) {
      rt.simTimeMs += subDt * 1000;
      const stepNow = Math.round(rt.simTimeMs);

      for (const player of Object.values(state.players)) {
        if (!player.isAlive || !onlineSet.has(player.userId)) {
          rt.extrapolatedSteps.delete(player.userId);
          rt.latchedFlags.delete(player.userId);
          rt.physics.holdSoldierAtRest(player.userId);
          if (!onlineSet.has(player.userId)) {
            rt.lastInputs.delete(player.userId);
            rt.inputQueues.delete(player.userId);
          } else {
            const deadQueue = rt.inputQueues.get(player.userId);
            if (deadQueue && deadQueue.length > 0) {
              const last = deadQueue[deadQueue.length - 1]!;
              rt.lastAcks[player.userId] = last.packet.seq;
              deadQueue.length = 0;
            }
          }
          continue;
        }
        const soldier = rt.physics.ensureSoldier(
          player.userId,
          player.x,
          player.y,
        );

        const queue = rt.inputQueues.get(player.userId);
        while (queue && queue.length > 0 && queue[0]!.remainingSteps <= 0) {
          const zeroStep = queue.shift()!;
          rt.lastAcks[player.userId] = zeroStep.packet.seq;
        }

        let inp: ClientInputPacket | undefined;
        if (queue && queue.length > 0) {
          const head = queue[0]!;
          inp = head.packet;
          head.remainingSteps -= 1;
          if (head.remainingSteps <= 0) {
            queue.shift();
            rt.lastAcks[player.userId] = head.packet.seq;
          }
          rt.extrapolatedSteps.set(player.userId, 0);
        } else {
          inp = rt.lastInputs.get(player.userId);
          if (inp) {
            const curExtrap = rt.extrapolatedSteps.get(player.userId) ?? 0;
            rt.extrapolatedSteps.set(player.userId, Math.min(6, curExtrap + 1));
          }
        }

        if (!inp && player.lastDamagedAt <= (state.matchStartedAt ?? 0)) {
          rt.physics.holdSoldierAtRest(player.userId);
          continue;
        }

        const charDef = CHARACTER_CATALOG[player.characterId];
        const moveX = inp ? inp.mx / 100 : 0;
        const fl = inp ? inp.fl : 0;
        const stepEv = rt.physics.applySoldierControl(
          soldier,
          {
            moveX,
            boost: (fl & INPUT_FLAG_BOOST) !== 0,
            dropThrough: (fl & INPUT_FLAG_DROP) !== 0,
            isScoped: (fl & INPUT_FLAG_SCOPED) !== 0,
          },
          charDef,
          subDt,
          stepNow,
        );

        if (stepEv.justEnteredWater || stepEv.justExitedWater) {
          const pos = soldier.body.getPosition();
          rt.pendingEvents.push([
            EVENT_KIND_WATER_SPLASH,
            Math.round(mToPx(pos.x)),
            Math.round(MAP_CATALOG[state.settings.mapId].waterSurfaceY),
            0,
            0,
            player.userId,
            "",
            0,
            0,
          ]);
        }
      }

      rt.physics.stepWorld(subDt);
    }

    // Drain any trailing zero-step packets so edge-action acks never stall
    for (const [uid, queue] of rt.inputQueues.entries()) {
      while (queue.length > 0 && queue[0]!.remainingSteps <= 0) {
        const done = queue.shift()!;
        rt.lastAcks[uid] = done.packet.seq;
      }
    }

    // 3. Read back authoritative soldier coordinates & handle discrete combat inputs
    const playerFlagsMap = new Map<string, number>();
    for (const player of Object.values(state.players)) {
      if (!player.isAlive) {
        rt.waterNextDamageAt.delete(player.userId);
        playerFlagsMap.set(player.userId, 0);
        continue;
      }

      const soldier = rt.physics.getSoldier(player.userId);
      if (soldier) {
        const pos = soldier.body.getPosition();
        const vel = soldier.body.getLinearVelocity();
        player.x = mToPx(pos.x);
        player.y = mToPx(pos.y);
        player.vx = mToPx(vel.x);
        player.vy = mToPx(vel.y);
        player.isBoosting = soldier.isBoosting;
        player.jetpackFuel = soldier.jetpackFuel;
        player.jetpackOverheatedUntil = soldier.overheatedUntil;
      }

      if (soldier?.inWater && onlineSet.has(player.userId)) {
        let nextDamageAt = rt.waterNextDamageAt.get(player.userId);
        if (nextDamageAt === undefined) {
          nextDamageAt = now + WATER_DAMAGE_INTERVAL_MS;
          rt.waterNextDamageAt.set(player.userId, nextDamageAt);
        }
        while (player.isAlive && now >= nextDamageAt) {
          nextDamageAt += WATER_DAMAGE_INTERVAL_MS;
          rt.waterNextDamageAt.set(player.userId, nextDamageAt);
          applyAuthoritativeDamage(
            state,
            rt,
            "hazard:water",
            player.userId,
            WATER_DAMAGE_AMOUNT,
            "grenade",
            "River Water",
            0,
            0,
            now,
          );
        }
        if (!player.isAlive) {
          rt.waterNextDamageAt.delete(player.userId);
          playerFlagsMap.set(player.userId, 0);
          continue;
        }
      } else {
        rt.waterNextDamageAt.delete(player.userId);
      }

      const inp = rt.lastInputs.get(player.userId);
      const latched = rt.latchedFlags.get(player.userId) ?? 0;
      rt.latchedFlags.set(player.userId, 0);
      const fl = (inp?.fl ?? 0) | latched;

      if (inp) {
        player.aimAngle = inp.aim / 1000;
        player.isScoped = (fl & INPUT_FLAG_SCOPED) !== 0;
        if ((fl & INPUT_FLAG_SWITCH_WEAPON) !== 0) {
          player.activeSlot = player.activeSlot === 0 ? 1 : 0;
        } else {
          player.activeSlot = inp.sl;
        }
      }

      const activeSlot = player.weapons[player.activeSlot];
      const weapon = WEAPON_CATALOG[activeSlot.weaponId];
      const charDef = CHARACTER_CATALOG[player.characterId];

      if ((fl & INPUT_FLAG_RELOAD) !== 0) {
        startReload(activeSlot, now);
      }

      // Pickups (auto-collect supplies on walk-over; intentional X/tap for weapons)
      tryCollectPickups(state, rt, player, now, (fl & INPUT_FLAG_PICKUP) !== 0);

      // Melee strike
      if (
        (fl & INPUT_FLAG_MELEE) !== 0 &&
        now - player.lastMeleeAt >= POCKET_WAR_LIMITS.MELEE_COOLDOWN_MS
      ) {
        player.lastMeleeAt = now;
        if (now < player.invulnerableUntil) player.invulnerableUntil = 0;

        rt.pendingEvents.push([
          EVENT_KIND_MELEE,
          Math.round(player.x),
          Math.round(player.y),
          Math.round(player.aimAngle * 1000),
          0,
          player.userId,
          "",
          0,
          0,
        ]);

        for (const target of Object.values(state.players)) {
          if (!target.isAlive || target.userId === player.userId) continue;
          const dist = Math.hypot(target.x - player.x, target.y - player.y);
          if (dist <= POCKET_WAR_LIMITS.MELEE_REACH + 16) {
            applyAuthoritativeDamage(
              state,
              rt,
              player.userId,
              target.userId,
              charDef.meleeDamage,
              "melee",
              "Melee Strike",
              Math.cos(player.aimAngle) * 360,
              Math.sin(player.aimAngle) * 260 - 120,
              now,
            );
          }
        }
      }

      // Throw grenade
      if (
        (fl & INPUT_FLAG_THROW_BOMB) !== 0 &&
        player.bombsLeft > 0 &&
        now - player.lastBombAt >= POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS
      ) {
        player.bombsLeft -= 1;
        player.lastBombAt = now;
        if (now < player.invulnerableUntil) player.invulnerableUntil = 0;
        const launch = computeGrenadeLaunch(
          player.x,
          player.y,
          player.aimAngle,
          player.vx,
          player.vy,
        );
        rt.physics.spawnGrenade(
          rt.nextProjId++,
          player.userId,
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
        );
      }

      // Weapon firing (authoritative fire-rate, ammo, & lag-compensated Planck raycast)
      const isReloading =
        activeSlot.reloadingUntil > 0 && now < activeSlot.reloadingUntil;
      const lastShot = rt.lastShotAt.get(player.userId) ?? 0;
      if (
        (fl & INPUT_FLAG_SHOOT) !== 0 &&
        !isReloading &&
        now - lastShot >= weapon.fireRateMs
      ) {
        if (activeSlot.ammo <= 0) {
          startReload(activeSlot, now);
        } else {
          rt.lastShotAt.set(player.userId, now);
          if (now < player.invulnerableUntil) player.invulnerableUntil = 0;

          activeSlot.ammo -= 1;
          if (activeSlot.ammo === 0) {
            startReload(activeSlot, now);
          }

          const originX = player.x + Math.cos(player.aimAngle) * 28;
          const originY = player.y - 2 + Math.sin(player.aimAngle) * 28;

          rt.pendingEvents.push([
            EVENT_KIND_SHOT,
            Math.round(originX),
            Math.round(originY),
            Math.round(player.aimAngle * 1000),
            killWeaponIdToIndex(weapon.id),
            player.userId,
            "",
            0,
            0,
          ]);

          if (weapon.projectileType === "rocket") {
            const spread =
              (Math.random() - 0.5) *
              (player.isScoped ? weapon.spreadRad * 0.65 : weapon.spreadRad);
            const angle = player.aimAngle + spread;
            rt.rockets.push({
              id: rt.nextProjId++,
              ownerId: player.userId,
              x: originX,
              y: originY,
              vx: Math.cos(angle) * weapon.bulletSpeed,
              vy: Math.sin(angle) * weapon.bulletSpeed,
              age: 0,
              maxAge: 2.5,
              damage: weapon.damage,
              blastRadius: weapon.blastRadius,
              knockback: weapon.knockback,
            });
          } else {
            const targets = getLagCompensatedTargets(
              state,
              rt,
              inp ? inp.ct : rt.tick,
              now,
            );
            for (let i = 0; i < weapon.pellets; i++) {
              const spread =
                (Math.random() - 0.5) *
                (player.isScoped ? weapon.spreadRad * 0.6 : weapon.spreadRad);
              const angle = player.aimAngle + spread;
              const endX = originX + Math.cos(angle) * weapon.maxRangePx;
              const endY = originY + Math.sin(angle) * weapon.maxRangePx;
              const hit = rt.physics.rayCastSegment(
                originX,
                originY,
                endX,
                endY,
                player.userId,
                targets,
              );

              if (hit.kind === "player" && hit.targetId) {
                applyAuthoritativeDamage(
                  state,
                  rt,
                  player.userId,
                  hit.targetId,
                  weapon.damage,
                  weapon.id,
                  weapon.name,
                  Math.cos(angle) * weapon.knockback,
                  Math.sin(angle) * weapon.knockback - 50,
                  now,
                );
              } else if (hit.kind === "block" && hit.targetId) {
                damageBlock(
                  state,
                  rt,
                  player.userId,
                  hit.targetId,
                  weapon.damage,
                  now,
                );
              }
            }
          }
        }
      }

      let pFlags = PLAYER_FLAG_ALIVE;
      if (player.isBoosting) pFlags |= PLAYER_FLAG_BOOSTING;
      if (player.isScoped) pFlags |= PLAYER_FLAG_SCOPED;
      if (soldier?.isGrounded) pFlags |= PLAYER_FLAG_GROUNDED;
      if (soldier?.inWater) pFlags |= PLAYER_FLAG_IN_WATER;
      if (now < player.jetpackOverheatedUntil) pFlags |= PLAYER_FLAG_OVERHEATED;
      if (activeSlot.reloadingUntil > 0 && now < activeSlot.reloadingUntil) {
        pFlags |= PLAYER_FLAG_RELOADING;
      }
      playerFlagsMap.set(player.userId, pFlags);
    }

    // 4. Step rockets & check grenade fuse timers
    const currentTargets = getLagCompensatedTargets(state, rt, rt.tick, now);
    for (let i = rt.rockets.length - 1; i >= 0; i--) {
      const r = rt.rockets[i]!;
      r.age += dtSec;
      r.vy += WEAPON_CATALOG.rpg7.bulletGravity * dtSec;
      const nx = r.x + r.vx * dtSec;
      const ny = r.y + r.vy * dtSec;
      const hit = rt.physics.rayCastSegment(
        r.x,
        r.y,
        nx,
        ny,
        r.ownerId,
        currentTargets,
      );
      if (hit.hit || r.age >= r.maxAge) {
        applyAuthoritativeExplosion(
          state,
          rt,
          r.ownerId,
          hit.hit ? hit.x : nx,
          hit.hit ? hit.y : ny,
          r.blastRadius,
          r.damage,
          "rpg7",
          WEAPON_CATALOG.rpg7.name,
          now,
        );
        rt.rockets.splice(i, 1);
      } else {
        r.x = nx;
        r.y = ny;
      }
    }

    const expiredGrenades: Array<{
      id: number;
      ownerId: string;
      x: number;
      y: number;
    }> = [];
    for (const g of rt.physics.getGrenades()) {
      if (g.age >= g.maxAge) {
        const pos = g.body.getPosition();
        expiredGrenades.push({
          id: g.id,
          ownerId: g.ownerId,
          x: mToPx(pos.x),
          y: mToPx(pos.y),
        });
      }
    }
    for (const eg of expiredGrenades) {
      rt.physics.removeGrenade(eg.id);
      applyAuthoritativeExplosion(
        state,
        rt,
        eg.ownerId,
        eg.x,
        eg.y,
        155,
        64,
        "grenade",
        "Frag Grenade",
        now,
      );
    }

    // 5. Record position history for lag-compensated raycasts
    const posMap = new Map<string, { x: number; y: number }>();
    for (const p of Object.values(state.players)) {
      if (p.isAlive) posMap.set(p.userId, { x: p.x, y: p.y });
    }
    rt.history.push({ tick: rt.tick, positions: posMap });
    if (rt.history.length > 10) {
      rt.history.shift();
    }

    // 6. Broadcast compact binary msgpack snapshot
    const playerTuples = Object.values(state.players).map((p) => {
      const slot = p.weapons[p.activeSlot];
      const def = WEAPON_CATALOG[slot.weaponId];
      const isReloading = slot.reloadingUntil > 0 && now < slot.reloadingUntil;
      const reloadPct = isReloading
        ? ((now - (slot.reloadingUntil - def.reloadTimeMs)) /
            def.reloadTimeMs) *
          100
        : 0;
      const respawnMsLeft =
        !p.isAlive && p.respawnAt !== null ? Math.max(0, p.respawnAt - now) : 0;
      const invulnMsLeft = p.isAlive
        ? Math.max(0, p.invulnerableUntil - now)
        : 0;

      return packPlayerTuple({
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
        flags: playerFlagsMap.get(p.userId) ?? 0,
        activeSlot: p.activeSlot,
        ammo: slot.ammo,
        reserveAmmo: slot.reserveAmmo,
        bombsLeft: p.bombsLeft,
        kills: p.kills,
        deaths: p.deaths,
        damageDealt: p.damageDealt,
        respawnMsLeft,
        invulnMsLeft,
        reloadPct,
        weapon0: p.weapons[0].weaponId,
        weapon1: p.weapons[1].weaponId,
      });
    });

    const projTuples: SnapshotProjectileTuple[] = [];
    for (const r of rt.rockets) {
      projTuples.push([
        r.id,
        PROJ_KIND_ROCKET,
        Math.round(r.x),
        Math.round(r.y),
        Math.round(r.vx),
        Math.round(r.vy),
        killWeaponIdToIndex("rpg7"),
      ]);
    }
    for (const g of rt.physics.getGrenades()) {
      const pos = g.body.getPosition();
      const vel = g.body.getLinearVelocity();
      projTuples.push([
        g.id,
        PROJ_KIND_BOMB,
        Math.round(mToPx(pos.x)),
        Math.round(mToPx(pos.y)),
        Math.round(mToPx(vel.x)),
        Math.round(mToPx(vel.y)),
        killWeaponIdToIndex("grenade"),
      ]);
    }

    const destroyedBlocks = Object.values(state.blocks)
      .filter((b) => b.destroyed)
      .map((b) => b.id);
    const cooldownPickups: Array<[string, number]> = Object.values(
      state.pickups,
    )
      .filter((pk) => now < pk.availableAt)
      .map((pk) => [pk.id, pk.availableAt - now]);

    const snapshotBytes = encodeServerSnapshot({
      t: PW_BIN_TYPE_SNAPSHOT,
      tick: rt.tick,
      st: now,
      acks: { ...rt.lastAcks },
      solo: state.soloWaitEndsAt,
      p: playerTuples,
      pr: projTuples,
      ev: rt.pendingEvents,
      kf: rt.pendingKillFeed,
      db: destroyedBlocks,
      pk: cooldownPickups,
    });

    ctx.broadcastBinary(snapshotBytes);
    rt.pendingEvents = [];
    rt.pendingKillFeed = [];

    await checkAndCompleteMatch(ctx);
  },

  async handleAction(
    ctx: GameActionContext<PocketWarState>,
    action: string,
    rawPayload: unknown,
  ): Promise<unknown> {
    const now = Date.now();
    const { state } = ctx;

    if (action === "get-state") {
      if (
        state.phase === "setup" &&
        state.setupCountdownEndsAt !== null &&
        now >= state.setupCountdownEndsAt
      ) {
        launchMatch(ctx.roomCode, state, now);
        ctx.setState(state);
        ctx.broadcastState();
      }
      return state;
    }

    const parsed = pocketWarActionPayloadSchema.safeParse(rawPayload);
    if (!parsed.success) return state;
    const act = parsed.data;
    const isHost = ctx.ownerId === ctx.user.id;

    if (act.type === "send_chat") {
      const lastAt = state.lastChatAtByUser[ctx.user.id] ?? 0;
      if (now - lastAt < POCKET_WAR_LIMITS.CHAT_RATE_LIMIT_MS) return state;
      const cleanText = sanitizeChatMessage(act.text);
      if (!cleanText) return state;

      state.lastChatAtByUser[ctx.user.id] = now;
      state.chatMessages.push({
        id: makeId("msg"),
        userId: ctx.user.id,
        username: ctx.user.name,
        text: cleanText,
        timestamp: now,
      });
      if (state.chatMessages.length > POCKET_WAR_LIMITS.MAX_CHAT_MESSAGES) {
        state.chatMessages = state.chatMessages.slice(
          -POCKET_WAR_LIMITS.MAX_CHAT_MESSAGES,
        );
      }
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    const player = state.players[ctx.user.id];
    if (!player) return state;

    if (act.type === "leave_match") {
      if (!player.leftMatch) {
        player.leftMatch = true;
        if (state.phase === "setup") {
          player.isReady = false;
          state.setupCountdownEndsAt = null;
        } else if (state.phase === "playing") {
          const wasAlive = player.isAlive;
          if (player.livesLeft > 0) {
            const contendersBefore = Object.values(state.players).filter(
              (p) => p.livesLeft > 0,
            ).length;
            player.isAlive = false;
            player.livesLeft = 0;
            player.respawnAt = null;
            player.eliminatedAt = now;
            player.placement = contendersBefore;
          }
          const rt = runtimes.get(ctx.roomCode);
          if (rt) {
            rt.inputQueues.delete(player.userId);
            rt.extrapolatedSteps.delete(player.userId);
            rt.latchedFlags.delete(player.userId);
            rt.physics.holdSoldierAtRest(player.userId);
            if (wasAlive) {
              rt.pendingEvents.push([
                EVENT_KIND_PLAYER_DEATH,
                Math.round(player.x),
                Math.round(player.y),
                0,
                0,
                player.userId,
                player.userId,
                0,
                0,
              ]);
            }
          }
          syncSoloWaitState(state, now);
        }
      }

      if (getRemainingMatchParticipants(state).length === 0) {
        await ctx.endMatch();
        return state;
      }

      if (state.phase === "playing" && (await checkAndCompleteMatch(ctx))) {
        return state;
      }

      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    if (state.phase === "setup") {
      if (act.type === "select_character") {
        player.characterId = act.characterId;
        const charDef = CHARACTER_CATALOG[act.characterId];
        player.maxHp = charDef.maxHp;
        player.hp = charDef.maxHp;
        player.bombsLeft = charDef.startingBombs;
        player.weapons = createStarterLoadout(act.characterId);
        player.activeSlot = 0;
      } else if (act.type === "select_map" && isHost) {
        state.settings.mapId = act.mapId;
        state.blocks = buildBlocksForMap(act.mapId);
        state.pickups = buildPickupsForMap(act.mapId);
      } else if (act.type === "toggle_ready") {
        player.isReady = act.isReady;
        updateSetupCountdown(ctx.roomCode, state, now);
      } else if (act.type === "force_start" && isHost) {
        const readyCount = Object.values(state.players).filter(
          (p) => p.isReady,
        ).length;
        if (
          Object.keys(state.players).length >= POCKET_WAR_LIMITS.MIN_PLAYERS &&
          readyCount >= 1
        ) {
          launchMatch(ctx.roomCode, state, now);
        }
      }
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    if (state.phase === "game_over" && act.type === "play_again" && isHost) {
      state.phase = "setup";
      state.winnerUserId = null;
      state.mvpUserId = null;
      state.matchStartedAt = null;
      state.setupCountdownEndsAt = null;
      state.soloWaitEndsAt = null;
      state.settings.mapId = pickRandomMapId();
      state.blocks = buildBlocksForMap(state.settings.mapId);
      state.pickups = buildPickupsForMap(state.settings.mapId);
      state.killFeed = [];
      state.recentEvents = [];
      state.recentDeaths = [];
      state.recentSpawns = {};
      for (const p of Object.values(state.players)) {
        const c = CHARACTER_CATALOG[p.characterId];
        p.isReady = false;
        p.leftMatch = false;
        p.isAlive = true;
        p.livesLeft = POCKET_WAR_LIMITS.STARTING_LIVES;
        p.maxLives = POCKET_WAR_LIMITS.STARTING_LIVES;
        p.deaths = 0;
        p.eliminatedAt = null;
        p.respawnAt = null;
        p.placement = null;
        p.hp = c.maxHp;
        p.maxHp = c.maxHp;
        p.kills = 0;
        p.damageDealt = 0;
        p.weapons = createStarterLoadout(p.characterId);
        p.activeSlot = 0;
      }
      runtimes.delete(ctx.roomCode);
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    return state;
  },
};
