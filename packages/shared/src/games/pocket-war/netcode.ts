import { decode, encode } from "@msgpack/msgpack";
import {
  KILL_WEAPON_IDS,
  WEAPON_IDS,
  type KillWeaponIconId,
  type PickupKind,
  type PocketWarKillFeedEntry,
  type TerrainMaterial,
  type WeaponId,
} from "./constants";

export const PW_BIN_TYPE_INPUT = 1 as const;
export const PW_BIN_TYPE_SNAPSHOT = 2 as const;

export const INPUT_FLAG_BOOST = 1 << 0;
export const INPUT_FLAG_DROP = 1 << 1;
export const INPUT_FLAG_SHOOT = 1 << 2;
export const INPUT_FLAG_SCOPED = 1 << 3;
export const INPUT_FLAG_RELOAD = 1 << 4;
export const INPUT_FLAG_THROW_BOMB = 1 << 5;
export const INPUT_FLAG_MELEE = 1 << 6;
export const INPUT_FLAG_SWITCH_WEAPON = 1 << 7;
export const INPUT_FLAG_PICKUP = 1 << 8;

export const PLAYER_FLAG_ALIVE = 1 << 0;
export const PLAYER_FLAG_BOOSTING = 1 << 1;
export const PLAYER_FLAG_SCOPED = 1 << 2;
export const PLAYER_FLAG_GROUNDED = 1 << 3;
export const PLAYER_FLAG_IN_WATER = 1 << 4;
export const PLAYER_FLAG_OVERHEATED = 1 << 5;
export const PLAYER_FLAG_RELOADING = 1 << 6;

export const PROJ_KIND_BULLET = 0;
export const PROJ_KIND_PELLET = 1;
export const PROJ_KIND_ROCKET = 2;
export const PROJ_KIND_BOMB = 3;

export const EVENT_KIND_SHOT = 0;
export const EVENT_KIND_HIT = 1;
export const EVENT_KIND_EXPLOSION = 2;
export const EVENT_KIND_BLOCK_BREAK = 3;
export const EVENT_KIND_PLAYER_DEATH = 4;
export const EVENT_KIND_PLAYER_RESPAWN = 5;
export const EVENT_KIND_MELEE = 6;
export const EVENT_KIND_PICKUP = 7;
export const EVENT_KIND_WATER_SPLASH = 8;

const MATERIALS: readonly TerrainMaterial[] = [
  "mud",
  "rock",
  "wood",
  "tree",
  "concrete",
  "barrel",
];

const PICKUP_KINDS: readonly PickupKind[] = [
  "weapon_spas12",
  "weapon_barrett50",
  "weapon_rpg7",
  "weapon_m4a1",
  "medkit",
  "grenade_pack",
];

export function weaponIdToIndex(id: WeaponId): number {
  const idx = WEAPON_IDS.indexOf(id);
  return idx >= 0 ? idx : 0;
}

export function indexToWeaponId(idx: number): WeaponId {
  return WEAPON_IDS[idx] ?? "m4a1";
}

export function killWeaponIdToIndex(id: KillWeaponIconId): number {
  const idx = KILL_WEAPON_IDS.indexOf(id);
  return idx >= 0 ? idx : 0;
}

export function indexToKillWeaponId(idx: number): KillWeaponIconId {
  return KILL_WEAPON_IDS[idx] ?? "m4a1";
}

export function materialToIndex(m: TerrainMaterial): number {
  const idx = MATERIALS.indexOf(m);
  return idx >= 0 ? idx : 0;
}

export function indexToMaterial(idx: number): TerrainMaterial {
  return MATERIALS[idx] ?? "wood";
}

export function pickupKindToIndex(k: PickupKind): number {
  const idx = PICKUP_KINDS.indexOf(k);
  return idx >= 0 ? idx : 0;
}

export function indexToPickupKind(idx: number): PickupKind {
  return PICKUP_KINDS[idx] ?? "medkit";
}

export interface ClientInputPacket {
  t: typeof PW_BIN_TYPE_INPUT;
  seq: number;
  /** Quantized -100..100 */
  mx: number;
  /** Bitmask of INPUT_FLAG_* */
  fl: number;
  /** Math.round(aimAngle * 1000) */
  aim: number;
  /** Active weapon slot (0 | 1) */
  sl: 0 | 1;
  /** Last server tick seen by client (for lag compensation) */
  ct: number;
  /** Fixed 60 Hz physics steps accumulated since previous packet (0..6) */
  st?: number;
}

export interface SnapshotPlayerState {
  userId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  livesLeft: number;
  jetpackFuel: number;
  flags: number;
  activeSlot: 0 | 1;
  ammo: number;
  reserveAmmo: number;
  bombsLeft: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  respawnMsLeft: number;
  invulnMsLeft: number;
  reloadPct: number;
  weapon0: WeaponId;
  weapon1: WeaponId;
}

export type SnapshotPlayerTuple = [
  string, // 0: userId
  number, // 1: x (rounded)
  number, // 2: y (rounded)
  number, // 3: vx (rounded)
  number, // 4: vy (rounded)
  number, // 5: aim_i16 (rad * 1000)
  number, // 6: hp
  number, // 7: maxHp
  number, // 8: livesLeft
  number, // 9: jetpackFuel (0..100)
  number, // 10: flags
  0 | 1, // 11: activeSlot
  number, // 12: ammo
  number, // 13: reserveAmmo
  number, // 14: bombsLeft
  number, // 15: kills
  number, // 16: deaths
  number, // 17: damageDealt
  number, // 18: respawnMsLeft
  number, // 19: invulnMsLeft
  number, // 20: reloadPct (0..100)
  number, // 21: weapon0Idx
  number, // 22: weapon1Idx
];

export type SnapshotProjectileTuple = [
  number, // 0: numeric id
  number, // 1: kind (PROJ_KIND_*)
  number, // 2: x
  number, // 3: y
  number, // 4: vx
  number, // 5: vy
  number, // 6: killWeaponIdx
];

export type SnapshotEventTuple = [
  number, // 0: kind (EVENT_KIND_*)
  number, // 1: x
  number, // 2: y
  number, // 3: aux1 (angle_i16 or radius or materialIdx or pickupIdx)
  number, // 4: aux2 (killWeaponIdx or damage)
  string, // 5: actorId
  string, // 6: targetId (or "")
  number, // 7: vx (impulse)
  number, // 8: vy (impulse)
];

export interface ServerSnapshotPacket {
  t: typeof PW_BIN_TYPE_SNAPSHOT;
  tick: number;
  st: number;
  acks: Record<string, number>;
  solo: number | null;
  p: SnapshotPlayerTuple[];
  pr: SnapshotProjectileTuple[];
  ev: SnapshotEventTuple[];
  kf: PocketWarKillFeedEntry[];
  /** Currently destroyed block IDs */
  db: string[];
  /** Pickup pads currently on cooldown: [padId, msRemaining] */
  pk: Array<[string, number]>;
}

export function packPlayerTuple(p: SnapshotPlayerState): SnapshotPlayerTuple {
  return [
    p.userId,
    Math.round(p.x * 10) / 10,
    Math.round(p.y * 10) / 10,
    Math.round(p.vx),
    Math.round(p.vy),
    Math.round(p.aimAngle * 1000),
    Math.round(p.hp),
    Math.round(p.maxHp),
    p.livesLeft,
    Math.round(p.jetpackFuel * 10) / 10,
    p.flags,
    p.activeSlot,
    p.ammo,
    p.reserveAmmo,
    p.bombsLeft,
    p.kills,
    p.deaths,
    Math.round(p.damageDealt),
    Math.max(0, Math.round(p.respawnMsLeft)),
    Math.max(0, Math.round(p.invulnMsLeft)),
    Math.max(0, Math.min(100, Math.round(p.reloadPct))),
    weaponIdToIndex(p.weapon0),
    weaponIdToIndex(p.weapon1),
  ];
}

export function unpackPlayerTuple(t: SnapshotPlayerTuple): SnapshotPlayerState {
  return {
    userId: t[0],
    x: t[1],
    y: t[2],
    vx: t[3],
    vy: t[4],
    aimAngle: t[5] / 1000,
    hp: t[6],
    maxHp: t[7],
    livesLeft: t[8],
    jetpackFuel: t[9],
    flags: t[10],
    activeSlot: t[11] === 1 ? 1 : 0,
    ammo: t[12],
    reserveAmmo: t[13],
    bombsLeft: t[14],
    kills: t[15],
    deaths: t[16],
    damageDealt: t[17],
    respawnMsLeft: t[18],
    invulnMsLeft: t[19],
    reloadPct: t[20],
    weapon0: indexToWeaponId(t[21]),
    weapon1: indexToWeaponId(t[22]),
  };
}

export function encodeClientInput(packet: ClientInputPacket): Uint8Array {
  return encode(packet);
}

export function encodeServerSnapshot(packet: ServerSnapshotPacket): Uint8Array {
  return encode(packet);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function decodeClientInput(bytes: Uint8Array): ClientInputPacket | null {
  try {
    const raw = decode(bytes);
    if (!isPlainObject(raw) || raw.t !== PW_BIN_TYPE_INPUT) return null;
    if (
      typeof raw.seq !== "number" ||
      !Number.isFinite(raw.seq) ||
      typeof raw.mx !== "number" ||
      !Number.isFinite(raw.mx) ||
      typeof raw.fl !== "number" ||
      !Number.isFinite(raw.fl) ||
      typeof raw.aim !== "number" ||
      !Number.isFinite(raw.aim) ||
      (raw.sl !== 0 && raw.sl !== 1) ||
      typeof raw.ct !== "number" ||
      !Number.isFinite(raw.ct)
    ) {
      return null;
    }
    const steps =
      typeof raw.st === "number" && Number.isFinite(raw.st)
        ? Math.max(0, Math.min(6, Math.floor(raw.st)))
        : undefined;
    return {
      t: PW_BIN_TYPE_INPUT,
      seq: Math.max(0, Math.floor(raw.seq)),
      mx: Math.max(-100, Math.min(100, Math.round(raw.mx))),
      fl: raw.fl & 0xffff,
      aim: Math.max(-6284, Math.min(6284, Math.round(raw.aim))),
      sl: raw.sl,
      ct: Math.max(0, Math.floor(raw.ct)),
      ...(steps !== undefined ? { st: steps } : {}),
    };
  } catch {
    return null;
  }
}

export function decodeServerSnapshot(
  bytes: Uint8Array,
): ServerSnapshotPacket | null {
  try {
    const raw = decode(bytes);
    if (!isPlainObject(raw) || raw.t !== PW_BIN_TYPE_SNAPSHOT) return null;
    if (
      typeof raw.tick !== "number" ||
      typeof raw.st !== "number" ||
      !Array.isArray(raw.p) ||
      !Array.isArray(raw.pr) ||
      !Array.isArray(raw.ev)
    ) {
      return null;
    }
    return raw as unknown as ServerSnapshotPacket;
  } catch {
    return null;
  }
}
