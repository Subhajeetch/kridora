import { z } from "zod";

export type PocketWarPhase = "setup" | "playing" | "game_over";
export type PocketWarMapId = "emerald_falls";
export type PocketWarCharacterId = "rex" | "nova";
export type WeaponId =
  | "m4a1"
  | "vector_smg"
  | "pistol"
  | "spas12"
  | "barrett50"
  | "rpg7";
export type KillWeaponIconId = WeaponId | "grenade" | "melee" | "barrel";
export type TerrainMaterial =
  | "mud"
  | "rock"
  | "wood"
  | "tree"
  | "concrete"
  | "barrel";
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
  HEALTH_REGEN_DELAY_MS: 6000,
  HEALTH_REGEN_PER_SEC: 4,
  MAX_CHAT_MESSAGES: 120,
  MAX_CHAT_LENGTH: 300,
  CHAT_RATE_LIMIT_MS: 750,
  WORLD_WIDTH: 3600,
  WORLD_HEIGHT: 1600,
  CEILING_Y: 60,
  CEILING_SOFT_ZONE_Y: 220,
  WATER_SURFACE_Y: 1440,
  MAX_GRENADES: 3,
  BOMB_COOLDOWN_MS: 2600,
  MELEE_COOLDOWN_MS: 600,
  MELEE_REACH: 84,
  JETPACK_OVERHEAT_MS: 1200,
  PICKUP_RESPAWN_MS: 18000,
  PICKUP_RADIUS: 44,
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
  /* -1 indicates unlimited reserve ammunition (sidearm). */
  defaultReserveAmmo: number;
  reloadTimeMs: number;
  bulletSpeed: number;
  bulletGravity: number;
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
      "Versatile full-auto jungle carbine with controllable recoil and steady mid-range accuracy.",
    iconPath: "/assets/pocket-war/icons/weapon_m4a1.png",
    projectileType: "bullet",
    damage: 12,
    pellets: 1,
    fireRateMs: 125,
    magSize: 30,
    defaultReserveAmmo: 150,
    reloadTimeMs: 1450,
    bulletSpeed: 1300,
    bulletGravity: 80,
    spreadRad: 0.038,
    recoil: 48,
    blastRadius: 0,
    knockback: 75,
    color: "#FFE066",
    isAutomatic: true,
  },
  vector_smg: {
    id: "vector_smg",
    name: "Vector SMG",
    shortName: "VECTOR",
    category: "Submachine Gun",
    description:
      "High-cadence compact submachine gun built for agile aerial strafing and rapid bursts.",
    iconPath: "/assets/pocket-war/icons/weapon_vector_smg.png",
    projectileType: "bullet",
    damage: 9,
    pellets: 1,
    fireRateMs: 90,
    magSize: 32,
    defaultReserveAmmo: 160,
    reloadTimeMs: 1250,
    bulletSpeed: 1220,
    bulletGravity: 95,
    spreadRad: 0.052,
    recoil: 34,
    blastRadius: 0,
    knockback: 55,
    color: "#7DD3FC",
    isAutomatic: true,
  },
  pistol: {
    id: "pistol",
    name: "Tactical 9mm",
    shortName: "PISTOL",
    category: "Sidearm",
    description:
      "Crisp backup sidearm with unlimited reserve clips so you are never left unarmed.",
    iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
    projectileType: "bullet",
    damage: 15,
    pellets: 1,
    fireRateMs: 260,
    magSize: 12,
    defaultReserveAmmo: -1,
    reloadTimeMs: 1100,
    bulletSpeed: 1250,
    bulletGravity: 85,
    spreadRad: 0.025,
    recoil: 40,
    blastRadius: 0,
    knockback: 70,
    color: "#FDE68A",
    isAutomatic: false,
  },
  spas12: {
    id: "spas12",
    name: "SPAS-12 Breacher",
    shortName: "SPAS-12",
    category: "Shotgun",
    description:
      "Fires 7 heavy buckshot pellets in a wide cone—devastating in tight waterfall caverns.",
    iconPath: "/assets/pocket-war/icons/weapon_spas12.png",
    projectileType: "pellet",
    damage: 8,
    pellets: 7,
    fireRateMs: 740,
    magSize: 6,
    defaultReserveAmmo: 24,
    reloadTimeMs: 1650,
    bulletSpeed: 1040,
    bulletGravity: 140,
    spreadRad: 0.21,
    recoil: 165,
    blastRadius: 0,
    knockback: 175,
    color: "#FCA5A5",
    isAutomatic: false,
  },
  barrett50: {
    id: "barrett50",
    name: "Barrett .50 Rail",
    shortName: "BARRETT",
    category: "Sniper Rifle",
    description:
      "High-velocity anti-materiel sniper rifle. Pair with 5X Scope for cross-canyon picks.",
    iconPath: "/assets/pocket-war/icons/weapon_barrett50.png",
    projectileType: "bullet",
    damage: 48,
    pellets: 1,
    fireRateMs: 1050,
    magSize: 5,
    defaultReserveAmmo: 20,
    reloadTimeMs: 1950,
    bulletSpeed: 1950,
    bulletGravity: 40,
    spreadRad: 0.004,
    recoil: 195,
    blastRadius: 0,
    knockback: 240,
    color: "#67E8F9",
    isAutomatic: false,
  },
  rpg7: {
    id: "rpg7",
    name: "RPG-7 Launcher",
    shortName: "RPG-7",
    category: "Rocket Launcher",
    description:
      "Launches gravity-arcing high-explosive warheads that shatter crates and launch enemies.",
    iconPath: "/assets/pocket-war/icons/weapon_rpg7.png",
    projectileType: "rocket",
    damage: 60,
    pellets: 1,
    fireRateMs: 1450,
    magSize: 2,
    defaultReserveAmmo: 6,
    reloadTimeMs: 2150,
    bulletSpeed: 660,
    bulletGravity: 110,
    spreadRad: 0.015,
    recoil: 220,
    blastRadius: 150,
    knockback: 440,
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
      "Rugged frontline trooper wearing an olive commando beret, armored vest, and twin-tank thruster pack.",
    primaryWeaponId: "m4a1",
    secondaryWeaponId: "pistol",
    maxHp: 125,
    moveSpeed: 345,
    jetpackThrust: 1060,
    jetpackDrainPerSec: 16.5,
    startingBombs: 3,
    meleeDamage: 34,
    stats: {
      hp: 86,
      mobility: 82,
      jetpack: 84,
      accuracy: 84,
    },
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
          "Automatic 5.56mm rifle (12 DMG/shot, 480 RPM). Reliable across open waterfall gaps.",
        iconPath: "/assets/pocket-war/icons/weapon_m4a1.png",
      },
      {
        id: "rex_sidearm",
        name: "Tactical 9mm",
        badge: "∞ AMMO",
        description:
          "Backup semi-auto pistol (15 DMG/shot) with unlimited reserve magazines.",
        iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
      },
      {
        id: "rex_grenade",
        name: "Frag Grenade",
        badge: "3x",
        description:
          "Short parabolic arc explosive (62 max AoE DMG, 2.2s fuse) that bounces off rock and wood.",
        iconPath: "/assets/pocket-war/icons/ability_grenade.png",
      },
      {
        id: "rex_jetpack",
        name: "Twin-Tank Jetpack",
        badge: "6.1s BURN",
        description:
          "High-lift thruster pack for sustained aerial dogfights; recharges rapidly on solid ground.",
        iconPath: "/assets/pocket-war/icons/ability_jetpack.png",
      },
      {
        id: "rex_melee",
        name: "Commando Strike",
        badge: "34 DMG",
        description:
          "Close-quarters heavy bash that deals 34 damage and knocks enemies back.",
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
      "Agile aerial specialist sporting a tactical cap, chestnut ponytail, and high-efficiency vector thrusters.",
    primaryWeaponId: "vector_smg",
    secondaryWeaponId: "pistol",
    maxHp: 115,
    moveSpeed: 370,
    jetpackThrust: 1085,
    jetpackDrainPerSec: 15.0,
    startingBombs: 3,
    meleeDamage: 34,
    stats: {
      hp: 78,
      mobility: 90,
      jetpack: 92,
      accuracy: 90,
    },
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
          "Rapid-fire submachine gun (9 DMG/shot, 667 RPM) with crisp handling during mid-air maneuvers.",
        iconPath: "/assets/pocket-war/icons/weapon_vector_smg.png",
      },
      {
        id: "nova_sidearm",
        name: "Tactical 9mm",
        badge: "∞ AMMO",
        description:
          "Backup semi-auto pistol (15 DMG/shot) with unlimited reserve magazines.",
        iconPath: "/assets/pocket-war/icons/weapon_pistol.png",
      },
      {
        id: "nova_grenade",
        name: "Frag Grenade",
        badge: "3x",
        description:
          "Short parabolic arc explosive (62 max AoE DMG, 2.2s fuse) that bounces off rock and wood.",
        iconPath: "/assets/pocket-war/icons/ability_grenade.png",
      },
      {
        id: "nova_jetpack",
        name: "Aero-Lite Jetpack",
        badge: "6.7s BURN",
        description:
          "Extended-duration lightweight thrusters offering best-in-class airtime and nimble climbs.",
        iconPath: "/assets/pocket-war/icons/ability_jetpack.png",
      },
      {
        id: "nova_melee",
        name: "Striker Bash",
        badge: "34 DMG",
        description:
          "Fast close-quarters strike dealing 34 damage with strong horizontal knockback.",
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
  style?: "moss_island" | "moss_cliff" | "log_bridge" | "rock_arch" | "river_rock" | "bounds";
}

export interface SlopeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isOneWay?: boolean;
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
  foreground: string;
  thumbnail: string;
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

export const MAP_CATALOG: Record<PocketWarMapId, MapDefinition> = {
  emerald_falls: {
    id: "emerald_falls",
    name: "EMERALD FALLS",
    tagline:
      "Floating moss islands, cascading jungle waterfalls, fallen log bridge, and ancient stone arch.",
    width: W,
    height: H,
    waterSurfaceY: POCKET_WAR_LIMITS.WATER_SURFACE_Y,
    skyTop: "#7DD3FC",
    skyBottom: "#E0F2FE",
    groundTint: "#3F3832",
    accentGlow: "#4ADE80",
    assets: {
      sky: "/assets/pocket-war/maps/emerald-falls/layer0_sky.png",
      mountains: "/assets/pocket-war/maps/emerald-falls/layer1_mountains.png",
      midJungle:
        "/assets/pocket-war/maps/emerald-falls/layer2_jungle_waterfall.png",
      terrain:
        "/assets/pocket-war/maps/emerald-falls/layer3_terrain_platforms.png",
      foreground:
        "/assets/pocket-war/maps/emerald-falls/layer4_foreground_foliage.png",
      thumbnail: "/assets/pocket-war/maps/emerald-falls/thumbnail.png",
    },
    platforms: [
      ...EMERALD_BOUNDS,
      // === ZONE 1: WEST ANCIENT TREE CLIFFS (X: 48 - 1120) ===
      // Far-west mossy upper terrace
      { x: 48, y: 660, width: 340, height: 140, style: "moss_cliff" },
      // Far-west lower bank
      { x: 48, y: 1180, width: 420, height: 280, style: "moss_cliff" },
      // Big Tree Cliff (Image 1 top-left cliff under the giant gnarly tree)
      { x: 520, y: 440, width: 520, height: 250, style: "moss_cliff" },
      // Mid-left waterfall cavern ledge
      { x: 560, y: 1030, width: 410, height: 220, style: "moss_cliff" },

      // === ZONE 2: CENTRAL WATERFALL BASIN & FLOATING ISLES (X: 1040 - 2240) ===
      // Fallen Log Bridge (one-way bridge joining Big Tree Cliff to Central Floating Island)
      {
        x: 1035,
        y: 665,
        width: 390,
        height: 28,
        isOneWay: true,
        style: "log_bridge",
      },
      // Central Floating Moss Island (Image 1 center floating island)
      { x: 1410, y: 675, width: 390, height: 185, style: "moss_island" },
      // High Central Sky Perch above waterfall
      {
        x: 1470,
        y: 350,
        width: 310,
        height: 95,
        isOneWay: true,
        style: "moss_island",
      },
      // Lower Waterfall Basin Floating Isle
      { x: 1180, y: 1180, width: 360, height: 135, style: "moss_island" },
      // Lower-Center Mossy Outcrop (Image 1 bottom center-right shelf)
      { x: 1840, y: 1190, width: 540, height: 265, style: "moss_cliff" },

      // === ZONE 3: EAST ROCK ARCH PILLAR & SKY TERRACES (X: 2180 - 3552) ===
      // Towering Rock Arch Crown Plateau (Image 1 top-right overhanging moss cliff)
      { x: 2140, y: 370, width: 690, height: 165, style: "rock_arch" },
      // Rock Arch Left Pillar Column (leaves fly-through tunnel at X: 2340..2580, Y: 535..805)
      { x: 2190, y: 535, width: 145, height: 270, style: "rock_arch" },
      // Rock Arch Right Main Pillar Column
      { x: 2585, y: 535, width: 235, height: 665, style: "rock_arch" },
      // Mid-Arch Floor Shelf (floor of the rock arch opening)
      { x: 2160, y: 805, width: 440, height: 155, style: "moss_cliff" },
      // Upper-Right Floating Moss Island (Image 1 far-right floating island)
      { x: 2940, y: 520, width: 340, height: 155, style: "moss_island" },
      // Far-East Cliffside Terrace
      { x: 3160, y: 920, width: 392, height: 240, style: "moss_cliff" },
      // Far-East Lower Shore
      { x: 3060, y: 1250, width: 492, height: 210, style: "moss_cliff" },

      // === RIVER STEPPING BOULDERS (above water surface Y: 1440) ===
      { x: 510, y: 1395, width: 130, height: 75, style: "river_rock" },
      { x: 840, y: 1380, width: 165, height: 90, style: "river_rock" },
      { x: 1600, y: 1390, width: 155, height: 80, style: "river_rock" },
      { x: 2480, y: 1385, width: 170, height: 85, style: "river_rock" },
      { x: 2820, y: 1395, width: 140, height: 75, style: "river_rock" },
    ],
    slopes: [
      // Gentle natural slope on the fallen log bridge approach
      { x1: 1030, y1: 650, x2: 1120, y2: 665, isOneWay: true },
      // Angled mossy ramp onto lower-center outcrop
      { x1: 1770, y1: 1235, x2: 1845, y2: 1190, isOneWay: true },
    ],
    destructibles: [
      // Wooden supply crates (contain extra ammo/splinters)
      {
        id: "ef-crate-west",
        x: 780,
        y: 376,
        width: 68,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-center",
        x: 1570,
        y: 611,
        width: 72,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-arch",
        x: 2420,
        y: 741,
        width: 68,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      {
        id: "ef-crate-low",
        x: 2040,
        y: 1126,
        width: 72,
        height: 64,
        material: "wood",
        maxHp: 50,
      },
      // Timber plank cover barricades
      {
        id: "ef-plank-1",
        x: 960,
        y: 360,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      {
        id: "ef-plank-2",
        x: 2220,
        y: 290,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      {
        id: "ef-plank-3",
        x: 3010,
        y: 440,
        width: 34,
        height: 80,
        material: "wood",
        maxHp: 45,
      },
      // Destructible mossy rock boulders
      {
        id: "ef-rock-1",
        x: 1260,
        y: 1110,
        width: 84,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      {
        id: "ef-rock-2",
        x: 270,
        y: 590,
        width: 82,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      {
        id: "ef-rock-3",
        x: 3290,
        y: 850,
        width: 84,
        height: 70,
        material: "rock",
        maxHp: 85,
      },
      // Explosive red fuel barrels (chain-detonate!)
      {
        id: "ef-barrel-1",
        x: 1475,
        y: 625,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-2",
        x: 2515,
        y: 755,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-3",
        x: 860,
        y: 980,
        width: 34,
        height: 50,
        material: "barrel",
        maxHp: 24,
      },
      {
        id: "ef-barrel-4",
        x: 2240,
        y: 1140,
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
        x: 1625,
        y: 318,
      },
      {
        id: "pad-rpg-arch",
        kind: "weapon_rpg7",
        label: "RPG-7",
        x: 2455,
        y: 772,
      },
      {
        id: "pad-shotgun-basin",
        kind: "weapon_spas12",
        label: "SPAS-12",
        x: 1360,
        y: 1148,
      },
      {
        id: "pad-ar-west",
        kind: "weapon_m4a1",
        label: "M4A1",
        x: 640,
        y: 408,
      },
      {
        id: "pad-medkit-east",
        kind: "medkit",
        label: "+45 HP",
        x: 3110,
        y: 488,
      },
      {
        id: "pad-grenade-low",
        kind: "grenade_pack",
        label: "+2 Frags",
        x: 1940,
        y: 1158,
      },
    ],
    spawnPoints: [
      { x: 180, y: 600 },
      { x: 240, y: 1120 },
      { x: 640, y: 380 },
      { x: 740, y: 970 },
      { x: 1220, y: 600 },
      { x: 1620, y: 290 },
      { x: 1680, y: 615 },
      { x: 1360, y: 1120 },
      { x: 2120, y: 1130 },
      { x: 2360, y: 310 },
      { x: 2460, y: 745 },
      { x: 3110, y: 460 },
      { x: 3360, y: 860 },
      { x: 3320, y: 1190 },
    ],
    waterfalls: [
      { x: 960, topY: 560, bottomY: 1455, width: 250 },
      { x: 1755, topY: 790, bottomY: 1455, width: 125 },
      { x: 2820, topY: 660, bottomY: 1455, width: 150 },
    ],
    vines: [
      { x: 565, topY: 685, length: 135, phase: 0.2 },
      { x: 635, topY: 685, length: 175, phase: 1.1 },
      { x: 1445, topY: 855, length: 125, phase: 0.7 },
      { x: 1735, topY: 855, length: 155, phase: 2.0 },
      { x: 2175, topY: 530, length: 145, phase: 0.4 },
      { x: 2295, topY: 530, length: 115, phase: 1.7 },
      { x: 2450, topY: 530, length: 130, phase: 2.5 },
      { x: 2740, topY: 530, length: 165, phase: 0.9 },
      { x: 2985, topY: 670, length: 140, phase: 1.4 },
      { x: 3210, topY: 670, length: 120, phase: 2.8 },
    ],
  },
};

export interface WeaponSlotState {
  weaponId: WeaponId;
  ammo: number;
  /* -1 means infinite reserve ammo. */
  reserveAmmo: number;
  reloadingUntil: number;
}

export interface PocketWarPlayer {
  userId: string;
  username: string;
  characterId: PocketWarCharacterId;
  isReady: boolean;
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

const weaponIdSchema = z.enum([
  "m4a1",
  "vector_smg",
  "pistol",
  "spas12",
  "barrett50",
  "rpg7",
]);

const killWeaponIconIdSchema = z.enum([
  "m4a1",
  "vector_smg",
  "pistol",
  "spas12",
  "barrett50",
  "rpg7",
  "grenade",
  "melee",
  "barrel",
]);

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
    type: z.literal("player_state"),
    x: z.number().finite(),
    y: z.number().finite(),
    vx: z.number().finite(),
    vy: z.number().finite(),
    aimAngle: z.number().finite(),
    isBoosting: z.boolean(),
    jetpackFuel: z.number().min(0).max(100),
    isScoped: z.boolean().optional(),
    activeSlot: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({
    type: z.literal("fire_weapon"),
    originX: z.number().finite(),
    originY: z.number().finite(),
    angle: z.number().finite(),
    slot: z.union([z.literal(0), z.literal(1)]),
  }),
  z.object({
    type: z.literal("switch_weapon"),
    slot: z.union([z.literal(0), z.literal(1)]),
  }),
  z.object({
    type: z.literal("reload"),
  }),
  z.object({
    type: z.literal("throw_bomb"),
    originX: z.number().finite(),
    originY: z.number().finite(),
    vx: z.number().finite(),
    vy: z.number().finite(),
  }),
  z.object({
    type: z.literal("pickup_item"),
    pickupId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal("report_hit"),
    targetUserId: z.string().min(1),
    damage: z.number().positive().max(120),
    weaponId: killWeaponIconIdSchema,
    weaponLabel: z.string().min(1).max(32),
    impulseX: z.number().finite(),
    impulseY: z.number().finite(),
  }),
  z.object({
    type: z.literal("report_explosion"),
    x: z.number().finite(),
    y: z.number().finite(),
    radius: z.number().min(20).max(220),
    maxDamage: z.number().min(10).max(100),
    weaponId: killWeaponIconIdSchema,
    weaponLabel: z.string().min(1).max(32),
  }),
  z.object({
    type: z.literal("damage_block"),
    blockId: z.string().min(1),
    damage: z.number().positive().max(150),
  }),
  z.object({
    type: z.literal("melee_bash"),
    x: z.number().finite(),
    y: z.number().finite(),
    angle: z.number().finite(),
  }),
  z.object({
    type: z.literal("request_respawn"),
  }),
  z.object({
    type: z.literal("send_chat"),
    text: z.string().min(1).max(POCKET_WAR_LIMITS.MAX_CHAT_LENGTH),
  }),
  z.object({
    type: z.literal("play_again"),
  }),
]);

export type PocketWarActionPayload = z.infer<
  typeof pocketWarActionPayloadSchema
>;

export { weaponIdSchema };

/* Strips control chars and HTML brackets to prevent XSS/script injection payloads. */
export function sanitizeChatMessage(raw: string): string {
  const withoutControls = raw.replace(/[\u0000-\u001F\u007F]/g, "");
  const withoutTags = withoutControls.replace(/[<>]/g, "");
  return withoutTags.trim().slice(0, POCKET_WAR_LIMITS.MAX_CHAT_LENGTH);
}

export function pickRandomMapId(): PocketWarMapId {
  const idx = Math.floor(Math.random() * MAP_IDS.length);
  return MAP_IDS[idx] ?? "emerald_falls";
}
