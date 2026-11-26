import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHARACTER_CATALOG,
  MAP_CATALOG,
  POCKET_WAR_LIMITS,
  WEAPON_CATALOG,
  type ActiveChatFeedItem,
  type ActiveKillFeedItem,
  type DebugCoordToast,
  type DebugOverlayOptions,
  type HudTelemetry,
  type PhaserArenaBridge,
  type PlayerScoreRow,
  type PocketWarKillFeedEntry,
  type PocketWarState,
  type SoundBusName,
  type SoundBusVolumes,
  type TouchControllerVisualState,
} from "../types";
import type { SoundFX } from "../engine/SoundFX";
import { mountPhaserArena } from "../engine/PhaserArenaScene";
import styles from "../pocket-war.module.css";
import { ArenaHud } from "./ArenaHud";

export interface PocketWarArenaProps {
  state: PocketWarState;
  currentUserId: string;
  soundFx: SoundFX;
  muted: boolean;
  isMobile: boolean;
  isFullscreen: boolean;
  chatFocused: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenChat: () => void;
  onBackToRoom?: () => void;
  onLeaveMatch?: () => void;
}

function buildInitialTelemetry(
  state: PocketWarState,
  currentUserId: string,
): HudTelemetry {
  const me = state.players[currentUserId];
  const charDef = CHARACTER_CATALOG[me?.characterId ?? "rex"];
  const activeSlot = me?.activeSlot ?? 0;
  const primaryWeaponId = me?.weapons[0].weaponId ?? charDef.primaryWeaponId;
  const secondaryWeaponId =
    me?.weapons[1].weaponId ?? charDef.secondaryWeaponId;
  const slot = me?.weapons[activeSlot];
  const activeWeaponId = slot?.weaponId ?? primaryWeaponId;
  const def = WEAPON_CATALOG[activeWeaponId];

  return {
    hp: me?.hp ?? charDef.maxHp,
    maxHp: me?.maxHp ?? charDef.maxHp,
    isAlive: me?.isAlive ?? true,
    livesLeft: me?.livesLeft ?? POCKET_WAR_LIMITS.STARTING_LIVES,
    maxLives: me?.maxLives ?? POCKET_WAR_LIMITS.STARTING_LIVES,
    respawnSecondsLeft: 0,
    isInvulnerable: false,
    jetpackFuel: me?.jetpackFuel ?? 100,
    isBoosting: false,
    isOverheated: false,
    isLowFuel: false,
    activeSlot,
    primaryWeaponId,
    secondaryWeaponId,
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
    damageDealt: me?.damageDealt ?? 0,
    nearbyPickupLabel: null,
    soloWaitEndsAt: state.soloWaitEndsAt,
    alivePlayersCount: Object.values(state.players).filter((p) => p.isAlive)
      .length,
  };
}

function buildInitialScoreRows(state: PocketWarState): PlayerScoreRow[] {
  const onlineSet = new Set(state.onlineUserIds);
  return Object.values(state.players).map((p) => ({
    userId: p.userId,
    username: p.username,
    characterId: p.characterId,
    isAlive: p.isAlive,
    livesLeft: p.livesLeft,
    kills: p.kills,
    deaths: p.deaths,
    damageDealt: p.damageDealt,
    connected: onlineSet.size === 0 ? true : onlineSet.has(p.userId),
  }));
}

const EMPTY_TOUCH_VISUAL: TouchControllerVisualState = {
  moveStick: {
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
  },
  aimStick: {
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
  },
  autoFiring: false,
  boosting: false,
};

export function PocketWarArena({
  state,
  currentUserId,
  soundFx,
  muted,
  isMobile,
  isFullscreen,
  chatFocused,
  onToggleMute,
  onToggleFullscreen,
  onOpenChat,
  onBackToRoom,
  onLeaveMatch,
}: PocketWarArenaProps) {
  const phaserHostRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<PhaserArenaBridge | null>(null);
  const moveStickElRef = useRef<HTMLElement | null>(null);
  const aimStickElRef = useRef<HTMLElement | null>(null);
  const unbindMoveStickRef = useRef<(() => void) | null>(null);
  const unbindAimStickRef = useRef<(() => void) | null>(null);
  const initialStateRef = useRef<PocketWarState>(state);
  const onOpenChatRef = useRef<() => void>(onOpenChat);

  const [phaserReady, setPhaserReady] = useState<boolean>(false);
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
  const [debugCoordToast, setDebugCoordToast] =
    useState<DebugCoordToast | null>(null);
  const [telemetry, setTelemetry] = useState<HudTelemetry>(() =>
    buildInitialTelemetry(state, currentUserId),
  );
  const [scoreRows, setScoreRows] = useState<PlayerScoreRow[]>(() =>
    buildInitialScoreRows(state),
  );
  const [touchVisual, setTouchVisual] =
    useState<TouchControllerVisualState>(EMPTY_TOUCH_VISUAL);
  const [killFeed, setKillFeed] = useState<ActiveKillFeedItem[]>([]);
  const [chatFeed, setChatFeed] = useState<ActiveChatFeedItem[]>([]);
  const seenChatIdsRef = useRef<Set<string> | null>(null);
  const [dismissedSoloForTs, setDismissedSoloForTs] = useState<number | null>(
    null,
  );

  useEffect(() => {
    onOpenChatRef.current = onOpenChat;
  }, [onOpenChat]);

  const mapDef = MAP_CATALOG[state.settings.mapId];

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleToggleDebugCollisions = useCallback(() => {
    setDebug((prev) => ({
      ...prev,
      showCollisions: !prev.showCollisions,
      showFps: !prev.showCollisions ? true : prev.showFps,
    }));
  }, []);

  const handleToggleDebugSpawns = useCallback(() => {
    setDebug((prev) => ({
      ...prev,
      showSpawns: !prev.showSpawns,
    }));
  }, []);

  const handleIncomingKillFeed = useCallback(
    (entries: readonly PocketWarKillFeedEntry[]) => {
      const now = Date.now();
      setKillFeed((prev) => {
        const existingIds = new Set(prev.map((item) => item.entry.id));
        const additions: ActiveKillFeedItem[] = [];
        for (const entry of entries) {
          if (existingIds.has(entry.id)) continue;
          additions.push({
            entry,
            receivedAt: now,
            expiresAt: now + POCKET_WAR_LIMITS.KILL_FEED_TTL_MS,
          });
        }
        if (additions.length === 0) return prev;
        return [...additions, ...prev].slice(0, 5);
      });
    },
    [],
  );

  // Auto-dismiss kill feed entries exactly after 2,000 ms (KILL_FEED_TTL_MS)
  useEffect(() => {
    if (killFeed.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setKillFeed((prev) => {
        const filtered = prev.filter((item) => now < item.expiresAt);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [killFeed.length]);

  // Enqueue newly arriving chat messages into the 2-second arena chat feed
  useEffect(() => {
    if (!seenChatIdsRef.current) {
      seenChatIdsRef.current = new Set(state.chatMessages.map((m) => m.id));
      return;
    }

    const seen = seenChatIdsRef.current;
    const incoming = state.chatMessages.filter((m) => !seen.has(m.id));
    if (incoming.length === 0) return;
    for (const msg of incoming) {
      seen.add(msg.id);
    }

    const timer = window.setTimeout(() => {
      const now = Date.now();
      const additions: ActiveChatFeedItem[] = incoming
        .slice(-4)
        .reverse()
        .map((message) => ({
          message,
          receivedAt: now,
          expiresAt: now + POCKET_WAR_LIMITS.KILL_FEED_TTL_MS,
        }));
      setChatFeed((prev) => [...additions, ...prev].slice(0, 4));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [state.chatMessages]);

  // Auto-dismiss chat feed entries after 2,000 ms (KILL_FEED_TTL_MS)
  useEffect(() => {
    if (chatFeed.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setChatFeed((prev) => {
        const filtered = prev.filter((item) => now < item.expiresAt);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [chatFeed.length]);

  // Auto-dismiss F3 debug coordinate toast after 2.8 seconds
  useEffect(() => {
    if (!debugCoordToast) return;
    const timer = window.setTimeout(() => {
      setDebugCoordToast(null);
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [debugCoordToast]);

  // Lazy-load & mount Phaser 4 scene
  useEffect(() => {
    const hostEl = phaserHostRef.current;
    if (!hostEl) return;

    let cancelled = false;
    let activeBridge: PhaserArenaBridge | null = null;

    void mountPhaserArena({
      containerEl: hostEl,
      initialState: initialStateRef.current,
      currentUserId,
      soundFx,
      isMobile,
      initialDebug: {
        showCollisions: false,
        showSpawns: false,
        showFps: false,
      },
      onTelemetry: (nextTelemetry, nextRows) => {
        if (cancelled) return;
        setTelemetry(nextTelemetry);
        setScoreRows(nextRows);
      },
      onTouchVisual: (nextVisual) => {
        if (cancelled) return;
        setTouchVisual(nextVisual);
      },
      onKillFeed: handleIncomingKillFeed,
      onFps: (nextFps) => {
        if (!cancelled) setFps(nextFps);
      },
      onTogglePause: handleTogglePause,
      onScoreboardToggle: setScoreboardOpen,
      onOpenChat: () => onOpenChatRef.current(),
      onToggleDebug: handleToggleDebugCollisions,
      onDebugCoordPicked: (toast) => {
        if (!cancelled) setDebugCoordToast(toast);
      },
    }).then((bridge) => {
      if (cancelled) {
        bridge.destroy();
        return;
      }
      activeBridge = bridge;
      bridgeRef.current = bridge;

      if (moveStickElRef.current) {
        unbindMoveStickRef.current?.();
        unbindMoveStickRef.current = bridge.bindMoveStickElement(
          moveStickElRef.current,
        );
      }
      if (aimStickElRef.current) {
        unbindAimStickRef.current?.();
        unbindAimStickRef.current = bridge.bindAimStickElement(
          aimStickElRef.current,
        );
      }
      setPhaserReady(true);
    });

    return () => {
      cancelled = true;
      unbindMoveStickRef.current?.();
      unbindMoveStickRef.current = null;
      unbindAimStickRef.current?.();
      unbindAimStickRef.current = null;
      bridgeRef.current = null;
      activeBridge?.destroy();
    };
  }, [
    currentUserId,
    handleIncomingKillFeed,
    handleToggleDebugCollisions,
    handleTogglePause,
    isMobile,
    soundFx,
  ]);

  useEffect(() => {
    bridgeRef.current?.setPaused(isPaused);
  }, [isPaused]);

  useEffect(() => {
    bridgeRef.current?.setChatFocused(chatFocused);
  }, [chatFocused]);

  useEffect(() => {
    bridgeRef.current?.setDebugOptions(debug);
  }, [debug]);

  const aliveOpponents = useMemo(
    () =>
      scoreRows.filter((row) => row.isAlive && row.userId !== currentUserId),
    [scoreRows, currentUserId],
  );

  const spectatingRow = useMemo(() => {
    if (telemetry.isAlive || aliveOpponents.length === 0) return null;
    const idx =
      ((spectateIndex % aliveOpponents.length) + aliveOpponents.length) %
      aliveOpponents.length;
    return aliveOpponents[idx] ?? null;
  }, [telemetry.isAlive, aliveOpponents, spectateIndex]);

  useEffect(() => {
    bridgeRef.current?.setSpectateTarget(spectatingRow?.userId ?? null);
  }, [spectatingRow]);

  const handleBindMoveStick = useCallback((el: HTMLElement | null) => {
    moveStickElRef.current = el;
    unbindMoveStickRef.current?.();
    unbindMoveStickRef.current = null;
    if (el && bridgeRef.current) {
      unbindMoveStickRef.current = bridgeRef.current.bindMoveStickElement(el);
    }
  }, []);

  const handleBindAimStick = useCallback((el: HTMLElement | null) => {
    aimStickElRef.current = el;
    unbindAimStickRef.current?.();
    unbindAimStickRef.current = null;
    if (el && bridgeRef.current) {
      unbindAimStickRef.current = bridgeRef.current.bindAimStickElement(el);
    }
  }, []);

  const handleReload = useCallback(() => {
    bridgeRef.current?.triggerReload();
  }, []);

  const handleThrowBomb = useCallback(() => {
    bridgeRef.current?.triggerThrowBomb();
  }, []);

  const handleMelee = useCallback(() => {
    bridgeRef.current?.triggerMelee();
  }, []);

  const handlePickup = useCallback(() => {
    bridgeRef.current?.triggerPickup();
  }, []);

  const handleSwitchWeapon = useCallback((slot?: 0 | 1) => {
    bridgeRef.current?.triggerSwitchWeapon(slot);
  }, []);

  const handleToggleScope = useCallback(() => {
    bridgeRef.current?.triggerToggleScope();
  }, []);

  const handleVolumeChange = useCallback(
    (bus: SoundBusName, value: number) => {
      soundFx.unlock();
      soundFx.setBusVolume(bus, value);
      setVolumes(soundFx.getBusVolumes());
    },
    [soundFx],
  );

  const handleSpectateStep = useCallback((delta: -1 | 1) => {
    setSpectateIndex((prev) => prev + delta);
  }, []);

  const effectiveSoloWaitEndsAt =
    telemetry.soloWaitEndsAt ?? state.soloWaitEndsAt;
  const soloBannerDismissed =
    effectiveSoloWaitEndsAt !== null &&
    dismissedSoloForTs === effectiveSoloWaitEndsAt;

  const handleDismissSoloBanner = useCallback(() => {
    if (effectiveSoloWaitEndsAt !== null) {
      setDismissedSoloForTs(effectiveSoloWaitEndsAt);
    }
  }, [effectiveSoloWaitEndsAt]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-sky-950 select-none">
      {/* Phaser 4 Canvas Host */}
      <div ref={phaserHostRef} className={styles.phaserHost} />

      {/* Brief lazy-chunk loading indicator while Phaser initializes */}
      {!phaserReady && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs">
          <div className="size-9 animate-spin rounded-full border-3 border-sky-400 border-t-transparent" />
          <span className="mt-3 text-xs font-black tracking-widest text-sky-200 uppercase">
            Booting {mapDef.name}...
          </span>
        </div>
      )}

      {/* Zero-Overlap Mobile & Desktop HUD Overlay */}
      <ArenaHud
        telemetry={telemetry}
        scoreRows={scoreRows}
        killFeed={killFeed}
        chatFeed={chatFeed}
        touchVisual={touchVisual}
        currentUserId={currentUserId}
        mapName={mapDef.name}
        isMobile={isMobile}
        isFullscreen={isFullscreen}
        isPaused={isPaused}
        scoreboardOpen={scoreboardOpen}
        muted={muted}
        volumes={volumes}
        debug={debug}
        debugCoordToast={debugCoordToast}
        fps={fps}
        spectatingName={spectatingRow?.username ?? null}
        soloWaitEndsAt={effectiveSoloWaitEndsAt}
        soloBannerDismissed={soloBannerDismissed}
        onDismissSoloBanner={handleDismissSoloBanner}
        onReload={handleReload}
        onThrowBomb={handleThrowBomb}
        onMelee={handleMelee}
        onPickup={handlePickup}
        onSwitchWeapon={handleSwitchWeapon}
        onToggleScope={handleToggleScope}
        onBindMoveStick={handleBindMoveStick}
        onBindAimStick={handleBindAimStick}
        onTogglePause={handleTogglePause}
        onToggleMute={onToggleMute}
        onVolumeChange={handleVolumeChange}
        onToggleFullscreen={onToggleFullscreen}
        onToggleDebugCollisions={handleToggleDebugCollisions}
        onToggleDebugSpawns={handleToggleDebugSpawns}
        onSpectateStep={handleSpectateStep}
        onOpenChat={onOpenChat}
        onBackToRoom={onBackToRoom}
        onLeaveMatch={onLeaveMatch}
      />
    </div>
  );
}
