import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHARACTER_CATALOG,
  MAP_CATALOG,
  POCKET_WAR_LIMITS,
  WEAPON_CATALOG,
} from "@kridora/shared/games/pocket-war";
import { pocketWarAssets } from "../assets/AssetLoader";
import { InputManager } from "../engine/InputManager";
import { ParticleSystem } from "../engine/ParticleSystem";
import {
  GRENADE_FUSE_SEC,
  GRENADE_GRAVITY,
  PLAYER_HALF_H,
  PLAYER_HALF_W,
  computeGrenadeLaunch,
  predictGrenadeTrajectory,
  stepProjectile,
  stepSoldierPhysics,
  sweepSegmentAABB,
  type LocalProjectile,
  type LocalSoldierBody,
} from "../engine/Physics";
import { GameRenderer } from "../engine/Renderer";
import type { SoundBusName, SoundFX } from "../engine/SoundFX";
import type {
  DebugOverlayOptions,
  HudTelemetry,
  PocketWarActionPayload,
  PocketWarState,
  RenderPlayerState,
  SoundBusVolumes,
  TrajectoryPoint,
  WeaponId,
} from "../types";
import { ArenaHud } from "./ArenaHud";

interface PocketWarArenaProps {
  state: PocketWarState;
  currentUserId: string;
  soundFx: SoundFX;
  muted: boolean;
  chatFocused: boolean;
  onDispatch: (payload: PocketWarActionPayload) => void;
  onToggleMute: () => void;
  onOpenChat: () => void;
  onBackToRoom?: () => void;
  onLeaveMatch?: () => void;
}

interface RemoteAnimState {
  x: number;
  y: number;
  aimAngle: number;
  runCycle: number;
  hitFlash: number;
  muzzleFlash: number;
  recoilOffset: number;
  meleeAnim: number;
  throwAnim: number;
}

type EventIdSet = Set<string>;
type PlayerAnimMap = Map<string, RemoteAnimState>;
type PickupCooldownMap = Map<string, number>;
type DispatchFn = (payload: PocketWarActionPayload) => void;
type VoidFn = () => void;
type WeaponSlotIndex = 0 | 1;

function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

function buildInitialTelemetry(
  state: PocketWarState,
  currentUserId: string,
): HudTelemetry {
  const me = state.players[currentUserId];
  const charDef = CHARACTER_CATALOG[me?.characterId ?? "rex"];
  const activeSlot = me?.activeSlot ?? 0;
  const primaryId = me?.weapons[0].weaponId ?? charDef.primaryWeaponId;
  const secondaryId = me?.weapons[1].weaponId ?? charDef.secondaryWeaponId;
  const slot = me?.weapons[activeSlot];
  const activeWeaponId = slot?.weaponId ?? primaryId;
  const def = WEAPON_CATALOG[activeWeaponId];

  return {
    hp: me?.hp ?? charDef.maxHp,
    maxHp: me?.maxHp ?? charDef.maxHp,
    livesLeft: me?.livesLeft ?? POCKET_WAR_LIMITS.STARTING_LIVES,
    maxLives: me?.maxLives ?? POCKET_WAR_LIMITS.STARTING_LIVES,
    respawnSecondsLeft: 0,
    isInvulnerable: false,
    jetpackFuel: me?.jetpackFuel ?? 100,
    isOverheated: false,
    isLowFuel: false,
    activeSlot,
    primaryWeaponId: primaryId,
    secondaryWeaponId: secondaryId,
    activeWeaponId,
    ammo: slot?.ammo ?? def.magSize,
    magSize: def.magSize,
    reserveAmmo: slot?.reserveAmmo ?? def.defaultReserveAmmo,
    isReloading: false,
    reloadProgress: 0,
    bombsLeft: me?.bombsLeft ?? charDef.startingBombs,
    maxBombs: POCKET_WAR_LIMITS.MAX_GRENADES,
    bombCooldownRatio: 1,
    isScoped: false,
    kills: me?.kills ?? 0,
    deaths: me?.deaths ?? 0,
    nearbyPickupLabel: null,
  };
}

function isWeaponId(id: string): id is WeaponId {
  return (
    id === "m4a1" ||
    id === "vector_smg" ||
    id === "pistol" ||
    id === "spas12" ||
    id === "barrett50" ||
    id === "rpg7"
  );
}

export function PocketWarArena({
  state,
  currentUserId,
  soundFx,
  muted,
  chatFocused,
  onDispatch,
  onToggleMute,
  onOpenChat,
  onBackToRoom,
  onLeaveMatch,
}: PocketWarArenaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isMobile] = useState<boolean>(detectTouchDevice);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(
    typeof window !== "undefined"
      ? window.innerHeight > window.innerWidth
      : false,
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [scoreboardOpen, setScoreboardOpen] = useState<boolean>(false);
  const [spectateIndex, setSpectateIndex] = useState<number>(0);
  const [fps, setFps] = useState<number>(60);
  const [volumes, setVolumes] = useState<SoundBusVolumes>(() =>
    soundFx.getBusVolumes(),
  );
  const [debug, setDebug] = useState<DebugOverlayOptions>({
    showCollisions: false,
    showSpawns: false,
    showFps: false,
  });
  const [telemetry, setTelemetry] = useState<HudTelemetry>(() =>
    buildInitialTelemetry(state, currentUserId),
  );

  // Refs synced from React state so the 60 FPS loop never restarts on socket updates
  const stateRef = useRef<PocketWarState>(state);
  const onDispatchRef = useRef<DispatchFn>(onDispatch);
  const onOpenChatRef = useRef<VoidFn>(onOpenChat);
  const debugRef = useRef<DebugOverlayOptions>(debug);
  const isScopedRef = useRef<boolean>(false);
  const localSlotRef = useRef<WeaponSlotIndex>(
    state.players[currentUserId]?.activeSlot ?? 0,
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onDispatchRef.current = onDispatch;
  }, [onDispatch]);

  useEffect(() => {
    onOpenChatRef.current = onOpenChat;
  }, [onOpenChat]);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  const localPlayer = state.players[currentUserId];
  const isAlive = localPlayer?.isAlive ?? false;

  const alivePlayers = useMemo(
    () => Object.values(state.players).filter((p) => p.isAlive),
    [state.players],
  );

  const spectateTargetId = useMemo(() => {
    if (isAlive || alivePlayers.length === 0) return null;
    const idx =
      ((spectateIndex % alivePlayers.length) + alivePlayers.length) %
      alivePlayers.length;
    return alivePlayers[idx]?.userId ?? null;
  }, [isAlive, alivePlayers, spectateIndex]);

  const spectateTargetRef = useRef<string | null>(spectateTargetId);
  useEffect(() => {
    spectateTargetRef.current = spectateTargetId;
  }, [spectateTargetId]);

  const rendererRef = useRef<GameRenderer | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const projectilesRef = useRef<LocalProjectile[]>([]);
  const processedEventsRef = useRef<EventIdSet>(new Set());
  const localBodyRef = useRef<LocalSoldierBody | null>(null);
  const playerAnimsRef = useRef<PlayerAnimMap>(new Map());
  const pickupCooldownRef = useRef<PickupCooldownMap>(new Map());
  const wasLocalAliveRef = useRef<boolean>(isAlive);
  const hitStopRef = useRef<number>(0);

  const clockRef = useRef({
    lastShotAt: 0,
    lastEmptyClickAt: 0,
    lastBombAt: 0,
    lastMeleeAt: 0,
    lastSyncAt: 0,
    lastHudAt: 0,
    lastRespawnPingAt: 0,
    aimAngle: localPlayer?.aimAngle ?? 0,
  });

  // Sync chat focus and pause state into InputManager
  useEffect(() => {
    inputRef.current?.setSuspendedForChat(chatFocused);
  }, [chatFocused]);

  useEffect(() => {
    inputRef.current?.setPaused(isPaused);
  }, [isPaused]);

  // Preload active map art & start jungle ambience loop while in arena
  useEffect(() => {
    const map = MAP_CATALOG[state.settings.mapId];
    pocketWarAssets.preloadAll(map);
    soundFx.setAmbienceActive(true);
    return () => {
      soundFx.setAmbienceActive(false);
    };
  }, [soundFx, state.settings.mapId]);

  // Fullscreen & mobile orientation listeners
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current ?? document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (mode: string) => Promise<void>;
        };
        if (isMobile && orientation?.lock) {
          await orientation.lock("landscape").catch(() => undefined);
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen denied or unsupported on iOS Safari
    }
  }, [isMobile]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const onResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // --- Shared Combat Action Triggers (callable from Keyboard, Mouse, or Mobile HUD) ---
  const triggerThrowBomb = useCallback(() => {
    const st = stateRef.current;
    const me = st.players[currentUserId];
    const body = localBodyRef.current;
    if (!me || !me.isAlive || !body) return;

    const now = Date.now();
    if (
      me.bombsLeft <= 0 ||
      now - clockRef.current.lastBombAt < POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS
    ) {
      return;
    }

    clockRef.current.lastBombAt = now;
    soundFx.unlock();
    soundFx.playMelee(0.65);

    const launch = computeGrenadeLaunch(
      body.x,
      body.y,
      clockRef.current.aimAngle,
      body.vx,
      body.vy,
    );

    const anim = playerAnimsRef.current.get(currentUserId);
    if (anim) anim.throwAnim = 1;

    projectilesRef.current.push({
      id: `bomb_${now}_${Math.random().toString(36).slice(2, 6)}`,
      ownerId: currentUserId,
      kind: "bomb",
      weaponId: "grenade",
      weaponLabel: "Frag Grenade",
      x: launch.x,
      y: launch.y,
      prevX: launch.x,
      prevY: launch.y,
      vx: launch.vx,
      vy: launch.vy,
      gravity: GRENADE_GRAVITY,
      damage: 62,
      blastRadius: 155,
      knockback: 450,
      color: "#FFF933",
      age: 0,
      maxAge: GRENADE_FUSE_SEC,
      bounces: 0,
      inWater: launch.y >= MAP_CATALOG[st.settings.mapId].waterSurfaceY,
    });

    onDispatchRef.current({
      type: "throw_bomb",
      originX: launch.x,
      originY: launch.y,
      vx: launch.vx,
      vy: launch.vy,
    });
  }, [currentUserId, soundFx]);

  const triggerReload = useCallback(() => {
    const me = stateRef.current.players[currentUserId];
    if (!me || !me.isAlive) return;
    const slot = me.weapons[localSlotRef.current];
    const def = WEAPON_CATALOG[slot.weaponId];
    if (slot.ammo >= def.magSize || slot.reserveAmmo === 0) return;
    if (slot.reloadingUntil > Date.now()) return;

    soundFx.unlock();
    soundFx.playReload();
    onDispatchRef.current({ type: "reload" });
  }, [currentUserId, soundFx]);

  const triggerMelee = useCallback(() => {
    const body = localBodyRef.current;
    const me = stateRef.current.players[currentUserId];
    if (!body || !me || !me.isAlive) return;
    const now = Date.now();
    if (
      now - clockRef.current.lastMeleeAt < POCKET_WAR_LIMITS.MELEE_COOLDOWN_MS
    ) {
      return;
    }
    clockRef.current.lastMeleeAt = now;
    soundFx.unlock();
    soundFx.playMelee(1, 0);

    const anim = playerAnimsRef.current.get(currentUserId);
    if (anim) anim.meleeAnim = 1;
    particlesRef.current?.spawnMeleeArc(
      body.x,
      body.y,
      clockRef.current.aimAngle,
    );

    onDispatchRef.current({
      type: "melee_bash",
      x: body.x,
      y: body.y,
      angle: clockRef.current.aimAngle,
    });
  }, [currentUserId, soundFx]);

  const triggerSwitchWeapon = useCallback(
    (explicitSlot?: WeaponSlotIndex) => {
      const me = stateRef.current.players[currentUserId];
      if (!me || !me.isAlive) return;
      const nextSlot: WeaponSlotIndex =
        explicitSlot !== undefined
          ? explicitSlot
          : localSlotRef.current === 0
            ? 1
            : 0;
      if (nextSlot === localSlotRef.current) return;
      localSlotRef.current = nextSlot;
      soundFx.unlock();
      soundFx.playUiSwitch();
      onDispatchRef.current({ type: "switch_weapon", slot: nextSlot });
    },
    [currentUserId, soundFx],
  );

  const triggerToggleScope = useCallback(() => {
    const me = stateRef.current.players[currentUserId];
    if (!me || !me.isAlive) return;
    isScopedRef.current = !isScopedRef.current;
    soundFx.unlock();
    soundFx.playUiClick();
  }, [currentUserId, soundFx]);

  const triggerTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const triggerToggleDebugCollisions = useCallback(() => {
    setDebug((prev) => ({
      ...prev,
      showCollisions: !prev.showCollisions,
      showFps: !prev.showCollisions ? true : prev.showFps,
    }));
  }, []);

  const triggerToggleDebugSpawns = useCallback(() => {
    setDebug((prev) => ({
      ...prev,
      showSpawns: !prev.showSpawns,
    }));
  }, []);

  const handleVolumeChange = useCallback(
    (bus: SoundBusName, value: number) => {
      soundFx.unlock();
      soundFx.setBusVolume(bus, value);
      setVolumes(soundFx.getBusVolumes());
    },
    [soundFx],
  );

  // --- Core 60 FPS Canvas Engine Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new GameRenderer();
    const particles = new ParticleSystem(isMobile);
    const input = new InputManager({
      onThrowBomb: triggerThrowBomb,
      onReload: triggerReload,
      onMelee: triggerMelee,
      onSwitchWeapon: triggerSwitchWeapon,
      onToggleScope: triggerToggleScope,
      onTogglePause: triggerTogglePause,
      onScoreboardToggle: setScoreboardOpen,
      onOpenChat: () => onOpenChatRef.current(),
      onToggleDebug: triggerToggleDebugCollisions,
    });

    rendererRef.current = renderer;
    particlesRef.current = particles;
    inputRef.current = input;

    const detachInput = input.attach(canvas);

    // Seed local body & camera from initial server spawn
    const initialMe = stateRef.current.players[currentUserId];
    if (initialMe) {
      localBodyRef.current = {
        x: initialMe.x,
        y: initialMe.y,
        vx: 0,
        vy: 0,
        isGrounded: false,
        wasGrounded: false,
        inWater: false,
        wasInWater: false,
        isBoosting: false,
        jetpackFuel: initialMe.jetpackFuel,
        overheatedUntil: 0,
        lastBoostAt: 0,
        stepDistance: 0,
      };
      localSlotRef.current = initialMe.activeSlot;
      input.setInitialAimAngle(initialMe.aimAngle);
      renderer.camera.x = initialMe.x;
      renderer.camera.y = initialMe.y;
    }

    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let fpsFrames = 0;
    let fpsElapsed = 0;
    const FIXED_DT = 1 / 60;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const getSpatialAudio = (wx: number, wy: number) => {
      const dx = wx - renderer.camera.x;
      const dy = wy - renderer.camera.y;
      const dist = Math.hypot(dx, dy);
      const vol = Math.max(0, 1 - dist / 1550);
      const pan = Math.max(-0.9, Math.min(0.9, dx / 720));
      return { vol, pan };
    };

    const getOrCreateAnim = (
      userId: string,
      x: number,
      y: number,
      aimAngle: number,
    ): RemoteAnimState => {
      let entry = playerAnimsRef.current.get(userId);
      if (!entry) {
        entry = {
          x,
          y,
          aimAngle,
          runCycle: 0,
          hitFlash: 0,
          muzzleFlash: 0,
          recoilOffset: 0,
          meleeAnim: 0,
          throwAnim: 0,
        };
        playerAnimsRef.current.set(userId, entry);
      }
      return entry;
    };

    const resetLocalBodyToSpawn = (x: number, y: number, aimAngle: number) => {
      localBodyRef.current = {
        x,
        y,
        vx: 0,
        vy: 0,
        isGrounded: false,
        wasGrounded: false,
        inWater: false,
        wasInWater: false,
        isBoosting: false,
        jetpackFuel: 100,
        overheatedUntil: 0,
        lastBoostAt: 0,
        stepDistance: 0,
      };
      localSlotRef.current = 0;
      isScopedRef.current = false;
      clockRef.current.aimAngle = aimAngle;
      input.setInitialAimAngle(aimAngle);
    };

    const processServerEvents = (st: PocketWarState) => {
      for (const ev of st.recentEvents) {
        if (processedEventsRef.current.has(ev.id)) continue;
        processedEventsRef.current.add(ev.id);
        if (processedEventsRef.current.size > 240) {
          const first = processedEventsRef.current.values().next().value;
          if (first) processedEventsRef.current.delete(first);
        }

        const { vol, pan } = getSpatialAudio(ev.x, ev.y);

        if (ev.type === "explosion") {
          particles.spawnStylizedExplosion(ev.x, ev.y, ev.radius ?? 155);
          const blastKind =
            ev.weaponId === "rpg7"
              ? "rocket"
              : ev.weaponId === "barrel"
                ? "barrel"
                : "grenade";
          soundFx.playExplosion(blastKind, vol, pan);
          renderer.addTrauma(Math.max(0.14, vol * 0.95));
          if (vol > 0.72) {
            hitStopRef.current = Math.max(hitStopRef.current, 0.032);
          }
        } else if (ev.type === "block_break" && ev.material) {
          particles.spawnTerrainBreak(ev.x, ev.y, ev.material);
          soundFx.playBlockBreak(ev.material, vol, pan);
          renderer.addTrauma(vol * 0.28);
        } else if (ev.type === "player_death" && ev.targetId) {
          const dead = st.players[ev.targetId];
          if (dead) {
            const c = CHARACTER_CATALOG[dead.characterId];
            particles.spawnSoldierDisintegration(
              ev.x,
              ev.y,
              c.palette.suitPrimary,
              c.palette.suitSecondary,
              c.palette.headgearColor,
              c.palette.sashColor,
              ev.vx ?? 0,
              ev.vy ?? -180,
            );
            soundFx.playDeath(vol, pan);
            soundFx.playKillNotify();
            renderer.addTrauma(vol * 0.45);
          }
        } else if (ev.type === "player_respawn" && ev.targetId) {
          const respawned = st.players[ev.targetId];
          const accent = respawned
            ? CHARACTER_CATALOG[respawned.characterId].palette.sashColor
            : "#38BDF8";
          particles.spawnRespawnBurst(ev.x, ev.y, accent);
          soundFx.playRespawn(vol, pan);
          if (ev.targetId === currentUserId) {
            resetLocalBodyToSpawn(ev.x, ev.y, respawned?.aimAngle ?? 0);
          } else {
            const anim = getOrCreateAnim(ev.targetId, ev.x, ev.y, 0);
            anim.x = ev.x;
            anim.y = ev.y;
          }
        } else if (ev.type === "pickup") {
          const color =
            ev.pickupKind === "medkit"
              ? "#22C55E"
              : ev.pickupKind === "grenade_pack"
                ? "#F97316"
                : "#38BDF8";
          particles.spawnPickupBurst(ev.x, ev.y, color);
          if (ev.actorId === currentUserId) {
            soundFx.playPickup();
            localSlotRef.current = 0;
          }
        } else if (ev.type === "melee" && ev.actorId !== currentUserId) {
          particles.spawnMeleeArc(ev.x, ev.y, ev.angle ?? 0);
          soundFx.playMelee(vol, pan);
          const anim = playerAnimsRef.current.get(ev.actorId);
          if (anim) anim.meleeAnim = 1;
        } else if (ev.type === "hit") {
          particles.spawnImpactSparks(ev.x, ev.y, "#FB7185", 8);
          if (ev.damage) {
            particles.spawnDamagePopup(ev.x, ev.y, ev.damage, ev.damage >= 42);
          }
          if (ev.targetId) {
            const targetAnim = playerAnimsRef.current.get(ev.targetId);
            if (targetAnim) targetAnim.hitFlash = 1;
          }
          if (ev.actorId === currentUserId) {
            soundFx.playHitmarker();
            if ((ev.damage ?? 0) >= 42) {
              hitStopRef.current = Math.max(hitStopRef.current, 0.022);
            }
          }
          if (ev.targetId === currentUserId && localBodyRef.current) {
            localBodyRef.current.vx += (ev.vx ?? 0) * 0.45;
            localBodyRef.current.vy += (ev.vy ?? 0) * 0.45;
            renderer.addTrauma(0.28);
            renderer.triggerDamageVignette(0.7);
            soundFx.playPlayerHit();
          }
        } else if (
          ev.type === "shot" &&
          ev.actorId !== currentUserId &&
          ev.weaponId &&
          isWeaponId(ev.weaponId)
        ) {
          const weapon = WEAPON_CATALOG[ev.weaponId];
          soundFx.playWeaponShot(weapon.id, vol * 0.85, pan);

          const shooterAnim = playerAnimsRef.current.get(ev.actorId);
          if (shooterAnim) {
            shooterAnim.muzzleFlash = 1;
            shooterAnim.recoilOffset = Math.min(7, weapon.recoil * 0.032);
          }

          const baseAngle = ev.angle ?? 0;
          particles.spawnMuzzleFlashSparks(ev.x, ev.y, baseAngle);
          if (weapon.projectileType !== "rocket") {
            particles.spawnShellCasing(ev.x, ev.y, baseAngle);
          }

          for (let i = 0; i < weapon.pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spreadRad;
            const a = baseAngle + spread;
            projectilesRef.current.push({
              id: `rem_${ev.id}_${i}`,
              ownerId: ev.actorId,
              kind: weapon.projectileType,
              weaponId: weapon.id,
              weaponLabel: weapon.name,
              x: ev.x,
              y: ev.y,
              prevX: ev.x,
              prevY: ev.y,
              vx: Math.cos(a) * weapon.bulletSpeed,
              vy: Math.sin(a) * weapon.bulletSpeed,
              gravity: weapon.bulletGravity,
              damage: weapon.damage,
              blastRadius: weapon.blastRadius,
              knockback: weapon.knockback,
              color: weapon.color,
              age: 0,
              maxAge: weapon.projectileType === "rocket" ? 2.5 : 1.35,
              bounces: 0,
              inWater: false,
            });
          }
        }
      }
    };

    const tick = (frameNow: number) => {
      resizeCanvas();
      const rawDt = Math.min(0.05, (frameNow - lastTime) / 1000);
      lastTime = frameNow;

      // FPS counter (~2 Hz React update only if debug visible)
      fpsFrames += 1;
      fpsElapsed += rawDt;
      if (fpsElapsed >= 0.5) {
        if (debugRef.current.showFps || debugRef.current.showCollisions) {
          setFps(Math.round(fpsFrames / fpsElapsed));
        }
        fpsFrames = 0;
        fpsElapsed = 0;
      }

      const st = stateRef.current;
      const map = MAP_CATALOG[st.settings.mapId];
      const me = st.players[currentUserId];
      const viewW = canvas.parentElement?.clientWidth ?? window.innerWidth;
      const viewH = canvas.parentElement?.clientHeight ?? window.innerHeight;
      const nowMs = Date.now();

      processServerEvents(st);

      // Detect alive transition in case respawn event was trimmed from recentEvents
      const currentlyAlive = Boolean(me?.isAlive);
      if (currentlyAlive && !wasLocalAliveRef.current && me) {
        resetLocalBodyToSpawn(me.x, me.y, me.aimAngle);
      }
      wasLocalAliveRef.current = currentlyAlive;

      const body = localBodyRef.current;
      const meScreen = body
        ? renderer.worldToScreen(body.x, body.y, viewW, viewH)
        : { x: viewW * 0.5, y: viewH * 0.5 };
      const snap = input.getSnapshot(meScreen.x, meScreen.y, isMobile);
      clockRef.current.aimAngle = snap.aimAngle;

      // Apply subtle hit-stop pause on heavy impacts without dropping frames
      if (hitStopRef.current > 0) {
        hitStopRef.current = Math.max(0, hitStopRef.current - rawDt);
      } else {
        accumulator += rawDt;
      }

      let nearbyPickupLabel: string | null = null;

      while (accumulator >= FIXED_DT) {
        accumulator -= FIXED_DT;
        const stepNow = Date.now();

        if (me && me.isAlive && body) {
          const charDef = CHARACTER_CATALOG[me.characterId];
          const activeSlotIndex = localSlotRef.current;
          const activeSlot = me.weapons[activeSlotIndex];
          const weapon = WEAPON_CATALOG[activeSlot.weaponId];

          const stepEvents = stepSoldierPhysics(
            body,
            {
              moveX: snap.moveX,
              boost: snap.boost,
              dropThrough: snap.dropThrough,
              isScoped: isScopedRef.current,
            },
            charDef,
            map,
            st.blocks,
            FIXED_DT,
            stepNow,
          );

          // Movement & environmental audio / VFX
          if (stepEvents.justLanded) {
            const impactScale = Math.min(1.3, stepEvents.landingSpeed / 420);
            particles.spawnLandingDust(
              body.x,
              body.y + PLAYER_HALF_H,
              impactScale,
            );
            soundFx.playJumpLand(Math.min(1, impactScale * 0.85), 0);
          }
          if (stepEvents.justEnteredWater) {
            particles.spawnWaterSplash(body.x, map.waterSurfaceY, 1.1);
            soundFx.playWaterSplash(0.95, 0);
          } else if (stepEvents.justExitedWater) {
            particles.spawnWaterSplash(body.x, map.waterSurfaceY, 0.7);
            soundFx.playWaterSplash(0.65, 0);
          }
          if (stepEvents.footstepTriggered) {
            soundFx.playFootstep(0.9, 0);
          }

          soundFx.setJetpackActive(body.isBoosting, 0.92);
          if (body.isBoosting) {
            const lowFuel = body.jetpackFuel < 25;
            if (lowFuel) {
              soundFx.playLowFuelBeep();
            }
            const nozzleX =
              Math.cos(snap.aimAngle) < 0 ? body.x + 12 : body.x - 12;
            particles.spawnJetpackPlume(nozzleX, body.y + 13, body.vx, lowFuel);
          }

          // Check proximity to map weapon & supply pickup pads (auto-collect!)
          for (const pad of Object.values(st.pickups)) {
            if (stepNow < pad.availableAt) continue;
            const dist = Math.hypot(body.x - pad.x, body.y - pad.y);
            if (dist <= POCKET_WAR_LIMITS.PICKUP_RADIUS + 14) {
              nearbyPickupLabel = pad.label;
              const needsItem =
                pad.kind === "medkit"
                  ? me.hp < me.maxHp
                  : pad.kind === "grenade_pack"
                    ? me.bombsLeft < POCKET_WAR_LIMITS.MAX_GRENADES
                    : true;
              const lastTry = pickupCooldownRef.current.get(pad.id) ?? 0;
              if (needsItem && stepNow - lastTry > 650) {
                pickupCooldownRef.current.set(pad.id, stepNow);
                onDispatchRef.current({ type: "pickup_item", pickupId: pad.id });
              }
            }
          }

          // Local weapon firing
          const isReloading =
            activeSlot.reloadingUntil > 0 &&
            stepNow < activeSlot.reloadingUntil;
          if (snap.shooting && !isReloading) {
            if (activeSlot.ammo <= 0) {
              if (stepNow - clockRef.current.lastEmptyClickAt > 460) {
                clockRef.current.lastEmptyClickAt = stepNow;
                soundFx.unlock();
                soundFx.playEmptyClick();
                if (activeSlot.reserveAmmo !== 0) {
                  soundFx.playReload();
                  onDispatchRef.current({ type: "reload" });
                }
              }
            } else if (
              stepNow - clockRef.current.lastShotAt >= weapon.fireRateMs
            ) {
              clockRef.current.lastShotAt = stepNow;
              soundFx.unlock();
              soundFx.playWeaponShot(weapon.id, 1, 0);
              renderer.addTrauma(
                weapon.id === "rpg7"
                  ? 0.28
                  : weapon.id === "barrett50"
                    ? 0.2
                    : weapon.id === "spas12"
                      ? 0.16
                      : 0.06,
              );

              // Recoil kick & barrel animation
              body.vx -= Math.cos(snap.aimAngle) * weapon.recoil * 0.36;
              body.vy -= Math.sin(snap.aimAngle) * weapon.recoil * 0.26;

              const localAnim = getOrCreateAnim(
                currentUserId,
                body.x,
                body.y,
                snap.aimAngle,
              );
              localAnim.muzzleFlash = 1;
              localAnim.recoilOffset = Math.min(7.5, weapon.recoil * 0.036);

              const originX = body.x + Math.cos(snap.aimAngle) * 28;
              const originY = body.y - 2 + Math.sin(snap.aimAngle) * 28;
              particles.spawnMuzzleFlashSparks(originX, originY, snap.aimAngle);
              if (weapon.projectileType !== "rocket") {
                particles.spawnShellCasing(
                  body.x + Math.cos(snap.aimAngle) * 10,
                  body.y - 4,
                  snap.aimAngle,
                  weapon.id === "spas12" ? "#EF4444" : "#FACC15",
                );
              }

              for (let i = 0; i < weapon.pellets; i++) {
                const spread =
                  (Math.random() - 0.5) *
                  (isScopedRef.current
                    ? weapon.spreadRad * 0.65
                    : weapon.spreadRad);
                const a = snap.aimAngle + spread;
                projectilesRef.current.push({
                  id: `loc_${stepNow}_${i}_${Math.random().toString(36).slice(2, 5)}`,
                  ownerId: currentUserId,
                  kind: weapon.projectileType,
                  weaponId: weapon.id,
                  weaponLabel: weapon.name,
                  x: originX,
                  y: originY,
                  prevX: body.x,
                  prevY: body.y - 2,
                  vx: Math.cos(a) * weapon.bulletSpeed,
                  vy: Math.sin(a) * weapon.bulletSpeed,
                  gravity: weapon.bulletGravity,
                  damage: weapon.damage,
                  blastRadius: weapon.blastRadius,
                  knockback: weapon.knockback,
                  color: weapon.color,
                  age: 0,
                  maxAge: weapon.projectileType === "rocket" ? 2.5 : 1.35,
                  bounces: 0,
                  inWater: originY >= map.waterSurfaceY,
                });
              }

              onDispatchRef.current({
                type: "fire_weapon",
                originX,
                originY,
                angle: snap.aimAngle,
                slot: activeSlotIndex,
              });
            }
          }

          // Throttled position sync (~22 Hz)
          if (stepNow - clockRef.current.lastSyncAt >= 45) {
            clockRef.current.lastSyncAt = stepNow;
            onDispatchRef.current({
              type: "player_state",
              x: Math.round(body.x),
              y: Math.round(body.y),
              vx: Math.round(body.vx),
              vy: Math.round(body.vy),
              aimAngle: Number(snap.aimAngle.toFixed(3)),
              isBoosting: body.isBoosting,
              jetpackFuel: Math.round(body.jetpackFuel),
              isScoped: isScopedRef.current,
              activeSlot: activeSlotIndex,
            });
          }
        } else {
          soundFx.setJetpackActive(false);

          // Ping server once respawn timer expires so player drops back in cleanly
          if (
            me &&
            !me.isAlive &&
            me.livesLeft > 0 &&
            me.respawnAt !== null &&
            stepNow >= me.respawnAt &&
            stepNow - clockRef.current.lastRespawnPingAt >= 450
          ) {
            clockRef.current.lastRespawnPingAt = stepNow;
            onDispatchRef.current({ type: "request_respawn" });
          }
        }

        // Step active projectiles with continuous swept player & terrain collision
        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
          const proj = projectilesRef.current[i];
          if (!proj) continue;

          if (proj.kind === "rocket") {
            particles.spawnRocketTrail(proj.x, proj.y);
          }

          const segStartX = proj.x;
          const segStartY = proj.y;
          const res = stepProjectile(proj, map, st.blocks, FIXED_DT);

          if (res.bounced) {
            const { vol, pan } = getSpatialAudio(proj.x, proj.y);
            soundFx.playGrenadeBounce(vol, pan);
          }
          if (res.waterSplashed) {
            const { vol, pan } = getSpatialAudio(proj.x, map.waterSurfaceY);
            particles.spawnWaterSplash(
              proj.x,
              map.waterSurfaceY,
              proj.kind === "bomb" ? 0.85 : 0.45,
            );
            soundFx.playWaterSplash(
              vol * (proj.kind === "bomb" ? 0.85 : 0.4),
              pan,
            );
          }

          // Swept hit test against living opponents (local owner reports authoritative hit)
          let hitPlayerId: string | null = null;
          let bestHitT = Number.POSITIVE_INFINITY;
          let hitX = proj.x;
          let hitY = proj.y;

          if (proj.ownerId === currentUserId && proj.kind !== "bomb") {
            for (const target of Object.values(st.players)) {
              if (!target.isAlive || target.userId === currentUserId) continue;
              if (stepNow < target.invulnerableUntil) continue;
              const anim = playerAnimsRef.current.get(target.userId);
              const tx = anim?.x ?? target.x;
              const ty = anim?.y ?? target.y;
              const hit = sweepSegmentAABB(
                segStartX,
                segStartY,
                proj.x,
                proj.y,
                tx - PLAYER_HALF_W - 6,
                ty - PLAYER_HALF_H - 6,
                tx + PLAYER_HALF_W + 6,
                ty + PLAYER_HALF_H + 6,
              );
              if (hit && hit.t < bestHitT) {
                bestHitT = hit.t;
                hitPlayerId = target.userId;
                hitX = hit.x;
                hitY = hit.y;
              }
            }
          }

          const shouldExplode =
            (proj.kind === "rocket" &&
              (res.hitWorld || Boolean(hitPlayerId) || res.expired)) ||
            (proj.kind === "bomb" && res.expired);

          if (shouldExplode) {
            if (proj.ownerId === currentUserId) {
              onDispatchRef.current({
                type: "report_explosion",
                x: hitPlayerId ? hitX : proj.x,
                y: hitPlayerId ? hitY : proj.y,
                radius: proj.blastRadius,
                maxDamage: proj.damage,
                weaponId: proj.weaponId,
                weaponLabel: proj.weaponLabel,
              });
            }
            projectilesRef.current.splice(i, 1);
            continue;
          }

          if (hitPlayerId) {
            const angle = Math.atan2(proj.vy, proj.vx);
            onDispatchRef.current({
              type: "report_hit",
              targetUserId: hitPlayerId,
              damage: proj.damage,
              weaponId: proj.weaponId,
              weaponLabel: proj.weaponLabel,
              impulseX: Math.cos(angle) * proj.knockback,
              impulseY: Math.sin(angle) * proj.knockback - 55,
            });
            particles.spawnImpactSparks(hitX, hitY, "#FB7185", 7);
            projectilesRef.current.splice(i, 1);
            continue;
          }

          if (res.hitWorld || res.expired) {
            if (res.hitBlockId && proj.ownerId === currentUserId) {
              onDispatchRef.current({
                type: "damage_block",
                blockId: res.hitBlockId,
                damage: proj.damage,
              });
            }
            if (res.hitWorld) {
              const { vol, pan } = getSpatialAudio(proj.x, proj.y);
              particles.spawnImpactSparks(
                proj.x,
                proj.y,
                proj.color,
                6,
                res.impactNx,
                res.impactNy,
              );
              soundFx.playBulletImpact(vol * 0.7, pan);
            }
            projectilesRef.current.splice(i, 1);
          }
        }

        particles.update(FIXED_DT, map);
      }

      // Throttled low-frequency React HUD telemetry (~14 Hz)
      if (nowMs - clockRef.current.lastHudAt >= 70 && me) {
        clockRef.current.lastHudAt = nowMs;
        const slotIndex = me.isAlive ? localSlotRef.current : me.activeSlot;
        const slot = me.weapons[slotIndex];
        const weaponDef = WEAPON_CATALOG[slot.weaponId];
        const isReloading =
          slot.reloadingUntil > 0 && nowMs < slot.reloadingUntil;
        const reloadProgress = isReloading
          ? Math.max(
              0,
              Math.min(
                1,
                1 - (slot.reloadingUntil - nowMs) / weaponDef.reloadTimeMs,
              ),
            )
          : 0;
        const bombElapsed = nowMs - clockRef.current.lastBombAt;
        const fuel = body && me.isAlive ? body.jetpackFuel : me.jetpackFuel;
        const isOverheated =
          body && me.isAlive
            ? nowMs < body.overheatedUntil
            : nowMs < me.jetpackOverheatedUntil;
        const respawnSecondsLeft =
          !me.isAlive && me.respawnAt !== null
            ? Math.max(0, Math.ceil((me.respawnAt - nowMs) / 1000))
            : 0;

        setTelemetry({
          hp: me.hp,
          maxHp: me.maxHp,
          livesLeft: me.livesLeft,
          maxLives: me.maxLives,
          respawnSecondsLeft,
          isInvulnerable: nowMs < me.invulnerableUntil,
          jetpackFuel: fuel,
          isOverheated,
          isLowFuel: !isOverheated && fuel < 25,
          activeSlot: slotIndex,
          primaryWeaponId: me.weapons[0].weaponId,
          secondaryWeaponId: me.weapons[1].weaponId,
          activeWeaponId: slot.weaponId,
          ammo: slot.ammo,
          magSize: weaponDef.magSize,
          reserveAmmo: slot.reserveAmmo,
          isReloading,
          reloadProgress,
          bombsLeft: me.bombsLeft,
          maxBombs: POCKET_WAR_LIMITS.MAX_GRENADES,
          bombCooldownRatio: Math.min(
            1,
            bombElapsed / POCKET_WAR_LIMITS.BOMB_COOLDOWN_MS,
          ),
          isScoped: isScopedRef.current,
          kills: me.kills,
          deaths: me.deaths,
          nearbyPickupLabel,
        });
      }

      // Build smoothly interpolated RenderPlayerState list
      const posLerp = 1 - Math.exp(-15 * rawDt);
      const angleLerp = 1 - Math.exp(-18 * rawDt);
      const renderPlayers: RenderPlayerState[] = Object.values(st.players).map(
        (p) => {
          const anim = getOrCreateAnim(p.userId, p.x, p.y, p.aimAngle);
          anim.hitFlash = Math.max(0, anim.hitFlash - rawDt * 4.5);
          anim.muzzleFlash = Math.max(0, anim.muzzleFlash - rawDt * 14);
          anim.recoilOffset = Math.max(0, anim.recoilOffset - rawDt * 34);
          anim.meleeAnim = Math.max(0, anim.meleeAnim - rawDt * 5.5);
          anim.throwAnim = Math.max(0, anim.throwAnim - rawDt * 5);

          if (p.userId === currentUserId && body && p.isAlive) {
            anim.x = body.x;
            anim.y = body.y;
            anim.aimAngle = snap.aimAngle;
            if (body.isGrounded && Math.abs(body.vx) > 25) {
              anim.runCycle += Math.abs(body.vx) * rawDt * 0.048;
            }
            return {
              ...p,
              x: body.x,
              y: body.y,
              vx: body.vx,
              vy: body.vy,
              aimAngle: snap.aimAngle,
              isBoosting: body.isBoosting,
              isScoped: isScopedRef.current,
              activeSlot: localSlotRef.current,
              runCycle: anim.runCycle,
              hitFlash: anim.hitFlash,
              muzzleFlash: anim.muzzleFlash,
              recoilOffset: anim.recoilOffset,
              meleeAnim: anim.meleeAnim,
              throwAnim: anim.throwAnim,
              inWater: body.inWater,
              isGrounded: body.isGrounded,
            };
          }

          const jumpDist = Math.hypot(p.x - anim.x, p.y - anim.y);
          if (jumpDist > 320) {
            anim.x = p.x;
            anim.y = p.y;
          } else {
            anim.x += (p.x - anim.x) * posLerp;
            anim.y += (p.y - anim.y) * posLerp;
          }
          anim.aimAngle = lerpAngle(anim.aimAngle, p.aimAngle, angleLerp);

          const isGroundedRemote = Math.abs(p.vy) < 18 && !p.isBoosting;
          if (isGroundedRemote && Math.abs(p.vx) > 25) {
            anim.runCycle += Math.abs(p.vx) * rawDt * 0.048;
          }

          if (p.isAlive && p.isBoosting && Math.random() > 0.45) {
            const nozzleX =
              Math.cos(anim.aimAngle) < 0 ? anim.x + 12 : anim.x - 12;
            particles.spawnJetpackPlume(nozzleX, anim.y + 13, p.vx);
          }

          return {
            ...p,
            x: anim.x,
            y: anim.y,
            aimAngle: anim.aimAngle,
            runCycle: anim.runCycle,
            hitFlash: anim.hitFlash,
            muzzleFlash: anim.muzzleFlash,
            recoilOffset: anim.recoilOffset,
            meleeAnim: anim.meleeAnim,
            throwAnim: anim.throwAnim,
            inWater: anim.y + PLAYER_HALF_H * 0.4 > map.waterSurfaceY,
            isGrounded: isGroundedRemote,
          };
        },
      );

      // Compute exact grenade trajectory preview while aiming grenade
      let grenadePreview: TrajectoryPoint[] = [];
      if (snap.aimingGrenade && me && me.isAlive && me.bombsLeft > 0 && body) {
        const launch = computeGrenadeLaunch(
          body.x,
          body.y,
          snap.aimAngle,
          body.vx,
          body.vy,
        );
        grenadePreview = predictGrenadeTrajectory(
          launch.x,
          launch.y,
          launch.vx,
          launch.vy,
          map,
          st.blocks,
          18,
        );
      }

      const aimWorld = renderer.screenToWorld(
        snap.mouseScreenX,
        snap.mouseScreenY,
        viewW,
        viewH,
      );

      renderer.renderFrame({
        ctx,
        viewW,
        viewH,
        map,
        blocks: st.blocks,
        pickups: st.pickups,
        players: renderPlayers,
        localUserId: currentUserId,
        spectateTargetId: spectateTargetRef.current,
        projectiles: projectilesRef.current,
        particles,
        grenadePreview,
        aimWorldX: aimWorld.x,
        aimWorldY: aimWorld.y,
        isScoped: isScopedRef.current,
        isMobile,
        debug: debugRef.current,
        timeSec: frameNow / 1000,
        nowMs,
        dt: rawDt,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      detachInput();
      soundFx.setJetpackActive(false);
    };
  }, [
    currentUserId,
    isMobile,
    soundFx,
    triggerMelee,
    triggerReload,
    triggerSwitchWeapon,
    triggerThrowBomb,
    triggerToggleDebugCollisions,
    triggerTogglePause,
    triggerToggleScope,
  ]);

  const spectatingPlayer = spectateTargetId
    ? (state.players[spectateTargetId] ?? null)
    : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-sky-950 select-none"
      onPointerDown={() => soundFx.unlock()}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair touch-none"
      />

      <ArenaHud
        state={state}
        currentUserId={currentUserId}
        telemetry={telemetry}
        isMobile={isMobile}
        isPortrait={isPortrait}
        isFullscreen={isFullscreen}
        isPaused={isPaused}
        scoreboardOpen={scoreboardOpen}
        muted={muted}
        volumes={volumes}
        debug={debug}
        fps={fps}
        spectatingPlayer={spectatingPlayer}
        onUnlockAudio={() => soundFx.unlock()}
        onLeftStick={(dx, dy) => inputRef.current?.setLeftStick(dx, dy)}
        onRightStick={(dx, dy, active) =>
          inputRef.current?.setRightStick(dx, dy, active)
        }
        onTapFire={(active) => inputRef.current?.setTapFire(active)}
        onGrenadeAimChange={(aiming) =>
          inputRef.current?.setTouchGrenadeAiming(aiming)
        }
        onThrowBomb={triggerThrowBomb}
        onMelee={triggerMelee}
        onReload={triggerReload}
        onSwitchWeapon={triggerSwitchWeapon}
        onToggleScope={triggerToggleScope}
        onTogglePause={triggerTogglePause}
        onToggleMute={onToggleMute}
        onVolumeChange={handleVolumeChange}
        onToggleDebugCollisions={triggerToggleDebugCollisions}
        onToggleDebugSpawns={triggerToggleDebugSpawns}
        onToggleFullscreen={() => void toggleFullscreen()}
        onToggleScoreboard={() => setScoreboardOpen((o) => !o)}
        onSpectateStep={(delta) => setSpectateIndex((i) => i + delta)}
        onOpenChat={onOpenChat}
        onBackToRoom={onBackToRoom}
        onLeaveMatch={onLeaveMatch}
      />
    </div>
  );
}
