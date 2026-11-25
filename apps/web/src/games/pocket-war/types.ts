export {
  CHARACTER_CATALOG,
  CHARACTER_IDS,
  DEFAULT_POCKET_WAR_SETTINGS,
  MAP_CATALOG,
  MAP_IDS,
  POCKET_WAR_LIMITS,
  WEAPON_CATALOG,
  WEAPON_IDS,
  pickRandomMapId,
  pocketWarActionPayloadSchema,
  sanitizeChatMessage,
} from "@kridora/shared/games/pocket-war";

export type {
  CharacterAbilityInfo,
  CharacterDefinition,
  CharacterPalette,
  DestructibleBlockDef,
  DestructibleBlockState,
  KillWeaponIconId,
  MapDefinition,
  MapLayerAssets,
  PickupKind,
  PickupPadDef,
  PickupPadState,
  PlatformRect,
  PocketWarActionPayload,
  PocketWarCharacterId,
  PocketWarChatMessage,
  PocketWarEvent,
  PocketWarKillFeedEntry,
  PocketWarMapId,
  PocketWarPhase,
  PocketWarPlayer,
  PocketWarSettings,
  PocketWarState,
  SlopeSegment,
  TerrainMaterial,
  VineAnchor,
  WaterfallAnchor,
  WeaponDefinition,
  WeaponId,
  WeaponSlotState,
} from "@kridora/shared/games/pocket-war";

import type {
  PocketWarPlayer,
  WeaponId,
} from "@kridora/shared/games/pocket-war";

export interface HudTelemetry {
  hp: number;
  maxHp: number;
  livesLeft: number;
  maxLives: number;
  respawnSecondsLeft: number;
  isInvulnerable: boolean;
  jetpackFuel: number;
  isOverheated: boolean;
  isLowFuel: boolean;
  activeSlot: 0 | 1;
  primaryWeaponId: WeaponId;
  secondaryWeaponId: WeaponId;
  activeWeaponId: WeaponId;
  ammo: number;
  magSize: number;
  /** -1 means infinite reserve ammo */
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  bombsLeft: number;
  maxBombs: number;
  bombCooldownRatio: number;
  isScoped: boolean;
  kills: number;
  deaths: number;
  nearbyPickupLabel: string | null;
}

export interface DebugOverlayOptions {
  showCollisions: boolean;
  showSpawns: boolean;
  showFps: boolean;
}

export interface SoundBusVolumes {
  master: number;
  sfx: number;
  ambience: number;
  ui: number;
}

export interface RenderPlayerState extends PocketWarPlayer {
  runCycle: number;
  hitFlash: number;
  muzzleFlash: number;
  recoilOffset: number;
  meleeAnim: number;
  throwAnim: number;
  inWater: boolean;
  isGrounded: boolean;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
}
