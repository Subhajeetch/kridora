import { useRef } from "react";
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Hand,
  Heart,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  Pause,
  Play,
  Skull,
  Swords,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { GrenadeIcon, MagazineReloadIcon } from "./PocketWarIcons";
import {
  CHARACTER_CATALOG,
  WEAPON_CATALOG,
  type ActiveChatFeedItem,
  type ActiveKillFeedItem,
  type DebugCoordToast,
  type DebugOverlayOptions,
  type HudTelemetry,
  type PlayerScoreRow,
  type SoundBusName,
  type SoundBusVolumes,
  type TouchControllerVisualState,
} from "../types";
import styles from "../pocket-war.module.css";

export interface ArenaHudProps {
  telemetry: HudTelemetry;
  scoreRows: PlayerScoreRow[];
  killFeed: ActiveKillFeedItem[];
  chatFeed: ActiveChatFeedItem[];
  touchVisual: TouchControllerVisualState;
  currentUserId: string;
  mapName: string;
  isMobile: boolean;
  isFullscreen: boolean;
  isPaused: boolean;
  scoreboardOpen: boolean;
  muted: boolean;
  volumes: SoundBusVolumes;
  debug: DebugOverlayOptions;
  debugCoordToast: DebugCoordToast | null;
  fps: number;
  spectatingName: string | null;
  onReload: () => void;
  onThrowBomb: () => void;
  onMelee: () => void;
  onPickup: () => void;
  onSwitchWeapon: (slot?: 0 | 1) => void;
  onToggleScope: () => void;
  onBindMoveStick: (el: HTMLElement | null) => void;
  onBindAimStick: (el: HTMLElement | null) => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onVolumeChange: (bus: SoundBusName, value: number) => void;
  onToggleFullscreen: () => void;
  onToggleDebugCollisions: () => void;
  onToggleDebugSpawns: () => void;
  onSpectateStep: (delta: -1 | 1) => void;
  onOpenChat: () => void;
  onBackToRoom?: () => void;
  onLeaveMatch?: () => void;
}

export function ArenaHud({
  telemetry,
  scoreRows,
  killFeed,
  chatFeed,
  touchVisual,
  currentUserId,
  mapName,
  isMobile,
  isFullscreen,
  isPaused,
  scoreboardOpen,
  muted,
  volumes,
  debug,
  debugCoordToast,
  fps,
  spectatingName,
  onReload,
  onThrowBomb,
  onMelee,
  onPickup,
  onSwitchWeapon,
  onToggleScope,
  onBindMoveStick,
  onBindAimStick,
  onTogglePause,
  onToggleMute,
  onVolumeChange,
  onToggleFullscreen,
  onToggleDebugCollisions,
  onToggleDebugSpawns,
  onSpectateStep,
  onOpenChat,
  onBackToRoom,
  onLeaveMatch,
}: ArenaHudProps) {
  const pauseBackdropDownRef = useRef(false);
  const activeWeapon = WEAPON_CATALOG[telemetry.activeWeaponId];
  const hpPct = Math.max(
    0,
    Math.min(100, (telemetry.hp / Math.max(1, telemetry.maxHp)) * 100),
  );
  const fuelPct = Math.max(0, Math.min(100, telemetry.jetpackFuel));

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 overflow-hidden text-white ${styles.safeHud}`}
    >
      {/* === TOP BAR (Zero-Overlap across 667x375, 844x390 & Desktop) === */}
      <div className="flex w-full items-start justify-between gap-1.5 sm:gap-3">
        {/* TOP-LEFT: 5X Scope Toggle + Chat Button */}
        <div
          className={`pointer-events-auto flex items-center gap-1.5 ${styles.compactTopLeftScale}`}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleScope();
            }}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full font-black transition active:scale-90 sm:h-13 sm:w-13 ${styles.hudCircleBtn} ${
              telemetry.isScoped
                ? "ring-2 ring-rose-400 !border-rose-300 text-rose-200"
                : "text-white"
            }`}
            aria-label="Toggle 5X Scope"
            title="Toggle 5X Scope (F / Shift)"
          >
            <Crosshair className="h-5 w-5 opacity-45 sm:h-6 sm:w-6" />
            <span className="absolute text-[11px] font-black tracking-tight sm:text-xs">
              5X
            </span>
            {!isMobile && (
              <span
                className={`absolute -bottom-1.5 -right-1 ${styles.keycap}`}
              >
                F
              </span>
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onOpenChat();
            }}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 sm:h-10 sm:w-10 ${styles.hudCircleBtn}`}
            aria-label="Open Chat"
            title="Chat (T)"
          >
            <MessageSquare className="h-4 w-4 text-sky-200" />
            {!isMobile && (
              <span
                className={`absolute -bottom-1.5 -right-1 ${styles.keycap}`}
              >
                T
              </span>
            )}
          </button>
        </div>

        {/* TOP-CENTER: Health/Jetpack/Pause + Weapon/Ammo/Grenade Angled Panels */}
        <div
          className={`pointer-events-auto flex items-start gap-1.5 sm:gap-3 ${styles.compactTopScale}`}
        >
          {/* Left Angled Panel: HP + Jetpack Fuel + Pause + Lives */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2 ${styles.angledPanel} ${
              telemetry.isLowFuel ? styles.lowFuelPulse : ""
            }`}
          >
            <div className="w-28 space-y-1 sm:w-40 sm:space-y-1.5">
              {/* HP Bar */}
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-400 text-rose-300" />
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-950/85 ring-1 ring-white/25 sm:h-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              {/* Jetpack Fuel Bar */}
              <div className="flex items-center gap-1.5">
                <Zap
                  className={`h-3.5 w-3.5 shrink-0 ${
                    telemetry.isOverheated
                      ? "text-rose-400"
                      : "fill-sky-300 text-sky-200"
                  }`}
                />
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-950/85 ring-1 ring-white/25 sm:h-3">
                  <div
                    className={`h-full rounded-full ${
                      telemetry.isOverheated
                        ? "bg-rose-500"
                        : "bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-300"
                    }`}
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
              </div>

              {/* Lives & Kills micro-row */}
              <div className="flex items-center justify-between pt-0.5 text-[9px] font-black text-slate-200">
                <div className="flex items-center gap-0.5" title="Lives Left">
                  {Array.from({ length: telemetry.maxLives }, (_, idx) => (
                    <Heart
                      key={idx}
                      className={`h-2.5 w-2.5 ${
                        idx < telemetry.livesLeft
                          ? "fill-rose-500 text-rose-300"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="flex items-center gap-1 font-mono text-amber-300">
                  <Swords className="h-2.5 w-2.5" />
                  {telemetry.kills}
                </span>
              </div>
            </div>

            {/* Pause Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/75 bg-slate-950/60 text-white transition hover:bg-slate-800 active:scale-90 sm:h-9 sm:w-9"
              aria-label="Pause menu"
              title="Pause / Settings (Esc)"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>

          {/* Right Angled Panel: Weapon Switch + Ammo + Grenade Badge */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSwitchWeapon();
              }}
              className={`relative flex min-w-32 flex-col justify-between rounded-lg px-2.5 py-1.5 text-left transition active:scale-95 sm:min-w-44 sm:px-3.5 sm:py-2 ${styles.angledPanel}`}
              title="Switch Weapon (Q / 1 / 2)"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10px] font-black tracking-wider text-amber-300 uppercase sm:text-xs">
                  {activeWeapon.shortName}
                </span>
                <span className="rounded bg-white/15 px-1 py-0.5 font-mono text-[9px] font-black text-sky-200">
                  {telemetry.activeSlot === 0 ? "1/2" : "2/2"}
                </span>
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2 font-mono">
                <span className="text-sm font-black tracking-wider text-white sm:text-base">
                  {String(telemetry.ammo).padStart(3, "0")}
                </span>
                <span className="text-[11px] font-bold text-slate-300 sm:text-xs">
                  {telemetry.reserveAmmo < 0
                    ? "∞"
                    : String(telemetry.reserveAmmo).padStart(3, "0")}
                </span>
              </div>

              {telemetry.isReloading && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-950/80">
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-75"
                    style={{
                      width: `${Math.round(telemetry.reloadProgress * 100)}%`,
                    }}
                  />
                </div>
              )}

              {!isMobile && (
                <span
                  className={`absolute -bottom-1.5 -right-1 ${styles.keycap}`}
                >
                  Q
                </span>
              )}
            </button>

            {/* Compact Grenade Count Indicator (desktop only; mobile uses dedicated bottom-left button) */}
            {!isMobile && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onThrowBomb();
                }}
                disabled={
                  telemetry.bombsLeft <= 0 || telemetry.bombCooldownRatio < 1
                }
                className={`relative hidden h-10 w-10 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-45 sm:flex ${styles.hudCircleBtn}`}
                title="Throw Frag Grenade (G / Right Click)"
                aria-label="Throw Grenade"
              >
                <GrenadeIcon className="h-5 w-5 text-amber-300" />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950">
                  {telemetry.bombsLeft}
                </span>
                <span
                  className={`absolute -bottom-1.5 -right-1 ${styles.keycap}`}
                >
                  G
                </span>
              </button>
            )}
          </div>
        </div>

        {/* TOP-RIGHT: Reload Button + Mute + Fullscreen */}
        <div
          className={`pointer-events-auto flex items-center gap-1.5 ${styles.compactTopRightScale}`}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${styles.hudCircleBtn}`}
            aria-label={muted ? "Unmute audio" : "Mute audio"}
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-300" />
            ) : (
              <Volume2 className="h-4 w-4 text-sky-200" />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
            className={`hidden h-9 w-9 items-center justify-center rounded-full transition active:scale-90 sm:flex ${styles.hudCircleBtn}`}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-white" />
            ) : (
              <Maximize2 className="h-4 w-4 text-white" />
            )}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 sm:h-13 sm:w-13 ${styles.hudCircleBtn}`}
            aria-label="Reload Weapon"
            title="Reload (R)"
          >
            {telemetry.isReloading && (
              <svg
                viewBox="0 0 36 36"
                className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#FBBF24"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="97.4"
                  strokeDashoffset={
                    97.4 *
                    (1 - Math.max(0, Math.min(1, telemetry.reloadProgress)))
                  }
                />
              </svg>
            )}
            <MagazineReloadIcon
              className={`h-5 w-5 sm:h-6 sm:w-6 ${
                telemetry.isReloading
                  ? "animate-pulse text-amber-300"
                  : "text-white"
              }`}
            />
            {!isMobile && (
              <span
                className={`absolute -bottom-1.5 -right-1 ${styles.keycap}`}
              >
                R
              </span>
            )}
          </button>
        </div>
      </div>

      {/* === 2-SECOND AUTO-DISMISSING KILL FEED (Top-Right below HUD) === */}
      {killFeed.length > 0 && (
        <div className="pointer-events-none absolute top-15 right-2.5 z-20 flex w-56 flex-col gap-1 sm:top-18 sm:right-4 sm:w-64">
          {killFeed.map((item) => {
            const isLocalInvolved =
              item.entry.killerId === currentUserId ||
              item.entry.victimId === currentUserId;
            return (
              <div
                key={item.entry.id}
                className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold shadow-lg backdrop-blur-md sm:text-xs ${styles.killFeedEntry} ${
                  isLocalInvolved
                    ? "border-amber-400/70 bg-slate-950/88"
                    : "border-white/15 bg-slate-950/72"
                }`}
              >
                <span className="truncate font-black text-sky-300">
                  {item.entry.killerName}
                </span>
                <span className="shrink-0 rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 uppercase">
                  {item.entry.weaponLabel}
                </span>
                <span className="truncate font-black text-rose-300">
                  {item.entry.victimName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* === TOP-LEFT STACK: DEBUG FPS & 2-SECOND CLICKABLE CHAT FEED === */}
      {(debug.showFps || debug.showCollisions || chatFeed.length > 0) && (
        <div className="pointer-events-none absolute top-15 left-2.5 z-20 flex max-w-60 flex-col gap-1 sm:top-18 sm:left-3 sm:max-w-72">
          {(debug.showFps || debug.showCollisions) && (
            <>
              <div className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-400/40 bg-slate-950/85 px-2 py-1 font-mono text-[10px] font-bold text-cyan-200">
                <Bug className="h-3.5 w-3.5 text-cyan-400" />
                <span>{fps} FPS</span>
                {debug.showCollisions && (
                  <span className="text-lime-300">• CLICK MAP FOR (X,Y)</span>
                )}
              </div>
              {debugCoordToast && (
                <div className="w-fit rounded-md border border-lime-400/50 bg-slate-950/92 px-2.5 py-1 font-mono text-[11px] font-black text-lime-300 shadow-lg">
                  World ({debugCoordToast.x}, {debugCoordToast.y}){" "}
                  {debugCoordToast.copied ? "• Copied!" : ""}
                </div>
              )}
            </>
          )}

          {chatFeed.map((item) => {
            const isMe = item.message.userId === currentUserId;
            return (
              <button
                key={item.message.id}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onOpenChat();
                }}
                className={`pointer-events-auto flex w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[10px] font-bold shadow-lg backdrop-blur-md transition hover:brightness-110 active:scale-[0.98] sm:text-xs ${styles.killFeedEntry} ${
                  isMe
                    ? "border-sky-400/70 bg-slate-950/88"
                    : "border-white/15 bg-slate-950/75"
                }`}
                title="Click to open chat"
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-sky-400" />
                <span
                  className={`max-w-20 shrink-0 truncate font-black ${
                    isMe ? "text-sky-300" : "text-amber-300"
                  }`}
                >
                  {item.message.username}:
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-100">
                  {item.message.text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* === NEARBY PICKUP BUTTON / PROMPT === */}
      {telemetry.isAlive && telemetry.nearbyPickupLabel && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPickup();
          }}
          className="pointer-events-auto absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/75 bg-slate-950/90 px-3.5 py-1.5 text-xs font-black tracking-wide text-emerald-300 shadow-xl backdrop-blur-md transition hover:bg-emerald-950/90 active:scale-95 sm:bottom-14"
          title="Pick up weapon or supply (X)"
        >
          {!isMobile && <span className={styles.keycap}>X</span>}
          <span>
            {isMobile
              ? `Tap: ${telemetry.nearbyPickupLabel}`
              : telemetry.nearbyPickupLabel}
          </span>
        </button>
      )}

      {/* === RESPAWN / SPECTATOR STATUS BAR === */}
      {!telemetry.isAlive && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/88 px-4 py-2 shadow-2xl backdrop-blur-md">
          {telemetry.livesLeft > 0 ? (
            <div className="flex items-center gap-2 text-xs font-black text-amber-300 sm:text-sm">
              <Skull className="h-4 w-4 text-rose-400" />
              <span>
                Respawning in {Math.max(1, telemetry.respawnSecondsLeft)}s (
                {telemetry.livesLeft} lives left)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Eye className="h-4 w-4 text-sky-400" />
              <span>
                Eliminated • Spectating{" "}
                <strong className="text-white">
                  {spectatingName ?? "Arena"}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onSpectateStep(-1)}
                className="rounded-md bg-white/10 p-1 hover:bg-white/20"
                aria-label="Previous player"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onSpectateStep(1)}
                className="rounded-md bg-white/10 p-1 hover:bg-white/20"
                aria-label="Next player"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* === MOBILE MULTI-TOUCH CONTROLS (>= 3 Simultaneous Pointers, Zero Overlap) === */}
      {isMobile && telemetry.isAlive && (
        <>
          {/* Bottom-Left: Move + Jetpack Virtual Joystick */}
          <div
            ref={onBindMoveStick}
            className={`pointer-events-auto absolute bottom-2.5 left-3 flex h-28 w-28 items-center justify-center rounded-full border-3 border-white/80 bg-slate-950/25 shadow-lg backdrop-blur-[2px] ${styles.touchZone}`}
            aria-label="Move and jetpack joystick"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-md transition-colors ${
                touchVisual.boosting
                  ? "border-sky-300 bg-sky-500/75"
                  : "border-white/90 bg-white/30"
              }`}
              style={{
                transform: `translate3d(${touchVisual.moveStick.dx * 34}px, ${touchVisual.moveStick.dy * 34}px, 0)`,
              }}
            >
              {touchVisual.boosting && (
                <Zap className="h-5 w-5 text-white drop-shadow" />
              )}
            </div>
          </div>

          {/* Beside Left Stick: Frag Grenade Throw Button */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onThrowBomb();
            }}
            disabled={
              telemetry.bombsLeft <= 0 || telemetry.bombCooldownRatio < 1
            }
            className={`pointer-events-auto absolute bottom-3 left-34 flex h-13 w-13 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-45 ${styles.hudCircleBtn} ${styles.touchZone}`}
            aria-label="Throw grenade"
          >
            <GrenadeIcon className="h-6 w-6 text-amber-300" />
            <span className="absolute right-0.5 bottom-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
              {telemetry.bombsLeft}
            </span>
          </button>

          {/* Beside Right Stick: Melee Bash Button (kept clear of repositioned fire stick) */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onMelee();
            }}
            className={`pointer-events-auto absolute right-44 bottom-3 flex h-13 w-13 items-center justify-center rounded-full transition active:scale-90 ${styles.hudCircleBtn} ${styles.touchZone}`}
            aria-label="Melee strike"
          >
            <Hand className="h-6 w-6 text-white" />
          </button>

          {/* Bottom-Right: Aim + Auto-Fire Virtual Joystick (+40px up, +40px left from edge) */}
          <div
            ref={onBindAimStick}
            className={`pointer-events-auto absolute right-[52px] bottom-[50px] flex h-28 w-28 items-center justify-center rounded-full border-3 shadow-lg backdrop-blur-[2px] ${styles.touchZone} ${
              touchVisual.autoFiring
                ? "border-rose-400 bg-rose-950/40"
                : "border-white/80 bg-rose-950/25"
            }`}
            aria-label="Aim and fire joystick"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-md transition-colors ${
                touchVisual.autoFiring
                  ? "border-amber-300 bg-rose-500/85"
                  : "border-white/90 bg-rose-500/45"
              }`}
              style={{
                transform: `translate3d(${touchVisual.aimStick.dx * 34}px, ${touchVisual.aimStick.dy * 34}px, 0)`,
              }}
            >
              <Crosshair className="h-5 w-5 text-white" />
            </div>
          </div>
        </>
      )}

      {/* === DESKTOP BOTTOM KEYCAPS BAR === */}
      {!isMobile && telemetry.isAlive && (
        <div className="pointer-events-none absolute right-3 bottom-2.5 left-3 flex items-end justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/72 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 backdrop-blur-md">
            <span className={styles.keycap}>A/D</span>
            <span>Move</span>
            <span className={styles.keycap}>W/Space</span>
            <span>Jetpack</span>
            <span className={styles.keycap}>S</span>
            <span>Drop</span>
            <span className={styles.keycap}>LMB</span>
            <span>Fire</span>
            <span className={styles.keycap}>RMB/G</span>
            <span>Frag</span>
            <span className={styles.keycap}>E</span>
            <span>Melee</span>
            <span className={styles.keycap}>X</span>
            <span>Pick Up</span>
            <span className={styles.keycap}>Tab</span>
            <span>Scores</span>
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onMelee();
            }}
            className={`pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 ${styles.hudCircleBtn}`}
            title="Melee Strike (E)"
            aria-label="Melee Strike"
          >
            <Hand className="h-5 w-5 text-white" />
            <span className={`absolute -right-1 -bottom-1 ${styles.keycap}`}>
              E
            </span>
          </button>
        </div>
      )}

      {/* === TAB SCOREBOARD OVERLAY === */}
      {scoreboardOpen && !isPaused && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black tracking-widest text-sky-300 uppercase">
                {mapName} • Live Standings
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {telemetry.alivePlayersCount} ALIVE
              </span>
            </div>
            <div className="space-y-1.5">
              {scoreRows.map((row, idx) => {
                const charDef = CHARACTER_CATALOG[row.characterId];
                const isMe = row.userId === currentUserId;
                return (
                  <div
                    key={row.userId}
                    className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                      isMe
                        ? "border-sky-400/50 bg-sky-500/15"
                        : "border-white/10 bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 font-mono font-black text-amber-300">
                        #{idx + 1}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-black text-slate-950"
                        style={{ backgroundColor: charDef.palette.sashColor }}
                      >
                        {charDef.name}
                      </span>
                      <span className="truncate font-bold text-white">
                        {row.username}
                        {!row.connected ? " (Offline)" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-rose-300">{row.livesLeft}♥</span>
                      <span className="font-black text-amber-300">
                        {row.kills}K
                      </span>
                      <span className="text-slate-400">{row.deaths}D</span>
                      <span className="text-slate-300">
                        {Math.round(row.damageDealt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* === PAUSE & SETTINGS MODAL === */}
      {isPaused && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/78 p-4 backdrop-blur-sm"
          onPointerDown={(e) => {
            pauseBackdropDownRef.current = e.target === e.currentTarget;
            e.stopPropagation();
          }}
          onClick={(e) => {
            const shouldClose =
              pauseBackdropDownRef.current && e.target === e.currentTarget;
            pauseBackdropDownRef.current = false;
            if (shouldClose) {
              onTogglePause();
            }
          }}
        >
          <div
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black tracking-wider text-white uppercase">
                  Match Paused
                </h2>
                <p className="text-[11px] text-slate-400">
                  {mapName} • Multiplayer remains live in real time
                </p>
              </div>
              <button
                type="button"
                onClick={onTogglePause}
                className="flex items-center gap-1 rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-black text-white hover:bg-sky-400"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume
              </button>
            </div>

            {/* Audio Bus Volume Sliders */}
            <div className="mb-4 space-y-2.5 rounded-xl border border-white/10 bg-slate-950/65 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black tracking-wider text-slate-300 uppercase">
                  Audio Mixer
                </span>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200 hover:bg-white/20"
                >
                  {muted ? "Unmute All" : "Mute All"}
                </button>
              </div>
              {(["master", "sfx", "ambience", "ui"] as const).map((bus) => (
                <label
                  key={bus}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="w-20 font-bold text-slate-300 capitalize">
                    {bus}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes[bus]}
                    onChange={(e) =>
                      onVolumeChange(bus, Number(e.target.value))
                    }
                    className="h-1.5 flex-1 accent-sky-400"
                  />
                  <span className="w-8 text-right font-mono text-[10px] text-slate-400">
                    {Math.round(volumes[bus] * 100)}%
                  </span>
                </label>
              ))}
            </div>

            {/* F3 Developer & Map Collision Debug Toggles */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleDebugCollisions}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                  debug.showCollisions
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : "border-white/15 bg-slate-950/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Bug className="h-3.5 w-3.5" />
                Collision Chains (F3)
              </button>

              <button
                type="button"
                onClick={onToggleDebugSpawns}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                  debug.showSpawns
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/15 bg-slate-950/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                Spawn & Pickup Pads
              </button>

              <button
                type="button"
                onClick={onToggleFullscreen}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>

            {/* Room / Leave Actions */}
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
              {onBackToRoom && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePause();
                    onBackToRoom();
                  }}
                  className="flex-1 rounded-xl border border-white/15 bg-slate-800 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-700"
                >
                  Back to Room
                </button>
              )}
              {onLeaveMatch && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePause();
                    onLeaveMatch();
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-500"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Leave Match
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
