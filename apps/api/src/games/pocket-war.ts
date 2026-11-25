import type { RoomPlayer } from "@kridora/shared";
import {
  CHARACTER_CATALOG,
  MAP_CATALOG,
  POCKET_WAR_LIMITS,
  WEAPON_CATALOG,
  pickRandomMapId,
  pocketWarActionPayloadSchema,
  sanitizeChatMessage,
  type DestructibleBlockState,
  type KillWeaponIconId,
  type MapDefinition,
  type PickupPadState,
  type PlatformRect,
  type PocketWarCharacterId,
  type PocketWarEvent,
  type PocketWarMapId,
  type PocketWarPlayer,
  type PocketWarState,
  type WeaponId,
  type WeaponSlotState,
} from "@kridora/shared/games/pocket-war";
import type { GameActionContext, ServerGameModule } from "./types";

export interface MatchPlacement {
  userId: string;
  rank: number;
  score: number;
  isMvp: boolean;
}

export interface ServerGameContext {
  userId: string;
  username: string;
  isHost: boolean;
  completeMatch: (result: {
    winnerUserId: string | null;
    placements: MatchPlacement[];
  }) => Promise<void>;
}

export interface RoomMemberInfo {
  userId: string;
  username: string;
}

const MAX_RECENT_EVENTS = 48;
const RECENT_DEATH_WINDOW_MS = 10_000;
const RECENT_SPAWN_WINDOW_MS = 8_000;
const RECENT_EXPLOSION_WINDOW_MS = 2_500;

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
    blocks[def.id] = {
      ...def,
      hp: def.maxHp,
      destroyed: false,
    };
  }
  return blocks;
}

function buildPickupsForMap(
  mapId: PocketWarMapId,
): Record<string, PickupPadState> {
  const map = MAP_CATALOG[mapId];
  const pickups: Record<string, PickupPadState> = {};
  for (const pad of map.pickupPads) {
    pickups[pad.id] = {
      ...pad,
      availableAt: 0,
    };
  }
  return pickups;
}

function createDefaultPlayer(
  member: RoomMemberInfo,
  spawnIndex: number,
  mapId: PocketWarMapId,
): PocketWarPlayer {
  const defaultChar: PocketWarCharacterId =
    spawnIndex % 2 === 0 ? "rex" : "nova";
  const charDef = CHARACTER_CATALOG[defaultChar];
  const spawns = MAP_CATALOG[mapId].spawnPoints;
  const spawn = spawns[spawnIndex % spawns.length] ?? { x: 640, y: 380 };

  return {
    userId: member.userId,
    username: member.username,
    characterId: defaultChar,
    isReady: false,
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

function pushEvent(
  state: PocketWarState,
  event: Omit<PocketWarEvent, "id" | "timestamp">,
): void {
  state.recentEvents.push({
    ...event,
    id: makeId("ev"),
    timestamp: Date.now(),
  });
  if (state.recentEvents.length > MAX_RECENT_EVENTS) {
    state.recentEvents = state.recentEvents.slice(-MAX_RECENT_EVENTS);
  }
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
  if (slot.ammo >= def.magSize) return false;
  if (slot.reserveAmmo === 0) return false;
  slot.reloadingUntil = now + def.reloadTimeMs;
  return true;
}

/** Fast Liang-Barsky segment-vs-AABB intersection test for server-side line-of-sight checks. */
function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: PlatformRect,
): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-8) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, x1 - rect.x) &&
    clip(dx, rect.x + rect.width - x1) &&
    clip(-dy, y1 - rect.y) &&
    clip(dy, rect.y + rect.height - y1) &&
    t0 <= t1
  );
}

function hasClearLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  map: MapDefinition,
  blocks: Record<string, DestructibleBlockState>,
): boolean {
  for (const plat of map.platforms) {
    if (plat.isOneWay || plat.style === "bounds") continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, plat)) {
      return false;
    }
  }
  for (const block of Object.values(blocks)) {
    if (block.destroyed) continue;
    if (segmentIntersectsRect(x1, y1, x2, y2, block)) {
      return false;
    }
  }
  return true;
}

/**
 * Anti-clustering respawn scoring algorithm:
 * Scores every map spawn point by minimum & average enemy distance, danger radius,
 * unobstructed line-of-sight from living opponents, recent death zones, recent spawns,
 * and active explosions, then performs a weighted pick among the top candidates.
 */
function selectSafeSpawnPoint(
  state: PocketWarState,
  respawningUserId: string,
  now: number,
): { x: number; y: number; index: number } {
  const map = MAP_CATALOG[state.settings.mapId];
  const spawns = map.spawnPoints;
  if (spawns.length === 0) {
    return { x: 640, y: 380, index: 0 };
  }

  const livingEnemies = Object.values(state.players).filter(
    (p) => p.isAlive && p.userId !== respawningUserId,
  );

  // Prune stale recent deaths
  state.recentDeaths = state.recentDeaths.filter(
    (d) => now - d.at <= RECENT_DEATH_WINDOW_MS,
  );

  const activeExplosions = state.recentEvents.filter(
    (ev) =>
      ev.type === "explosion" &&
      now - ev.timestamp <= RECENT_EXPLOSION_WINDOW_MS,
  );

  const scored = spawns.map((pt, index) => {
    let score = 0;

    if (livingEnemies.length > 0) {
      let minEnemyDist = Number.POSITIVE_INFINITY;
      let totalEnemyDist = 0;

      for (const enemy of livingEnemies) {
        const dist = Math.hypot(pt.x - enemy.x, pt.y - enemy.y);
        if (dist < minEnemyDist) minEnemyDist = dist;
        totalEnemyDist += dist;

        // Severe anti-clustering penalty inside immediate danger radius
        if (dist < 360) {
          score -= 1200 * (1 - dist / 360) + 400;
        }

        // Line-of-sight penalty if an opponent can immediately snipe the spawn
        if (
          dist < 1100 &&
          hasClearLineOfSight(enemy.x, enemy.y, pt.x, pt.y, map, state.blocks)
        ) {
          score -= 450;
        }
      }

      const avgEnemyDist = totalEnemyDist / livingEnemies.length;
      score += Math.min(minEnemyDist, 1000) * 1.1;
      score += Math.min(avgEnemyDist, 1200) * 0.35;
    } else {
      score = 1000;
    }

    // Recent death zone decay
    for (const d of state.recentDeaths) {
      const dist = Math.hypot(pt.x - d.x, pt.y - d.y);
      if (dist < 300) {
        const freshness = Math.max(
          0,
          1 - (now - d.at) / RECENT_DEATH_WINDOW_MS,
        );
        score -= 380 * freshness;
      }
    }

    // Recent spawn cooldown decay
    const lastUsed = state.recentSpawns[index];
    if (lastUsed !== undefined && now - lastUsed < RECENT_SPAWN_WINDOW_MS) {
      const freshness = 1 - (now - lastUsed) / RECENT_SPAWN_WINDOW_MS;
      score -= 350 * freshness;
    }

    // Active explosion hazard avoidance
    for (const ex of activeExplosions) {
      const dist = Math.hypot(pt.x - ex.x, pt.y - ex.y);
      if (dist < 240) {
        score -= 600;
      }
    }

    // Tiny jitter to break exact ties organically
    score += Math.random() * 18;

    return { pt, index, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const pool = scored
    .slice(0, Math.min(3, scored.length))
    .filter((candidate) => best.score - candidate.score <= 420);

  const weights = [0.58, 0.28, 0.14];
  let totalWeight = 0;
  for (let i = 0; i < pool.length; i++) {
    totalWeight += weights[i] ?? 0.1;
  }

  let roll = Math.random() * totalWeight;
  let chosen = best;
  for (let i = 0; i < pool.length; i++) {
    const w = weights[i] ?? 0.1;
    if (roll <= w) {
      chosen = pool[i] ?? best;
      break;
    }
    roll -= w;
  }

  state.recentSpawns[chosen.index] = now;
  return { x: chosen.pt.x, y: chosen.pt.y, index: chosen.index };
}

function respawnPlayer(
  state: PocketWarState,
  player: PocketWarPlayer,
  now: number,
): void {
  const charDef = CHARACTER_CATALOG[player.characterId];
  const safeSpawn = selectSafeSpawnPoint(state, player.userId, now);

  player.isAlive = true;
  player.respawnAt = null;
  player.hp = charDef.maxHp;
  player.maxHp = charDef.maxHp;
  player.lastDamagedAt = now;
  player.x = safeSpawn.x;
  player.y = safeSpawn.y;
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

  pushEvent(state, {
    type: "player_respawn",
    x: safeSpawn.x,
    y: safeSpawn.y,
    actorId: player.userId,
    targetId: player.userId,
  });
}

function launchMatch(state: PocketWarState, now: number): void {
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

  // Spread players maximally across spawn points at match start
  const step = Math.max(
    1,
    Math.floor(map.spawnPoints.length / Math.max(1, allPlayers.length)),
  );
  const offset = Math.floor(Math.random() * map.spawnPoints.length);

  allPlayers.forEach((player, idx) => {
    const charDef = CHARACTER_CATALOG[player.characterId];
    const spawnIdx = (offset + idx * step) % map.spawnPoints.length;
    const spawn = map.spawnPoints[spawnIdx] ?? { x: 640, y: 380 };
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
}

function updateSetupCountdown(state: PocketWarState, now: number): void {
  if (state.phase !== "setup") return;
  const allPlayers = Object.values(state.players);
  const everyoneReady =
    allPlayers.length >= POCKET_WAR_LIMITS.MIN_PLAYERS &&
    allPlayers.every((p) => p.isReady);

  if (everyoneReady) {
    if (state.setupCountdownEndsAt === null) {
      state.setupCountdownEndsAt = now + POCKET_WAR_LIMITS.SETUP_COUNTDOWN_MS;
    } else if (now >= state.setupCountdownEndsAt) {
      launchMatch(state, now);
    }
  } else {
    state.setupCountdownEndsAt = null;
  }
}

/** Runs deterministic timestamp-driven updates without needing background intervals. */
function tickLazyTimers(state: PocketWarState, now: number): boolean {
  let mutated = false;

  if (state.phase === "setup") {
    if (
      state.setupCountdownEndsAt !== null &&
      now >= state.setupCountdownEndsAt
    ) {
      launchMatch(state, now);
      return true;
    }
    return false;
  }

  if (state.phase !== "playing") return false;

  for (const player of Object.values(state.players)) {
    // Finish pending weapon reloads
    completeReloadIfReady(player.weapons[0], now);
    completeReloadIfReady(player.weapons[1], now);

    // Respawn players whose timer expired and who still have lives
    if (
      !player.isAlive &&
      player.livesLeft > 0 &&
      player.respawnAt !== null &&
      now >= player.respawnAt
    ) {
      respawnPlayer(state, player, now);
      mutated = true;
      continue;
    }

    // Passive health regeneration after avoiding damage for 6s
    if (
      player.isAlive &&
      player.hp < player.maxHp &&
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
        mutated = true;
      }
    }
  }

  return mutated;
}

function computePlayerScore(
  player: PocketWarPlayer,
  rank: number,
  total: number,
): number {
  const survivalBonus = Math.max(0, (total - rank) * 60);
  const livesBonus = player.livesLeft * 45;
  return (
    player.kills * 150 +
    survivalBonus +
    livesBonus +
    Math.round(player.damageDealt * 0.45)
  );
}

async function checkMatchEnd(
  state: PocketWarState,
  completeMatch: ServerGameContext["completeMatch"],
): Promise<void> {
  if (state.phase !== "playing") return;

  const allPlayers = Object.values(state.players);
  const remainingContenders = allPlayers.filter((p) => p.livesLeft > 0);

  if (remainingContenders.length > 1) return;

  const sorted = [...allPlayers].sort((a, b) => {
    if (a.livesLeft !== b.livesLeft) return b.livesLeft - a.livesLeft;
    if ((a.eliminatedAt ?? 0) !== (b.eliminatedAt ?? 0)) {
      return (b.eliminatedAt ?? 0) - (a.eliminatedAt ?? 0);
    }
    if (a.kills !== b.kills) return b.kills - a.kills;
    return b.damageDealt - a.damageDealt;
  });

  const winner = remainingContenders[0] ?? sorted[0] ?? null;
  state.winnerUserId = winner ? winner.userId : null;

  let mvpId: string | null = null;
  let bestMvpMetric = -1;

  const rawPlacements = sorted.map((player, index) => {
    const rank = index + 1;
    player.placement = rank;
    const score = computePlayerScore(player, rank, sorted.length);
    const mvpMetric =
      player.kills * 160 + player.damageDealt * 0.6 + player.livesLeft * 40;
    if (mvpMetric > bestMvpMetric) {
      bestMvpMetric = mvpMetric;
      mvpId = player.userId;
    }
    return { userId: player.userId, rank, score };
  });

  state.mvpUserId = mvpId;

  const placements: MatchPlacement[] = rawPlacements.map((p) => ({
    ...p,
    isMvp: p.userId === mvpId,
  }));

  state.phase = "game_over";
  await completeMatch({
    winnerUserId: state.winnerUserId,
    placements,
  });
}

function getWeaponMaxSingleHitDamage(weaponId: KillWeaponIconId): number {
  if (weaponId === "grenade") return 72;
  if (weaponId === "barrel") return 72;
  if (weaponId === "melee") return 42;
  const def = WEAPON_CATALOG[weaponId];
  return Math.ceil(def.damage * 1.25);
}

function applyPlayerDamage(
  state: PocketWarState,
  attackerId: string,
  victimId: string,
  damage: number,
  weaponId: KillWeaponIconId,
  weaponLabel: string,
  impulseX: number,
  impulseY: number,
  now: number,
): void {
  const victim = state.players[victimId];
  const attacker = state.players[attackerId];
  if (!victim || !victim.isAlive) return;
  if (now < victim.invulnerableUntil) return;

  const maxAllowed = getWeaponMaxSingleHitDamage(weaponId);
  const clampedDamage = Math.min(maxAllowed, Math.max(1, Math.round(damage)));
  victim.hp = Math.max(0, victim.hp - clampedDamage);
  victim.lastDamagedAt = now;

  if (attacker && attacker.userId !== victim.userId) {
    attacker.damageDealt += clampedDamage;
  }

  pushEvent(state, {
    type: "hit",
    x: victim.x,
    y: victim.y,
    actorId: attackerId,
    targetId: victimId,
    weaponId,
    damage: clampedDamage,
    vx: impulseX,
    vy: impulseY,
  });

  if (victim.hp <= 0) {
    victim.isAlive = false;
    victim.deaths += 1;
    victim.livesLeft = Math.max(0, victim.livesLeft - 1);
    victim.isBoosting = false;
    victim.isScoped = false;

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

    state.killFeed.unshift({
      id: makeId("kf"),
      killerId: attackerId,
      killerName: attacker ? attacker.username : "Jungle Hazard",
      victimId: victim.userId,
      victimName: victim.username,
      weaponId,
      weaponLabel,
      timestamp: now,
    });
    if (state.killFeed.length > 8) {
      state.killFeed = state.killFeed.slice(0, 8);
    }

    pushEvent(state, {
      type: "player_death",
      x: victim.x,
      y: victim.y,
      actorId: attackerId,
      targetId: victimId,
      weaponId,
      vx: impulseX,
      vy: impulseY,
    });
  }
}

function applyExplosion(
  state: PocketWarState,
  actorId: string,
  x: number,
  y: number,
  radius: number,
  maxDamage: number,
  weaponId: KillWeaponIconId,
  weaponLabel: string,
  now: number,
  depth = 0,
): void {
  if (depth > 4) return;

  const safeRadius = Math.min(185, Math.max(40, radius));
  const safeMaxDmg = Math.min(68, Math.max(12, maxDamage));

  pushEvent(state, {
    type: "explosion",
    x,
    y,
    radius: safeRadius,
    weaponId,
    actorId,
  });

  // Damage & knockback nearby living players
  for (const player of Object.values(state.players)) {
    if (!player.isAlive) continue;
    const dx = player.x - x;
    const dy = player.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > safeRadius) continue;

    const falloff = 1 - dist / safeRadius;
    const dmg = Math.max(10, Math.round(safeMaxDmg * (0.32 + 0.68 * falloff)));
    const nx = dist > 1 ? dx / dist : 0;
    const ny = dist > 1 ? dy / dist : -1;
    const selfMultiplier = player.userId === actorId ? 0.55 : 1;

    applyPlayerDamage(
      state,
      actorId,
      player.userId,
      dmg * selfMultiplier,
      weaponId,
      weaponLabel,
      nx * 470 * falloff,
      (ny - 0.35) * 470 * falloff,
      now,
    );
  }

  // Damage destructible map blocks and chain-detonate fuel barrels
  const triggeredBarrels: DestructibleBlockState[] = [];
  for (const block of Object.values(state.blocks)) {
    if (block.destroyed) continue;
    const cx = block.x + block.width * 0.5;
    const cy = block.y + block.height * 0.5;
    const dist = Math.hypot(cx - x, cy - y);
    if (dist > safeRadius + Math.max(block.width, block.height) * 0.5) continue;

    const falloff = Math.max(0.28, 1 - dist / (safeRadius + 60));
    block.hp -= Math.round(safeMaxDmg * 1.45 * falloff);

    if (block.hp <= 0) {
      block.hp = 0;
      block.destroyed = true;
      pushEvent(state, {
        type: "block_break",
        x: cx,
        y: cy,
        material: block.material,
        actorId,
      });
      if (block.material === "barrel") {
        triggeredBarrels.push(block);
      }
    }
  }

  for (const barrel of triggeredBarrels) {
    applyExplosion(
      state,
      actorId,
      barrel.x + barrel.width * 0.5,
      barrel.y + barrel.height * 0.5,
      165,
      64,
      "barrel",
      "Fuel Barrel",
      now,
      depth + 1,
    );
  }
}

function handlePickupItem(
  state: PocketWarState,
  player: PocketWarPlayer,
  pickupId: string,
  now: number,
): void {
  const pad = state.pickups[pickupId];
  if (!pad || now < pad.availableAt) return;

  const dist = Math.hypot(player.x - pad.x, player.y - pad.y);
  if (dist > POCKET_WAR_LIMITS.PICKUP_RADIUS + 56) return;

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
    if (player.weapons[0].weaponId === nextWeaponId) {
      player.weapons[0].ammo = nextDef.magSize;
      player.weapons[0].reserveAmmo = nextDef.defaultReserveAmmo;
      player.weapons[0].reloadingUntil = 0;
    } else {
      player.weapons[0] = createWeaponSlot(nextWeaponId);
    }
    player.activeSlot = 0;
    consumed = true;
  }

  if (consumed) {
    pad.availableAt = now + POCKET_WAR_LIMITS.PICKUP_RESPAWN_MS;
    pushEvent(state, {
      type: "pickup",
      x: pad.x,
      y: pad.y,
      pickupKind: pad.kind,
      actorId: player.userId,
    });
  }
}

async function processAction(
  state: PocketWarState,
  rawAction: unknown,
  ctx: ServerGameContext,
): Promise<PocketWarState> {
  const now = Date.now();
  tickLazyTimers(state, now);

  const parsed = pocketWarActionPayloadSchema.safeParse(rawAction);
  if (!parsed.success) return state;

  const action = parsed.data;

  // Ensure late-joined player is registered during setup
  if (!state.players[ctx.userId] && state.phase === "setup") {
    const currentCount = Object.keys(state.players).length;
    if (currentCount < POCKET_WAR_LIMITS.MAX_PLAYERS) {
      state.players[ctx.userId] = createDefaultPlayer(
        { userId: ctx.userId, username: ctx.username },
        currentCount,
        state.settings.mapId,
      );
      updateSetupCountdown(state, now);
    }
  }

  // Chat works across all phases
  if (action.type === "send_chat") {
    const lastAt = state.lastChatAtByUser[ctx.userId] ?? 0;
    if (now - lastAt < POCKET_WAR_LIMITS.CHAT_RATE_LIMIT_MS) return state;

    const cleanText = sanitizeChatMessage(action.text);
    if (!cleanText) return state;

    state.lastChatAtByUser[ctx.userId] = now;
    state.chatMessages.push({
      id: makeId("msg"),
      userId: ctx.userId,
      username: ctx.username,
      text: cleanText,
      timestamp: now,
    });

    if (state.chatMessages.length > POCKET_WAR_LIMITS.MAX_CHAT_MESSAGES) {
      state.chatMessages = state.chatMessages.slice(
        -POCKET_WAR_LIMITS.MAX_CHAT_MESSAGES,
      );
    }
    return state;
  }

  const player = state.players[ctx.userId];
  if (!player) return state;

  // --- SETUP PHASE ---
  if (state.phase === "setup") {
    if (action.type === "select_character") {
      player.characterId = action.characterId;
      const charDef = CHARACTER_CATALOG[action.characterId];
      player.maxHp = charDef.maxHp;
      player.hp = charDef.maxHp;
      player.bombsLeft = charDef.startingBombs;
      player.weapons = createStarterLoadout(action.characterId);
      player.activeSlot = 0;
      return state;
    }

    if (action.type === "select_map" && ctx.isHost) {
      state.settings.mapId = action.mapId;
      state.blocks = buildBlocksForMap(action.mapId);
      state.pickups = buildPickupsForMap(action.mapId);
      return state;
    }

    if (action.type === "toggle_ready") {
      player.isReady = action.isReady;
      updateSetupCountdown(state, now);
      return state;
    }

    if (action.type === "force_start" && ctx.isHost) {
      const readyCount = Object.values(state.players).filter(
        (p) => p.isReady,
      ).length;
      if (
        Object.keys(state.players).length >= POCKET_WAR_LIMITS.MIN_PLAYERS &&
        readyCount >= 1
      ) {
        launchMatch(state, now);
      }
      return state;
    }

    return state;
  }

  // --- GAME OVER PHASE ---
  if (state.phase === "game_over") {
    if (action.type === "play_again" && ctx.isHost) {
      state.phase = "setup";
      state.winnerUserId = null;
      state.mvpUserId = null;
      state.matchStartedAt = null;
      state.setupCountdownEndsAt = null;
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
    }
    return state;
  }

  // --- PLAYING PHASE ---
  // Allow dead players with lives remaining to ping for respawn
  if (action.type === "request_respawn") {
    if (
      !player.isAlive &&
      player.livesLeft > 0 &&
      player.respawnAt !== null &&
      now >= player.respawnAt
    ) {
      respawnPlayer(state, player, now);
    }
    return state;
  }

  // All remaining gameplay actions require an alive soldier
  if (!player.isAlive) return state;

  const charDef = CHARACTER_CATALOG[player.characterId];
  const activeSlot = player.weapons[player.activeSlot];
  completeReloadIfReady(activeSlot, now);

  switch (action.type) {
    case "player_state": {
      const map = MAP_CATALOG[state.settings.mapId];
      player.x = Math.max(66, Math.min(map.width - 66, action.x));
      player.y = Math.max(
        POCKET_WAR_LIMITS.CEILING_Y + 26,
        Math.min(map.height - 64, action.y),
      );
      player.vx = Math.max(-950, Math.min(950, action.vx));
      player.vy = Math.max(-1050, Math.min(1150, action.vy));
      player.aimAngle = action.aimAngle;
      player.isBoosting =
        action.isBoosting && now >= player.jetpackOverheatedUntil;
      player.jetpackFuel = action.jetpackFuel;
      if (action.isScoped !== undefined) {
        player.isScoped = action.isScoped;
      }
      if (action.activeSlot !== undefined) {
        player.activeSlot = action.activeSlot;
      }
      if (player.jetpackFuel <= 0.5 && now >= player.jetpackOverheatedUntil) {
        player.jetpackOverheatedUntil =
          now + POCKET_WAR_LIMITS.JETPACK_OVERHEAT_MS;
        player.isBoosting = false;
      }
      break;
    }

    case "switch_weapon": {
      player.activeSlot = action.slot;
      break;
    }

    case "fire_weapon": {
      player.activeSlot = action.slot;
      const slot = player.weapons[action.slot];
      completeReloadIfReady(slot, now);

      if (slot.reloadingUntil > 0 && now < slot.reloadingUntil) break;
      if (slot.ammo <= 0) {
        startReload(slot, now);
        break;
      }

      // Firing ends spawn protection immediately
      if (now < player.invulnerableUntil) {
        player.invulnerableUntil = 0;
      }

      slot.ammo -= 1;
      if (slot.ammo === 0) {
        startReload(slot, now);
      }

      pushEvent(state, {
        type: "shot",
        x: action.originX,
        y: action.originY,
        angle: action.angle,
        weaponId: slot.weaponId,
        actorId: ctx.userId,
      });
      break;
    }

    case "reload": {
      startReload(activeSlot, now);
      break;
    }

    case "throw_bomb": {
      if (player.bombsLeft <= 0) break;
      if (now - player.lastBombAt < POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS) break;
      if (now < player.invulnerableUntil) {
        player.invulnerableUntil = 0;
      }
      player.bombsLeft -= 1;
      player.lastBombAt = now;
      break;
    }

    case "pickup_item": {
      handlePickupItem(state, player, action.pickupId, now);
      break;
    }

    case "melee_bash": {
      if (now - player.lastMeleeAt < POCKET_WAR_LIMITS.MELEE_COOLDOWN_MS) break;
      if (now < player.invulnerableUntil) {
        player.invulnerableUntil = 0;
      }
      player.lastMeleeAt = now;
      pushEvent(state, {
        type: "melee",
        x: action.x,
        y: action.y,
        angle: action.angle,
        actorId: ctx.userId,
      });
      for (const target of Object.values(state.players)) {
        if (!target.isAlive || target.userId === ctx.userId) continue;
        const dist = Math.hypot(target.x - action.x, target.y - action.y);
        if (dist <= POCKET_WAR_LIMITS.MELEE_REACH + 16) {
          applyPlayerDamage(
            state,
            ctx.userId,
            target.userId,
            charDef.meleeDamage,
            "melee",
            "Melee Strike",
            Math.cos(action.angle) * 360,
            Math.sin(action.angle) * 260 - 120,
            now,
          );
        }
      }
      await checkMatchEnd(state, ctx.completeMatch);
      break;
    }

    case "report_hit": {
      const target = state.players[action.targetUserId];
      if (!target || !target.isAlive || target.userId === ctx.userId) break;
      applyPlayerDamage(
        state,
        ctx.userId,
        target.userId,
        action.damage,
        action.weaponId,
        action.weaponLabel,
        action.impulseX,
        action.impulseY,
        now,
      );
      await checkMatchEnd(state, ctx.completeMatch);
      break;
    }

    case "report_explosion": {
      applyExplosion(
        state,
        ctx.userId,
        action.x,
        action.y,
        action.radius,
        action.maxDamage,
        action.weaponId,
        action.weaponLabel,
        now,
      );
      await checkMatchEnd(state, ctx.completeMatch);
      break;
    }

    case "damage_block": {
      const block = state.blocks[action.blockId];
      if (!block || block.destroyed) break;
      block.hp -= Math.round(action.damage);
      if (block.hp <= 0) {
        block.hp = 0;
        block.destroyed = true;
        const cx = block.x + block.width * 0.5;
        const cy = block.y + block.height * 0.5;
        pushEvent(state, {
          type: "block_break",
          x: cx,
          y: cy,
          material: block.material,
          actorId: ctx.userId,
        });
        if (block.material === "barrel") {
          applyExplosion(
            state,
            ctx.userId,
            cx,
            cy,
            165,
            64,
            "barrel",
            "Fuel Barrel",
            now,
          );
          await checkMatchEnd(state, ctx.completeMatch);
        }
      }
      break;
    }
  }

  return state;
}

export const pocketWarGameModule: ServerGameModule<PocketWarState> = {
  slug: "pocket-war",
  eventPrefix: "pocket-war",
  stateEvent: "pocket-war:state",

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

  async handleAction(
    ctx: GameActionContext<PocketWarState>,
    action: string,
    rawPayload: unknown,
  ): Promise<unknown> {
    if (action === "get-state") {
      const changed = tickLazyTimers(ctx.state, Date.now());
      if (changed) {
        ctx.setState(ctx.state);
        ctx.broadcastState();
      }
      return ctx.state;
    }

    const isHost = ctx.ownerId === ctx.user.id;
    const serverCtx: ServerGameContext = {
      userId: ctx.user.id,
      username: ctx.user.name,
      isHost,
      completeMatch: async (result) => {
        await ctx.completeMatch({
          winnerUserId: result.winnerUserId,
          placements: result.placements.map((p) => ({
            userId: p.userId,
            placement: p.rank,
            xpReward: Math.round(p.score * 1.4) + (p.isMvp ? 60 : 0),
            ringsReward:
              (p.rank === 1 ? 55 : p.rank === 2 ? 30 : 12) +
              (p.isMvp ? 15 : 0),
          })),
        });
      },
    };

    const nextState = await processAction(ctx.state, rawPayload, serverCtx);
    ctx.setState(nextState);
    ctx.broadcastState();
    return nextState;
  },

  onPlayerLeft(state: PocketWarState, userId: string): boolean {
    const now = Date.now();
    if (state.phase === "setup") {
      if (state.players[userId]) {
        delete state.players[userId];
        updateSetupCountdown(state, now);
        return true;
      }
      return false;
    }

    const leaving = state.players[userId];
    if (leaving && leaving.livesLeft > 0) {
      const remainingBefore = Object.values(state.players).filter(
        (p) => p.livesLeft > 0,
      ).length;
      leaving.isAlive = false;
      leaving.livesLeft = 0;
      leaving.respawnAt = null;
      leaving.eliminatedAt = now;
      leaving.placement = remainingBefore;

      const remaining = Object.values(state.players).filter(
        (p) => p.livesLeft > 0,
      );
      if (remaining.length <= 1) {
        const winner = remaining[0] ?? null;
        if (winner) {
          winner.placement = 1;
          state.winnerUserId = winner.userId;
        }
        state.phase = "game_over";
      }
      return true;
    }
    return false;
  },

  onPlayerRenamed(
    state: PocketWarState,
    userId: string,
    username: string,
  ): boolean {
    const player = state.players[userId];
    if (player) {
      player.username = username;
      return true;
    }
    return false;
  },
};
