export {
  CHARACTER_CATALOG,
  CHARACTER_IDS,
  DEFAULT_POCKET_WAR_SETTINGS,
  EVENT_KIND_BLOCK_BREAK,
  EVENT_KIND_EXPLOSION,
  EVENT_KIND_HIT,
  EVENT_KIND_MELEE,
  EVENT_KIND_PICKUP,
  EVENT_KIND_PLAYER_DEATH,
  EVENT_KIND_PLAYER_RESPAWN,
  EVENT_KIND_SHOT,
  EVENT_KIND_WATER_SPLASH,
  GRAVITY_PX,
  GRENADE_THROW_SPEED_PX,
  INPUT_FLAG_BOOST,
  INPUT_FLAG_DROP,
  INPUT_FLAG_MELEE,
  INPUT_FLAG_PICKUP,
  INPUT_FLAG_RELOAD,
  INPUT_FLAG_SCOPED,
  INPUT_FLAG_SHOOT,
  INPUT_FLAG_SWITCH_WEAPON,
  INPUT_FLAG_THROW_BOMB,
  KILL_WEAPON_IDS,
  MAP_CATALOG,
  MAP_IDS,
  PLAYER_FLAG_ALIVE,
  PLAYER_FLAG_BOOSTING,
  PLAYER_FLAG_GROUNDED,
  PLAYER_FLAG_IN_WATER,
  PLAYER_FLAG_OVERHEATED,
  PLAYER_FLAG_RELOADING,
  PLAYER_FLAG_SCOPED,
  POCKET_WAR_LIMITS,
  PPM,
  PROJ_KIND_BOMB,
  PROJ_KIND_BULLET,
  PROJ_KIND_PELLET,
  PROJ_KIND_ROCKET,
  PW_BIN_TYPE_INPUT,
  PW_BIN_TYPE_SNAPSHOT,
  PocketWarPhysicsWorld,
  WEAPON_CATALOG,
  WEAPON_IDS,
  computeGrenadeLaunch,
  decodeServerSnapshot,
  encodeClientInput,
  indexToKillWeaponId,
  indexToMaterial,
  indexToPickupKind,
  indexToWeaponId,
  killWeaponIdToIndex,
  mToPx,
  pickRandomMapId,
  pocketWarActionPayloadSchema,
  pxToM,
  sanitizeChatMessage,
  unpackPlayerTuple,
} from "@kridora/shared/games/pocket-war";

export type {
  CharacterAbilityInfo,
  CharacterDefinition,
  CharacterPalette,
  ClientInputPacket,
  CollisionChainDef,
  CollisionMapData,
  DestructibleBlockDef,
  DestructibleBlockState,
  KillWeaponIconId,
  MapDefinition,
  MapLayerAssets,
  PickupKind,
  PickupPadDef,
  PickupPadState,
  PlatformRect,
  PlayerHitboxTarget,
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
  ServerSnapshotPacket,
  SlopeSegment,
  SnapshotEventTuple,
  SnapshotPlayerState,
  SnapshotPlayerTuple,
  SnapshotProjectileTuple,
  SoldierControlInput,
  SoldierSimBody,
  SoldierStepEvents,
  TerrainMaterial,
  VineAnchor,
  WaterfallAnchor,
  WeaponDefinition,
  WeaponId,
  WeaponSlotState,
} from "@kridora/shared/games/pocket-war";

import type {
  PocketWarCharacterId,
  PocketWarChatMessage,
  PocketWarKillFeedEntry,
  WeaponId,
} from "@kridora/shared/games/pocket-war";

export type SoundBusName = "master" | "sfx" | "ambience" | "ui";

export type SoundBusVolumes = Record<SoundBusName, number>;

export interface HudTelemetry {
  hp: number;
  maxHp: number;
  isAlive: boolean;
  livesLeft: number;
  maxLives: number;
  respawnSecondsLeft: number;
  isInvulnerable: boolean;
  jetpackFuel: number;
  isBoosting: boolean;
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
  damageDealt: number;
  nearbyPickupLabel: string | null;
  soloWaitEndsAt: number | null;
  alivePlayersCount: number;
}

export interface PlayerScoreRow {
  userId: string;
  username: string;
  characterId: PocketWarCharacterId;
  isAlive: boolean;
  livesLeft: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  connected: boolean;
}

export interface ActiveKillFeedItem {
  entry: PocketWarKillFeedEntry;
  receivedAt: number;
  expiresAt: number;
}

export interface ActiveChatFeedItem {
  message: PocketWarChatMessage;
  receivedAt: number;
  expiresAt: number;
}

export interface DebugOverlayOptions {
  showCollisions: boolean;
  showSpawns: boolean;
  showFps: boolean;
}

export interface DebugCoordToast {
  id: number;
  x: number;
  y: number;
  copied: boolean;
}

export interface RenderPlayerState {
  userId: string;
  username: string;
  characterId: PocketWarCharacterId;
  isAlive: boolean;
  hp: number;
  maxHp: number;
  livesLeft: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  isBoosting: boolean;
  jetpackFuel: number;
  isOverheated: boolean;
  isScoped: boolean;
  isInvulnerable: boolean;
  isReloading: boolean;
  reloadPct: number;
  activeWeaponId: WeaponId;
  bombsLeft: number;
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

export interface VirtualStickVisual {
  active: boolean;
  pointerId: number | null;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  dx: number;
  dy: number;
}

export interface TouchControllerVisualState {
  moveStick: VirtualStickVisual;
  aimStick: VirtualStickVisual;
  autoFiring: boolean;
  boosting: boolean;
}

export interface InputControlFrame {
  moveX: number;
  boost: boolean;
  dropThrough: boolean;
  shooting: boolean;
  isScoped: boolean;
  aimAngle: number;
  activeSlot: 0 | 1;
}

export interface PhaserArenaBridge {
  setPaused: (paused: boolean) => void;
  setChatFocused: (focused: boolean) => void;
  setDebugOptions: (options: DebugOverlayOptions) => void;
  setSpectateTarget: (userId: string | null) => void;
  triggerReload: () => void;
  triggerThrowBomb: () => void;
  triggerMelee: () => void;
  triggerPickup: () => void;
  triggerSwitchWeapon: (slot?: 0 | 1) => void;
  triggerToggleScope: () => void;
  bindMoveStickElement: (el: HTMLElement | null) => () => void;
  bindAimStickElement: (el: HTMLElement | null) => () => void;
  destroy: () => void;
}
