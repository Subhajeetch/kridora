import { z } from "zod";

export type PocketWarPhase = "setup" | "playing" | "game_over";
export type PocketWarMapId = "emerald_falls";
export type PocketWarCharacterId = "rex" | "nova";
export type WeaponId =
  "m4a1" | "vector_smg" | "pistol" | "spas12" | "barrett50" | "rpg7";
export type KillWeaponIconId = WeaponId | "grenade" | "melee" | "barrel";
export type TerrainMaterial =
  "mud" | "rock" | "wood" | "tree" | "concrete" | "barrel";
export type PickupKind =
  | "weapon_spas12"
  | "weapon_barrett50"
  | "weapon_rpg7"
  | "weapon_m4a1"
  | "medkit"
  | "grenade_pack";

export const POCKET_WAR_LIMITS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  STARTING_LIVES: 3,
  RESPAWN_DELAY_MS: 3000,
  SPAWN_PROTECTION_MS: 2200,
  SETUP_COUNTDOWN_MS: 3000,
  SOLO_WAIT_GRACE_MS: 180_000,
  KILL_FEED_TTL_MS: 2000,
  HEALTH_REGEN_DELAY_MS: 6000,
  HEALTH_REGEN_PER_SEC: 5,
  MAX_CHAT_MESSAGES: 120,
  MAX_CHAT_LENGTH: 300,
  CHAT_RATE_LIMIT_MS: 750,
  WORLD_WIDTH: 4400,
  WORLD_HEIGHT: 1900,
  PIXELS_PER_METER: 30,
  FIXED_DT: 1 / 60,
  SERVER_TICK_MS: 50,
  CEILING_Y: 64,
  CEILING_SOFT_ZONE_Y: 230,
  WATER_SURFACE_Y: 1730,
  MAX_GRENADES: 3,
  BOMB_COOLDOWN_MS: 2400,
  GRENADE_FUSE_SEC: 2.2,
  MELEE_COOLDOWN_MS: 580,
  MELEE_REACH: 88,
  JETPACK_OVERHEAT_MS: 1150,
  PICKUP_RESPAWN_MS: 18000,
  PICKUP_RADIUS: 46,
  PLAYER_RADIUS_PX: 20,
  PLAYER_HALF_W: 18,
  PLAYER_HALF_H: 24,
} as const;

export const MAP_IDS: readonly PocketWarMapId[] = ["emerald_falls"] as const;

export const CHARACTER_IDS: readonly PocketWarCharacterId[] = [
  "rex",
  "nova",
] as const;

export const WEAPON_IDS: readonly WeaponId[] = [
  "m4a1",
  "vector_smg",
  "pistol",
  "spas12",
  "barrett50",
  "rpg7",
] as const;

export const KILL_WEAPON_IDS: readonly KillWeaponIconId[] = [
  "m4a1",
  "vector_smg",
  "pistol",
  "spas12",
  "barrett50",
  "rpg7",
  "grenade",
  "melee",
  "barrel",
] as const;

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  shortName: string;
  category:
    | "Assault Rifle"
    | "Submachine Gun"
    | "Sidearm"
    | "Shotgun"
    | "Sniper Rifle"
    | "Rocket Launcher";
  description: string;
  iconPath: string;
  projectileType: "bullet" | "pellet" | "rocket";
  damage: number;
  pellets: number;
  fireRateMs: number;
  magSize: number;
  /** -1 indicates unlimited reserve ammunition (sidearm). */
  defaultReserveAmmo: number;
  reloadTimeMs: number;
  bulletSpeed: number;
  bulletGravity: number;
  maxRangePx: number;
  spreadRad: number;
  recoil: number;
  blastRadius: number;
  knockback: number;
  color: string;
  isAutomatic: boolean;
}

export const WEAPON_CATALOG: Record<WeaponId, WeaponDefinition> = {
  m4a1: {
    id: "m4a1",
    name: "M4A1 Carbine",
    shortName: "M4A1",
    category: "Assault Rifle",
    description:
      "Versatile full-auto jungle carbine with steady mid-range accuracy.",
    iconPath: "/assets/pocket-war/icons/weapon_m4a1.png",
    projectileType: "bullet",
    damage: 14,
    pellets: 1,
    fireRateMs: 125,
    magSize: 30,
    defaultReserveAmmo: 150,
    reloadTimeMs: 1450,
    bulletSpeed: 1380,
    bulletGravity: 75,
    maxRangePx: 1450,
    spreadRad: 0.036,
    recoil: 45,
    blastRadius: 0,
    knockback: 80,
    color: "#FFE066",
    isAutomatic: true,
  },
  vector_smg: {
    id: "vector_smg",
    name: "Vector SMG",
    shortName: "VECTOR",
    category: "Submachine Gun",
    description:
      "High-cadence compact submachine gun built for agile aerial strafing.",
    iconPath: "/assets/pocket-war/icons/weapon_vector_smg.png",
    projectileType: "bullet",
    damage: 10,
    pellets: 1,
    fireRateMs: 92,
    magSize: 32,
    defaultReserveAmmo: 160,
    reloadTimeMs: 1250,
    bulletSpeed: 1280,
    bulletGravity: 90,
    maxRangePx: 1180,
    spreadRad: 0.05,
    recoil: 32,
    blastRadius: 0,
    knockback: 60,
    color: "#7DD3FC",
    isAutomatic: true,
  },
  pistol: {
    id: "pistol",
    name: "Tactical 9mm",
    shortName: "PISTOL",
    category: "Sidearm",
    description:
      "Crisp backup sidearm with unlimited reserve clips so you are never unarmed.",
    iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
    projectileType: "bullet",
    damage: 16,
    pellets: 1,
    fireRateMs: 250,
    magSize: 12,
    defaultReserveAmmo: -1,
    reloadTimeMs: 1100,
    bulletSpeed: 1320,
    bulletGravity: 80,
    maxRangePx: 1250,
    spreadRad: 0.024,
    recoil: 38,
    blastRadius: 0,
    knockback: 72,
    color: "#FDE68A",
    isAutomatic: false,
  },
  spas12: {
    id: "spas12",
    name: "SPAS-12 Breacher",
    shortName: "SPAS-12",
    category: "Shotgun",
    description:
      "Fires 7 heavy buckshot pellets in a wide cone—devastating in tight caverns.",
    iconPath: "/assets/pocket-war/icons/weapon_spas12.png",
    projectileType: "pellet",
    damage: 9,
    pellets: 7,
    fireRateMs: 740,
    magSize: 6,
    defaultReserveAmmo: 24,
    reloadTimeMs: 1650,
    bulletSpeed: 1080,
    bulletGravity: 130,
    maxRangePx: 680,
    spreadRad: 0.21,
    recoil: 155,
    blastRadius: 0,
    knockback: 185,
    color: "#FCA5A5",
    isAutomatic: false,
  },
  barrett50: {
    id: "barrett50",
    name: "Barrett .50 Rail",
    shortName: "BARRETT",
    category: "Sniper Rifle",
    description:
      "High-velocity anti-materiel sniper rifle. Pair with 5X Scope for canyon picks.",
    iconPath: "/assets/pocket-war/icons/weapon_barrett50.png",
    projectileType: "bullet",
    damage: 52,
    pellets: 1,
    fireRateMs: 1050,
    magSize: 5,
    defaultReserveAmmo: 20,
    reloadTimeMs: 1950,
    bulletSpeed: 2150,
    bulletGravity: 30,
    maxRangePx: 2300,
    spreadRad: 0.004,
    recoil: 190,
    blastRadius: 0,
    knockback: 250,
    color: "#67E8F9",
    isAutomatic: false,
  },
  rpg7: {
    id: "rpg7",
    name: "RPG-7 Launcher",
    shortName: "RPG-7",
    category: "Rocket Launcher",
    description:
      "Launches high-explosive warheads that shatter crates and launch rivals.",
    iconPath: "/assets/pocket-war/icons/weapon_rpg7.png",
    projectileType: "rocket",
    damage: 64,
    pellets: 1,
    fireRateMs: 1450,
    magSize: 2,
    defaultReserveAmmo: 6,
    reloadTimeMs: 2150,
    bulletSpeed: 680,
    bulletGravity: 105,
    maxRangePx: 2100,
    spreadRad: 0.014,
    recoil: 215,
    blastRadius: 155,
    knockback: 450,
    color: "#FF6B1A",
    isAutomatic: false,
  },
};

export interface CharacterAbilityInfo {
  id: string;
  name: string;
  badge: string;
  description: string;
  iconPath: string;
}

export interface CharacterPalette {
  suitPrimary: string;
  suitSecondary: string;
  sashColor: string;
  skinColor: string;
  hairColor: string;
  headgearColor: string;
  visorOrEyeAccent: string;
  markerColor: string;
}

export interface CharacterDefinition {
  id: PocketWarCharacterId;
  name: string;
  gender: "boy" | "girl";
  role: string;
  description: string;
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  maxHp: number;
  moveSpeed: number;
  jetpackThrust: number;
  jetpackDrainPerSec: number;
  startingBombs: number;
  meleeDamage: number;
  stats: {
    hp: number;
    mobility: number;
    jetpack: number;
    accuracy: number;
  };
  palette: CharacterPalette;
  abilities: CharacterAbilityInfo[];
}

export const CHARACTER_CATALOG: Record<
  PocketWarCharacterId,
  CharacterDefinition
> = {
  rex: {
    id: "rex",
    name: "REX",
    gender: "boy",
    role: "Jungle Commando",
    description:
      "Frontline trooper equipped with an armored vest, M4A1 carbine, and twin-tank thruster pack.",
    primaryWeaponId: "m4a1",
    secondaryWeaponId: "pistol",
    maxHp: 125,
    moveSpeed: 350,
    jetpackThrust: 735,
    jetpackDrainPerSec: 16.5,
    startingBombs: 3,
    meleeDamage: 36,
    stats: { hp: 86, mobility: 82, jetpack: 84, accuracy: 84 },
    palette: {
      suitPrimary: "#365314",
      suitSecondary: "#1E293B",
      sashColor: "#F97316",
      skinColor: "#C68652",
      hairColor: "#1C1917",
      headgearColor: "#4D7C0F",
      visorOrEyeAccent: "#FACC15",
      markerColor: "#38BDF8",
    },
    abilities: [
      {
        id: "rex_primary",
        name: "M4A1 Carbine",
        badge: "30 / 150",
        description:
          "Automatic 5.56mm rifle (14 DMG/shot, 480 RPM) for open waterfall gaps.",
        iconPath: "/assets/pocket-war/icons/weapon_m4a1.png",
      },
      {
        id: "rex_sidearm",
        name: "Tactical 9mm",
        badge: "∞ AMMO",
        description:
          "Backup semi-auto pistol (16 DMG/shot) with unlimited reserve clips.",
        iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
      },
      {
        id: "rex_grenade",
        name: "Frag Grenade",
        badge: "3x",
        description:
          "Bouncing explosive (64 max AoE DMG, 2.2s fuse) with live arc preview.",
        iconPath: "/assets/pocket-war/icons/ability_grenade.png",
      },
      {
        id: "rex_jetpack",
        name: "Twin-Tank Jetpack",
        badge: "6.1s BURN",
        description:
          "High-lift thruster pack that recharges rapidly when grounded.",
        iconPath: "/assets/pocket-war/icons/ability_jetpack.png",
      },
      {
        id: "rex_melee",
        name: "Commando Strike",
        badge: "36 DMG",
        description:
          "Close-quarters heavy bash dealing 36 damage with strong knockback.",
        iconPath: "/assets/pocket-war/icons/ability_melee.png",
      },
    ],
  },
  nova: {
    id: "nova",
    name: "NOVA",
    gender: "girl",
    role: "Recon Striker",
    description:
      "Agile aerial specialist with a Vector SMG and extended-burn aero thrusters.",
    primaryWeaponId: "vector_smg",
    secondaryWeaponId: "pistol",
    maxHp: 115,
    moveSpeed: 375,
    jetpackThrust: 770,
    jetpackDrainPerSec: 14.8,
    startingBombs: 3,
    meleeDamage: 34,
    stats: { hp: 78, mobility: 90, jetpack: 92, accuracy: 90 },
    palette: {
      suitPrimary: "#1E293B",
      suitSecondary: "#0F172A",
      sashColor: "#0EA5E9",
      skinColor: "#F1C29B",
      hairColor: "#78350F",
      headgearColor: "#334155",
      visorOrEyeAccent: "#38BDF8",
      markerColor: "#38BDF8",
    },
    abilities: [
      {
        id: "nova_primary",
        name: "Vector SMG",
        badge: "32 / 160",
        description:
          "Rapid-fire submachine gun (10 DMG/shot, 650 RPM) for agile strafing.",
        iconPath: "/assets/pocket-war/icons/weapon_vector_smg.png",
      },
      {
        id: "nova_sidearm",
        name: "Tactical 9mm",
        badge: "∞ AMMO",
        description:
          "Backup semi-auto pistol (16 DMG/shot) with unlimited reserve clips.",
        iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
      },
      {
        id: "nova_grenade",
        name: "Frag Grenade",
        badge: "3x",
        description:
          "Bouncing explosive (64 max AoE DMG, 2.2s fuse) with live arc preview.",
        iconPath: "/assets/pocket-war/icons/ability_grenade.png",
      },
      {
        id: "nova_jetpack",
        name: "Aero-Lite Jetpack",
        badge: "6.8s BURN",
        description:
          "Lightweight thrusters offering best-in-class airtime and climbs.",
        iconPath: "/assets/pocket-war/icons/ability_jetpack.png",
      },
      {
        id: "nova_melee",
        name: "Striker Bash",
        badge: "34 DMG",
        description:
          "Fast close-quarters strike dealing 34 damage and knockback.",
        iconPath: "/assets/pocket-war/icons/ability_melee.png",
      },
    ],
  },
};

export interface PlatformRect {
  x: number;
  y: number;
  width: number;
  height: number;
  isOneWay?: boolean;
  style?:
    | "moss_island"
    | "moss_cliff"
    | "log_bridge"
    | "rock_arch"
    | "river_rock"
    | "bounds";
}

export interface SlopeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isOneWay?: boolean;
}

export interface CollisionChainDef {
  loop: boolean;
  points: Array<[number, number]>;
}

export interface CollisionMapData {
  version: number;
  mapId: string;
  worldWidth: number;
  worldHeight: number;
  pixelsPerMeter: number;
  chains: CollisionChainDef[];
}

export interface DestructibleBlockDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  material: TerrainMaterial;
  maxHp: number;
}

export interface DestructibleBlockState extends DestructibleBlockDef {
  hp: number;
  destroyed: boolean;
}

export interface PickupPadDef {
  id: string;
  kind: PickupKind;
  label: string;
  x: number;
  y: number;
}

export interface PickupPadState extends PickupPadDef {
  availableAt: number;
}

export interface WaterfallAnchor {
  x: number;
  topY: number;
  bottomY: number;
  width: number;
}

export interface VineAnchor {
  x: number;
  topY: number;
  length: number;
  phase: number;
}

export interface MapLayerAssets {
  sky: string;
  mountains: string;
  midJungle: string;
  terrain: string;
  thumbnail: string;
  collisionJson: string;
}

export interface MapDefinition {
  id: PocketWarMapId;
  name: string;
  tagline: string;
  width: number;
  height: number;
  waterSurfaceY: number;
  skyTop: string;
  skyBottom: string;
  groundTint: string;
  accentGlow: string;
  assets: MapLayerAssets;
  platforms: PlatformRect[];
  slopes: SlopeSegment[];
  destructibles: DestructibleBlockDef[];
  pickupPads: PickupPadDef[];
  spawnPoints: Array<{ x: number; y: number }>;
  waterfalls: WaterfallAnchor[];
  vines: VineAnchor[];
}

const W = POCKET_WAR_LIMITS.WORLD_WIDTH;
const H = POCKET_WAR_LIMITS.WORLD_HEIGHT;

const EMERALD_BOUNDS: PlatformRect[] = [
  {
    x: 0,
    y: 0,
    width: W,
    height: POCKET_WAR_LIMITS.CEILING_Y,
    style: "bounds",
  },
  { x: 0, y: 0, width: 48, height: H, style: "bounds" },
  { x: W - 48, y: 0, width: 48, height: H, style: "bounds" },
  { x: 0, y: H - 40, width: W, height: 40, style: "bounds" },
];

/**
 * Expanded 4400 x 1900 multi-zone Emerald Falls arena:
 * - Zone 1 (West): Ancient Gnarly Tree Cliff + Upper/Lower Jungle Terraces
 * - Zone 2 (Center-West): Twin Cascading Waterfalls + Fallen Log Bridge + Floating Moss Isles
 * - Zone 3 (Center-East): Towering Stone Arch Fly-Through Tunnel + Overhang Sniper Crown
 * - Zone 4 (Far-East): Sky Floating Moss Isle + Cliffside Ruins + River Boulders
 */
export const MAP_CATALOG: Record<PocketWarMapId, MapDefinition> = {
  emerald_falls: {
    id: "emerald_falls",
    name: "EMERALD FALLS",
    tagline:
      "Vast 4-zone jungle canyon with cascading waterfalls, fallen log bridge, floating moss isles, and stone arch tunnel.",
    width: W,
    height: H,
    waterSurfaceY: POCKET_WAR_LIMITS.WATER_SURFACE_Y,
    skyTop: "#60C5F1",
    skyBottom: "#DDF3FD",
    groundTint: "#3F3832",
    accentGlow: "#4ADE80",
    assets: {
      sky: "/assets/pocket-war/maps/emerald-falls/layer0_sky.png",
      mountains: "/assets/pocket-war/maps/emerald-falls/layer1_mountains.png",
      midJungle:
        "/assets/pocket-war/maps/emerald-falls/layer2_jungle_waterfall.png",
      terrain:
        "/assets/pocket-war/maps/emerald-falls/layer3_terrain_platforms.png",
      thumbnail: "/assets/pocket-war/maps/emerald-falls/thumbnail.png",
      collisionJson: "/assets/pocket-war/maps/emerald-falls/collision.json",
    },
    platforms: [
      ...EMERALD_BOUNDS,
      // === ZONE 1: WEST ANCIENT TREE CLIFFS (X: 48 - 1220) ===
      { x: 48, y: 540, width: 320, height: 155, style: "moss_cliff" },
      { x: 48, y: 1020, width: 420, height: 190, style: "moss_cliff" },
      { x: 48, y: 1450, width: 490, height: 310, style: "moss_cliff" },
      { x: 540, y: 460, width: 540, height: 245, style: "moss_cliff" },
      { x: 640, y: 1180, width: 440, height: 230, style: "moss_cliff" },

      // === ZONE 2: CENTRAL WATERFALL BASIN & FLOATING ISLES (X: 1060 - 2520) ===
      {
        x: 1070,
        y: 690,
        width: 430,
        height: 30,
        isOneWay: true,
        style: "log_bridge",
      },
      { x: 1485, y: 700, width: 420, height: 190, style: "moss_island" },
      {
        x: 1560,
        y: 350,
        width: 340,
        height: 92,
        isOneWay: true,
        style: "moss_island",
      },
      { x: 1260, y: 1360, width: 390, height: 145, style: "moss_island" },
      { x: 1970, y: 1040, width: 300, height: 120, style: "moss_island" },
      { x: 1960, y: 1430, width: 580, height: 320, style: "moss_cliff" },

      // === ZONE 3: EAST STONE ARCH & FLY-THROUGH TUNNEL (X: 2440 - 3460) ===
      { x: 2460, y: 380, width: 760, height: 170, style: "rock_arch" },
      { x: 2480, y: 870, width: 720, height: 165, style: "moss_cliff" },
      { x: 2990, y: 1035, width: 210, height: 300, style: "rock_arch" },
      { x: 2640, y: 1335, width: 580, height: 205, style: "moss_cliff" },

      // === ZONE 4: FAR-EAST SKY ISLES & CANYON SHORE (X: 3280 - 4352) ===
      { x: 3360, y: 510, width: 380, height: 160, style: "moss_island" },
      { x: 3920, y: 410, width: 432, height: 185, style: "moss_cliff" },
      { x: 3640, y: 950, width: 420, height: 180, style: "moss_cliff" },
      { x: 3960, y: 1220, width: 392, height: 220, style: "moss_cliff" },
      { x: 3560, y: 1510, width: 792, height: 260, style: "moss_cliff" },

      // === RIVER STEPPING BOULDERS (above water surface Y: 1730) ===
      { x: 610, y: 1675, width: 155, height: 85, style: "river_rock" },
      { x: 960, y: 1660, width: 180, height: 100, style: "river_rock" },
      { x: 1685, y: 1670, width: 175, height: 90, style: "river_rock" },
      { x: 2640, y: 1665, width: 180, height: 95, style: "river_rock" },
      { x: 3180, y: 1675, width: 165, height: 85, style: "river_rock" },
    ],
    slopes: [
      { x1: 1065, y1: 670, x2: 1165, y2: 690, isOneWay: true },
      { x1: 1885, y1: 1475, x2: 1965, y2: 1430, isOneWay: true },
      { x1: 3480, y1: 1550, x2: 3565, y2: 1510, isOneWay: true },
    ],
    destructibles: [
      {
        id: "ef-crate-west",
        x: 820,
        y: 396,
        width: 68,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-center",
        x: 1660,
        y: 636,
        width: 72,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-arch",
        x: 2635,
        y: 806,
        width: 68,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-low",
        x: 2180,
        y: 1366,
        width: 72,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-east",
        x: 3770,
        y: 886,
        width: 70,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-plank-1",
        x: 995,
        y: 380,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      {
        id: "ef-plank-2",
        x: 2560,
        y: 300,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      {
        id: "ef-plank-3",
        x: 3460,
        y: 430,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      {
        id: "ef-rock-1",
        x: 1350,
        y: 1290,
        width: 84,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      {
        id: "ef-rock-2",
        x: 260,
        y: 950,
        width: 82,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      {
        id: "ef-rock-3",
        x: 4060,
        y: 1150,
        width: 84,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      {
        id: "ef-barrel-1",
        x: 1555,
        y: 650,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-2",
        x: 2935,
        y: 820,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-3",
        x: 940,
        y: 1130,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-4",
        x: 2370,
        y: 1380,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-5",
        x: 3890,
        y: 900,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
    ],
    pickupPads: [
      {
        id: "pad-sniper-sky",
        kind: "weapon_barrett50",
        label: "Barrett .50",
        x: 1730,
        y: 318,
      },
      {
        id: "pad-rpg-arch",
        kind: "weapon_rpg7",
        label: "RPG-7",
        x: 2800,
        y: 838,
      },
      {
        id: "pad-shotgun-basin",
        kind: "weapon_spas12",
        label: "SPAS-12",
        x: 1455,
        y: 1328,
      },
      {
        id: "pad-ar-west",
        kind: "weapon_m4a1",
        label: "M4A1",
        x: 685,
        y: 428,
      },
      {
        id: "pad-medkit-east",
        kind: "medkit",
        label: "+45 HP",
        x: 3550,
        y: 478,
      },
      {
        id: "pad-medkit-west",
        kind: "medkit",
        label: "+45 HP",
        x: 220,
        y: 988,
      },
      {
        id: "pad-grenade-low",
        kind: "grenade_pack",
        label: "+2 Frags",
        x: 2110,
        y: 1398,
      },
      {
        id: "pad-sniper-east",
        kind: "weapon_barrett50",
        label: "Barrett .50",
        x: 4135,
        y: 378,
      },
    ],
    spawnPoints: [
      { x: 195, y: 470 },
      { x: 395, y: 950 },
      { x: 280, y: 1380 },
      { x: 680, y: 390 },
      { x: 840, y: 1110 },
      { x: 1280, y: 620 },
      { x: 1720, y: 285 },
      { x: 1750, y: 630 },
      { x: 1545, y: 1290 },
      { x: 2115, y: 970 },
      { x: 2310, y: 1360 },
      { x: 2740, y: 310 },
      { x: 2545, y: 800 },
      { x: 2920, y: 1265 },
      { x: 3550, y: 440 },
      { x: 3710, y: 880 },
      { x: 4140, y: 340 },
      { x: 3920, y: 1440 },
    ],
    waterfalls: [
      { x: 1030, topY: 580, bottomY: 1745, width: 280 },
      { x: 1850, topY: 820, bottomY: 1745, width: 150 },
      { x: 3210, topY: 680, bottomY: 1745, width: 180 },
      { x: 4050, topY: 575, bottomY: 1745, width: 145 },
    ],
    vines: [
      { x: 580, topY: 700, length: 155, phase: 0.2 },
      { x: 680, topY: 700, length: 195, phase: 1.1 },
      { x: 1525, topY: 885, length: 145, phase: 0.7 },
      { x: 1835, topY: 885, length: 170, phase: 2.0 },
      { x: 2515, topY: 545, length: 165, phase: 0.4 },
      { x: 2635, topY: 545, length: 125, phase: 1.7 },
      { x: 2805, topY: 545, length: 145, phase: 2.5 },
      { x: 3115, topY: 545, length: 180, phase: 0.9 },
      { x: 3415, topY: 665, length: 150, phase: 1.4 },
      { x: 3685, topY: 665, length: 135, phase: 2.8 },
      { x: 4010, topY: 590, length: 160, phase: 0.6 },
    ],
  },
};

export interface WeaponSlotState {
  weaponId: WeaponId;
  ammo: number;
  reserveAmmo: number;
  reloadingUntil: number;
}

export interface PocketWarPlayer {
  userId: string;
  username: string;
  characterId: PocketWarCharacterId;
  isReady: boolean;
  /** True once the player explicitly leaves the active or finished match while remaining in the room. */
  leftMatch?: boolean;
  isAlive: boolean;
  livesLeft: number;
  maxLives: number;
  deaths: number;
  eliminatedAt: number | null;
  respawnAt: number | null;
  invulnerableUntil: number;
  placement: number | null;
  hp: number;
  maxHp: number;
  lastDamagedAt: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  isBoosting: boolean;
  jetpackFuel: number;
  jetpackOverheatedUntil: number;
  isScoped: boolean;
  activeSlot: 0 | 1;
  weapons: [WeaponSlotState, WeaponSlotState];
  bombsLeft: number;
  lastBombAt: number;
  lastMeleeAt: number;
  kills: number;
  damageDealt: number;
}

export interface PocketWarKillFeedEntry {
  id: string;
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponId: KillWeaponIconId;
  weaponLabel: string;
  timestamp: number;
}

export interface PocketWarChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface PocketWarEvent {
  id: string;
  type:
    | "shot"
    | "explosion"
    | "melee"
    | "block_break"
    | "player_death"
    | "player_respawn"
    | "hit"
    | "pickup"
    | "water_splash";
  x: number;
  y: number;
  angle?: number;
  radius?: number;
  weaponId?: KillWeaponIconId;
  material?: TerrainMaterial;
  pickupKind?: PickupKind;
  actorId: string;
  targetId?: string;
  damage?: number;
  vx?: number;
  vy?: number;
  timestamp: number;
}

export interface PocketWarSettings {
  mapId: PocketWarMapId;
  friendlyFire: boolean;
}

export const DEFAULT_POCKET_WAR_SETTINGS: PocketWarSettings = {
  mapId: "emerald_falls",
  friendlyFire: false,
};

export interface PocketWarState {
  phase: PocketWarPhase;
  settings: PocketWarSettings;
  setupCountdownEndsAt: number | null;
  matchStartedAt: number | null;
  /** Epoch ms when the 3-minute solo-wait grace period ends if only 1 player is online; null otherwise. */
  soloWaitEndsAt: number | null;
  onlineUserIds: string[];
  winnerUserId: string | null;
  mvpUserId: string | null;
  players: Record<string, PocketWarPlayer>;
  blocks: Record<string, DestructibleBlockState>;
  pickups: Record<string, PickupPadState>;
  killFeed: PocketWarKillFeedEntry[];
  chatMessages: PocketWarChatMessage[];
  recentEvents: PocketWarEvent[];
  recentDeaths: Array<{ x: number; y: number; at: number }>;
  recentSpawns: Record<number, number>;
  lastChatAtByUser: Record<string, number>;
}

export const weaponIdSchema = z.enum([
  "m4a1",
  "vector_smg",
  "pistol",
  "spas12",
  "barrett50",
  "rpg7",
]);

/**
 * Discrete low-frequency JSON actions (setup, chat, match lifecycle).
 * High-frequency movement/combat inputs travel exclusively over binary msgpack frames.
 */
export const pocketWarActionPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("select_character"),
    characterId: z.enum(["rex", "nova"]),
  }),
  z.object({
    type: z.literal("toggle_ready"),
    isReady: z.boolean(),
  }),
  z.object({
    type: z.literal("select_map"),
    mapId: z.enum(["emerald_falls"]),
  }),
  z.object({
    type: z.literal("force_start"),
  }),
  z.object({
    type: z.literal("send_chat"),
    text: z.string().min(1).max(POCKET_WAR_LIMITS.MAX_CHAT_LENGTH),
  }),
  z.object({
    type: z.literal("play_again"),
  }),
  z.object({
    type: z.literal("leave_match"),
  }),
]);

export type PocketWarActionPayload = z.infer<
  typeof pocketWarActionPayloadSchema
>;

export function sanitizeChatMessage(raw: string): string {
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]/g, "");
  const withoutTags = withoutControls.replace(/[<>]/g, "");
  return withoutTags.trim().slice(0, POCKET_WAR_LIMITS.MAX_CHAT_LENGTH);
}

export function pickRandomMapId(): PocketWarMapId {
  const idx = Math.floor(Math.random() * MAP_IDS.length);
  return MAP_IDS[idx] ?? "emerald_falls";
}
