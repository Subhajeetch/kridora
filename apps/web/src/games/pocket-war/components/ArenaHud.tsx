import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flame,
  Hand,
  Heart,
  LogOut,
  Maximize2,
  MessageSquare,
  Minimize2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Shield,
  ShieldAlert,
  Skull,
  Smartphone,
  Swords,
  Users,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from "lucide-react";
import {
  CHARACTER_CATALOG,
  MAP_CATALOG,
  WEAPON_CATALOG,
} from "@kridora/shared/games/pocket-war";
import { getKillWeaponIconPath } from "../assets/AssetLoader";
import type { SoundBusName } from "../engine/SoundFX";
import styles from "../pocket-war.module.css";
import type {
  DebugOverlayOptions,
  HudTelemetry,
  KillWeaponIconId,
  PocketWarPlayer,
  PocketWarState,
  SoundBusVolumes,
} from "../types";

export interface ArenaHudProps {
  state: PocketWarState;
  currentUserId: string;
  telemetry: HudTelemetry;
  isMobile: boolean;
  isPortrait: boolean;
  isFullscreen: boolean;
  isPaused: boolean;
  scoreboardOpen: boolean;
  muted: boolean;
  volumes: SoundBusVolumes;
  debug: DebugOverlayOptions;
  fps: number;
  spectatingPlayer: PocketWarPlayer | null;
  onUnlockAudio: () => void;
  onLeftStick: (dx: number, dy: number) => void;
  onRightStick: (dx: number, dy: number, active: boolean) => void;
  onTapFire: (active: boolean) => void;
  onGrenadeAimChange: (aiming: boolean) => void;
  onThrowBomb: () => void;
  onMelee: () => void;
  onReload: () => void;
  onSwitchWeapon: (slot?: 0 | 1) => void;
  onToggleScope: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onVolumeChange: (bus: SoundBusName, value: number) => void;
  onToggleDebugCollisions: () => void;
  onToggleDebugSpawns: () => void;
  onToggleFullscreen: () => void;
  onToggleScoreboard: () => void;
  onSpectateStep: (delta: -1 | 1) => void;
  onOpenChat: () => void;
  onBackToRoom?: () => void;
  onLeaveMatch?: () => void;
}

function formatClip(value: number): string {
  return String(Math.max(0, Math.round(value))).padStart(3, "0");
}

function WeaponImageOrGlyph({
  weaponId,
  className = "h-6 w-12",
}: {
  weaponId: KillWeaponIconId;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = getKillWeaponIconPath(weaponId);

  if (failed) {
    if (weaponId === "grenade" || weaponId === "barrel") {
      return <Flame className="h-4 w-4 shrink-0 text-amber-300" />;
    }
    if (weaponId === "melee") {
      return <Swords className="h-4 w-4 shrink-0 text-emerald-300" />;
    }
    return <Crosshair className="h-4 w-4 shrink-0 text-slate-200" />;
  }

  return (
    <img
      src={src}
      alt={weaponId}
      onError={() => setFailed(true)}
      className={`${className} shrink-0 object-contain drop-shadow`}
      draggable={false}
    />
  );
}

function MagazineGlyph() {
  return (
    <svg
      viewBox="0 0 36 36"
      className="h-7 w-7 text-white drop-shadow"
      fill="currentColor"
      aria-hidden="true"
    >
      {[6, 13, 20, 27].map((y) => (
        <g key={y}>
          <path d={`M7 ${y} L13 ${y - 2} L13 ${y + 2} Z`} />
          <rect x="14" y={y - 2} width="14" height="4" rx="1" />
        </g>
      ))}
    </svg>
  );
}

function GrenadeGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 5h6v4h-6z" />
      <path d="M19 6c3 0 5 2 5 5" />
      <ellipse cx="16" cy="19" rx="7.5" ry="9" />
      <path d="M9 17h14M9 21h14M16 10v18" />
    </svg>
  );
}

function KeyHint({
  keys,
  label,
  icon,
  active = false,
  onClick,
}: {
  keys: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition ${
        active
          ? "border-sky-400/70 bg-sky-500/25 text-sky-100"
          : "border-white/10 bg-slate-900/75 text-slate-200 hover:border-white/25 hover:bg-slate-800/85"
      }`}
    >
      {icon}
      <kbd className={styles.keycap}>{keys}</kbd>
      <span className="font-semibold text-slate-300">{label}</span>
    </button>
  );
}

export function ArenaHud({
  state,
  currentUserId,
  telemetry,
  isMobile,
  isPortrait,
  isFullscreen,
  isPaused,
  scoreboardOpen,
  muted,
  volumes,
  debug,
  fps,
  spectatingPlayer,
  onUnlockAudio,
  onLeftStick,
  onRightStick,
  onTapFire,
  onGrenadeAimChange,
  onThrowBomb,
  onMelee,
  onReload,
  onSwitchWeapon,
  onToggleScope,
  onTogglePause,
  onToggleMute,
  onVolumeChange,
  onToggleDebugCollisions,
  onToggleDebugSpawns,
  onToggleFullscreen,
  onToggleScoreboard,
  onSpectateStep,
  onOpenChat,
  onBackToRoom,
  onLeaveMatch,
}: ArenaHudProps) {
  const leftPointerIdRef = useRef<number | null>(null);
  const rightPointerIdRef = useRef<number | null>(null);
  const tapFirePointerIdRef = useRef<number | null>(null);
  const grenadePointerIdRef = useRef<number | null>(null);

  const leftKnobRef = useRef<HTMLDivElement | null>(null);
  const rightKnobRef = useRef<HTMLDivElement | null>(null);

  const localPlayer = state.players[currentUserId];
  const isAlive = localPlayer?.isAlive ?? false;
  const activeWeapon = WEAPON_CATALOG[telemetry.activeWeaponId];
  const playersList = Object.values(state.players);
  const contendersLeft = playersList.filter((p) => p.livesLeft > 0).length;
  const selectedMap = MAP_CATALOG[state.settings.mapId];

  const hpPct = Math.max(
    0,
    Math.min(100, (telemetry.hp / Math.max(1, telemetry.maxHp)) * 100),
  );
  const fuelPct = Math.max(0, Math.min(100, telemetry.jetpackFuel));

  const updateKnobTransform = (
    el: HTMLDivElement | null,
    dx: number,
    dy: number,
    maxTravel: number,
  ) => {
    if (!el) return;
    el.style.transform = `translate3d(${(dx * maxTravel).toFixed(1)}px, ${(dy * maxTravel).toFixed(1)}px, 0)`;
  };

  // --- Pointer-ID Isolated Left Movement + Jetpack Stick ---
  const computeStickAxes = (
    el: HTMLElement,
    clientX: number,
    clientY: number,
  ) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const maxR = Math.max(24, rect.width * 0.42);
    let dx = (clientX - cx) / maxR;
    let dy = (clientY - cy) / maxR;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  };

  const handleLeftDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leftPointerIdRef.current !== null) return;
    onUnlockAudio();
    leftPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { dx, dy } = computeStickAxes(e.currentTarget, e.clientX, e.clientY);
    onLeftStick(dx, dy);
    updateKnobTransform(leftKnobRef.current, dx, dy, 30);
  };

  const handleLeftMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leftPointerIdRef.current !== e.pointerId) return;
    const { dx, dy } = computeStickAxes(e.currentTarget, e.clientX, e.clientY);
    onLeftStick(dx, dy);
    updateKnobTransform(leftKnobRef.current, dx, dy, 30);
  };

  const handleLeftUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leftPointerIdRef.current !== e.pointerId) return;
    leftPointerIdRef.current = null;
    onLeftStick(0, 0);
    updateKnobTransform(leftKnobRef.current, 0, 0, 30);
  };

  // --- Pointer-ID Isolated Right Aim + Auto-Fire Stick ---
  const handleRightDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rightPointerIdRef.current !== null) return;
    onUnlockAudio();
    rightPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { dx, dy } = computeStickAxes(e.currentTarget, e.clientX, e.clientY);
    onRightStick(dx, dy, true);
    updateKnobTransform(rightKnobRef.current, dx, dy, 32);
  };

  const handleRightMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rightPointerIdRef.current !== e.pointerId) return;
    const { dx, dy } = computeStickAxes(e.currentTarget, e.clientX, e.clientY);
    onRightStick(dx, dy, true);
    updateKnobTransform(rightKnobRef.current, dx, dy, 32);
  };

  const handleRightUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (rightPointerIdRef.current !== e.pointerId) return;
    rightPointerIdRef.current = null;
    onRightStick(0, 0, false);
    updateKnobTransform(rightKnobRef.current, 0, 0, 32);
  };

  // --- Overlapping Smaller Red Circle: Precision Tap-Fire ---
  const handleTapFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (tapFirePointerIdRef.current !== null) return;
    onUnlockAudio();
    tapFirePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    onTapFire(true);
  };

  const handleTapFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (tapFirePointerIdRef.current !== e.pointerId) return;
    tapFirePointerIdRef.current = null;
    onTapFire(false);
  };

  // --- Hold-to-Preview, Release-to-Throw Grenade Button ---
  const handleGrenadeDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (grenadePointerIdRef.current !== null) return;
    onUnlockAudio();
    grenadePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    onGrenadeAimChange(true);
  };

  const handleGrenadeUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (grenadePointerIdRef.current !== e.pointerId) return;
    grenadePointerIdRef.current = null;
    onGrenadeAimChange(false);
    onThrowBomb();
  };

  const handleGrenadeCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (grenadePointerIdRef.current !== e.pointerId) return;
    grenadePointerIdRef.current = null;
    onGrenadeAimChange(false);
  };

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-20 select-none ${styles.safeHud}`}
    >
      {/* === TOP HUD ROW (Matches Image 1 silhouette across Mobile & PC) === */}
      <div className="flex items-start justify-between gap-2 px-2.5 pt-2 sm:px-4 sm:pt-3">
        {/* TOP-LEFT: 5X Scope + Angled HP / Fuel / Pause Panel + Lives Pips */}
        <div className="flex items-start gap-2 sm:gap-3">
          {/* 5X Scope Toggle Circle (Image 1 far top-left) */}
          <button
            type="button"
            onClick={() => {
              onUnlockAudio();
              onToggleScope();
            }}
            className={`pointer-events-auto flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 shadow-lg backdrop-blur-sm transition active:scale-95 sm:h-14 sm:w-14 ${
              telemetry.isScoped
                ? "border-sky-300 bg-sky-500/45 text-white shadow-sky-500/35"
                : "border-white/80 bg-slate-900/45 text-white hover:bg-slate-900/65"
            }`}
            title="Toggle 5X Tactical Scope (Z / Shift)"
          >
            <Crosshair className="h-3.5 w-3.5 opacity-80" />
            <span className="-mt-0.5 text-xs font-black tracking-tight sm:text-sm">
              5X
            </span>
          </button>

          {/* Angled Health (Magenta) + Jetpack Fuel (Blue) + Pause Bar */}
          <div className="flex flex-col gap-1.5">
            <div
              className={`pointer-events-auto flex items-center gap-2 rounded-xl border-2 border-white/80 bg-slate-900/45 px-2.5 py-1.5 shadow-lg backdrop-blur-sm sm:px-3 ${styles.angledPanel}`}
            >
              <div className="flex w-32 flex-col gap-1.5 sm:w-48">
                {/* Health Bar (Heart + Magenta) */}
                <div className="flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 shrink-0 fill-white text-white drop-shadow" />
                  <div className="relative h-3 flex-1 overflow-hidden rounded-sm border border-white/70 bg-slate-950/75">
                    <div
                      className="h-full transition-all duration-150"
                      style={{
                        width: `${hpPct}%`,
                        background:
                          hpPct > 30
                            ? "linear-gradient(90deg, #c026d3, #e879f9)"
                            : "linear-gradient(90deg, #dc2626, #f43f5e)",
                      }}
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-end pr-1 text-[9px] font-black text-white drop-shadow">
                      {Math.round(telemetry.hp)}
                    </span>
                  </div>
                </div>

                {/* Jetpack Fuel Bar (Lightning + Blue + Low-Fuel Warning) */}
                <div className="flex items-center gap-1.5">
                  <Zap
                    className={`h-3.5 w-3.5 shrink-0 ${
                      telemetry.isOverheated
                        ? "fill-rose-400 text-rose-400"
                        : telemetry.isLowFuel
                          ? "fill-amber-300 text-amber-300"
                          : "fill-white text-white"
                    } drop-shadow`}
                  />
                  <div
                    className={`relative h-3 flex-1 overflow-hidden rounded-sm border border-white/70 bg-slate-950/75 ${
                      telemetry.isLowFuel || telemetry.isOverheated
                        ? styles.lowFuelPulse
                        : ""
                    }`}
                  >
                    <div
                      className="h-full transition-all duration-75"
                      style={{
                        width: `${fuelPct}%`,
                        background: telemetry.isOverheated
                          ? "linear-gradient(90deg, #dc2626, #fb7185)"
                          : telemetry.isLowFuel
                            ? "linear-gradient(90deg, #ea580c, #facc15)"
                            : "linear-gradient(90deg, #1d4ed8, #38bdf8)",
                      }}
                    />
                    {telemetry.isOverheated && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-black tracking-wider text-white uppercase">
                        OVERHEAT
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pause Button inside the top-left HUD bar (Image 1) */}
              <button
                type="button"
                onClick={() => {
                  onUnlockAudio();
                  onTogglePause();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-slate-950/40 text-white transition hover:bg-slate-800/80 active:scale-95"
                title="Pause / Settings (Esc)"
                aria-label="Pause game"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
              </button>
            </div>

            {/* Lives Pips + Contenders + FPS (if debug) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/65 px-2.5 py-0.5 text-[11px] font-black text-white backdrop-blur-sm">
                <span className="mr-0.5 text-[9px] tracking-wider text-slate-300 uppercase">
                  Lives
                </span>
                {Array.from({ length: telemetry.maxLives }).map((_, idx) => {
                  const active = idx < telemetry.livesLeft;
                  return (
                    <Heart
                      key={idx}
                      className={`h-3.5 w-3.5 transition ${
                        active
                          ? "fill-rose-500 text-rose-400 drop-shadow"
                          : "text-slate-600"
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={onToggleScoreboard}
                className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/25 bg-slate-950/65 px-2.5 py-0.5 text-[11px] font-black text-amber-300 backdrop-blur-sm hover:bg-slate-900"
                title="Live Scoreboard (Tab)"
              >
                <Users className="h-3 w-3" />
                <span>{contendersLeft} Left</span>
              </button>

              {telemetry.isInvulnerable && isAlive && (
                <div className="flex items-center gap-1 rounded-full border border-sky-400/60 bg-sky-500/25 px-2 py-0.5 text-[10px] font-black text-sky-200">
                  <Shield className="h-3 w-3" />
                  <span>SHIELD</span>
                </div>
              )}

              {(debug.showFps || debug.showCollisions) && (
                <div className="rounded-full border border-emerald-400/50 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  {fps} FPS {debug.showCollisions ? "• COLLISION DEBUG" : ""}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TOP-RIGHT: Angled Weapon Panel (Ammo + Grenade badge) + Reload Circle + Fullscreen */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-start gap-2">
            {/* Weapon Panel (tap to swap primary/secondary) */}
            <button
              type="button"
              onClick={() => {
                onUnlockAudio();
                onSwitchWeapon();
              }}
              className="pointer-events-auto flex items-center gap-2 rounded-xl border-2 border-white/80 bg-slate-900/45 px-2.5 py-1.5 text-left shadow-lg backdrop-blur-sm transition hover:bg-slate-900/65 active:scale-95 sm:px-3"
              title="Tap or press Q to switch weapon"
            >
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5">
                  <WeaponImageOrGlyph
                    weaponId={activeWeapon.id}
                    className="h-7 w-14 sm:h-8 sm:w-16"
                  />
                  <span className="hidden text-[10px] font-black tracking-wide text-amber-300 uppercase sm:inline">
                    {activeWeapon.shortName}
                  </span>
                </div>

                {/* Clip / Reserve counter ("012 / 147" style from Image 1) */}
                <div className="mt-0.5 flex items-center gap-2 font-mono text-xs font-black tracking-wider text-white sm:text-sm">
                  {telemetry.isReloading ? (
                    <span className="text-sky-300">
                      RELOAD {Math.round(telemetry.reloadProgress * 100)}%
                    </span>
                  ) : (
                    <>
                      <span
                        className={
                          telemetry.ammo <= Math.ceil(telemetry.magSize * 0.25)
                            ? "text-rose-300"
                            : "text-white"
                        }
                      >
                        {formatClip(telemetry.ammo)}
                      </span>
                      <span className="text-white/50">/</span>
                      <span className="text-slate-200">
                        {telemetry.reserveAmmo < 0
                          ? "∞"
                          : formatClip(telemetry.reserveAmmo)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Grenade icon circle inside weapon panel (Image 1) */}
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/75 bg-slate-950/50 text-amber-200">
                <GrenadeGlyph className="h-5 w-5" />
                <span className="absolute -right-1 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-slate-950">
                  {telemetry.bombsLeft}
                </span>
              </div>
            </button>

            {/* Circular Reload Magazine Button (Image 1 far top-right) */}
            <button
              type="button"
              onClick={() => {
                onUnlockAudio();
                onReload();
              }}
              className="pointer-events-auto relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/85 bg-slate-900/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-slate-900/65 active:scale-90 sm:h-14 sm:w-14"
              title="Reload Weapon (R)"
              aria-label="Reload weapon"
            >
              <MagazineGlyph />
              {telemetry.isReloading && (
                <span className="absolute inset-0 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
              )}
            </button>

            {/* Compact Fullscreen button */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="pointer-events-auto hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-slate-950/60 text-white backdrop-blur-sm hover:bg-slate-800 sm:flex"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Animated Kill Feed Notifications ("User 1 killed User 2") */}
          <div className="flex w-64 flex-col items-end gap-1 sm:w-72">
            {state.killFeed.slice(0, 4).map((entry) => {
              const involvesLocal =
                entry.killerId === currentUserId ||
                entry.victimId === currentUserId;
              return (
                <div
                  key={entry.id}
                  className={`flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] shadow-md backdrop-blur-md ${styles.killFeedEntry} ${
                    involvesLocal
                      ? "border-amber-400/60 bg-slate-950/85"
                      : "border-white/15 bg-slate-950/75"
                  }`}
                >
                  <span className="max-w-20 truncate font-black text-amber-300">
                    {entry.killerName}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    killed
                  </span>
                  <span className="max-w-20 truncate font-black text-rose-400">
                    {entry.victimName}
                  </span>
                  <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-slate-200">
                    <WeaponImageOrGlyph
                      weaponId={entry.weaponId}
                      className="h-3.5 w-6"
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === RESPAWN COUNTDOWN BANNER (when dead with lives left) === */}
      {!isAlive && telemetry.livesLeft > 0 && state.phase === "playing" && (
        <div className="absolute top-1/2 left-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border border-sky-400/40 bg-slate-950/85 px-7 py-4 text-center shadow-2xl backdrop-blur-md">
          <span className="text-[11px] font-black tracking-widest text-rose-400 uppercase">
            Downed — {telemetry.livesLeft}{" "}
            {telemetry.livesLeft === 1 ? "Life" : "Lives"} Left
          </span>
          <div className="text-2xl font-black text-white">
            Respawning in {Math.max(1, telemetry.respawnSecondsLeft)}s...
          </div>
          <span className="text-xs text-slate-300">
            Scanning safe jungle drop zone
          </span>
        </div>
      )}

      {/* === SPECTATOR MODE CONTROLS (when out of lives) === */}
      {!isAlive && telemetry.livesLeft <= 0 && state.phase === "playing" && (
        <div className="pointer-events-auto absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-slate-950/90 px-4 py-2.5 shadow-2xl backdrop-blur">
          <span className="flex items-center gap-1.5 text-xs font-black tracking-wide text-rose-400 uppercase">
            <ShieldAlert className="h-4 w-4" />
            Eliminated — Spectating:
          </span>
          <button
            type="button"
            onClick={() => onSpectateStep(-1)}
            className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
            aria-label="Previous survivor"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-24 text-center text-xs font-bold text-amber-300">
            {spectatingPlayer?.username ?? "Emerald Falls"}
          </span>
          <button
            type="button"
            onClick={() => onSpectateStep(1)}
            className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
            aria-label="Next survivor"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {onBackToRoom && (
            <button
              type="button"
              onClick={onBackToRoom}
              className="ml-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
            >
              Room
            </button>
          )}
          {onLeaveMatch && (
            <button
              type="button"
              onClick={onLeaveMatch}
              className="flex items-center gap-1 rounded-lg bg-rose-600/85 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500"
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </button>
          )}
        </div>
      )}

      {/* === MOBILE TOUCH CONTROLS ONLY (Matches Image 1 Bottom Layout) === */}
      {isMobile && isAlive && !isPaused && (
        <>
          {/* Bottom-Left: Blue Movement + Jetpack Joystick + Grenade Button with Count */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex items-end gap-3">
            {/* Left Blue Joystick */}
            <div
              onPointerDown={handleLeftDown}
              onPointerMove={handleLeftMove}
              onPointerUp={handleLeftUp}
              onPointerCancel={handleLeftUp}
              className="pointer-events-auto relative flex h-32 w-32 touch-none items-center justify-center rounded-full border-4 border-white/85 bg-slate-900/35 shadow-xl backdrop-blur-[2px]"
              aria-label="Movement and Jetpack Joystick"
            >
              <div className="pointer-events-none h-24 w-24 rounded-full border-2 border-indigo-300/40 bg-indigo-950/30" />
              <div
                ref={leftKnobRef}
                className="pointer-events-none absolute flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/90 bg-indigo-500/75 shadow-lg will-change-transform"
              >
                <Zap className="h-5 w-5 text-white/90" />
              </div>
            </div>

            {/* Grenade Button with Count Badge ("3" in Image 1) */}
            <button
              type="button"
              onPointerDown={handleGrenadeDown}
              onPointerUp={handleGrenadeUp}
              onPointerCancel={handleGrenadeCancel}
              disabled={telemetry.bombsLeft <= 0}
              className="pointer-events-auto relative mb-1 flex h-16 w-16 touch-none items-center justify-center rounded-full border-3 border-white/85 bg-slate-900/45 text-white shadow-xl backdrop-blur-[2px] active:scale-95 disabled:opacity-45"
              aria-label="Hold to aim grenade, release to throw"
            >
              <GrenadeGlyph className="h-8 w-8" />
              <span className="absolute right-1.5 bottom-1 rounded bg-slate-950/85 px-1 font-mono text-xs font-black text-white">
                {telemetry.bombsLeft}
              </span>
              {telemetry.bombCooldownRatio < 1 && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/60 text-[10px] font-black text-amber-300">
                  {Math.round((1 - telemetry.bombCooldownRatio) * 100)}%
                </span>
              )}
            </button>
          </div>

          {/* Bottom-Right: Melee Fist Button + Overlapping Large & Small Red Fire/Aim Circles (Image 1) */}
          <div className="pointer-events-none absolute right-4 bottom-4 z-30 flex items-end gap-3">
            {/* Melee Fist Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onUnlockAudio();
                onMelee();
              }}
              className="pointer-events-auto mb-1 flex h-16 w-16 touch-none items-center justify-center rounded-full border-3 border-white/85 bg-slate-900/45 text-white shadow-xl backdrop-blur-[2px] active:scale-90"
              aria-label="Melee Strike"
            >
              <Hand className="h-8 w-8" />
            </button>

            {/* Overlapping Red Aim/Auto-Fire (large) & Tap-Fire (smaller upper-left) Circles */}
            <div className="relative h-36 w-40">
              {/* Smaller Upper-Left Overlapping Red Tap-Fire Circle */}
              <button
                type="button"
                onPointerDown={handleTapFireDown}
                onPointerUp={handleTapFireUp}
                onPointerCancel={handleTapFireUp}
                className="pointer-events-auto absolute top-0 left-0 z-10 flex h-20 w-20 touch-none items-center justify-center rounded-full border-3 border-white/85 bg-rose-900/55 text-[10px] font-black tracking-wider text-white/95 shadow-lg backdrop-blur-[2px] active:scale-95 active:bg-rose-600/75"
                aria-label="Tap Fire"
              >
                FIRE
              </button>

              {/* Larger Bottom-Right Red Aim + Auto-Fire Stick */}
              <div
                onPointerDown={handleRightDown}
                onPointerMove={handleRightMove}
                onPointerUp={handleRightUp}
                onPointerCancel={handleRightUp}
                className="pointer-events-auto absolute right-0 bottom-0 z-20 flex h-32 w-32 touch-none items-center justify-center rounded-full border-4 border-white/90 bg-rose-900/50 shadow-xl backdrop-blur-[2px]"
                aria-label="Aim and Auto-Fire Joystick"
              >
                <div
                  ref={rightKnobRef}
                  className="pointer-events-none flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/90 bg-rose-500/80 text-white shadow-lg will-change-transform"
                >
                  <Crosshair className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* === DESKTOP BOTTOM KEYCAP CONTROL BAR (PC ONLY — Zero Touch Joysticks) === */}
      {!isMobile && !isPaused && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-20 flex justify-center px-4">
          <div className="flex max-w-[96vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-slate-950/75 px-3 py-1.5 shadow-2xl backdrop-blur-md">
            <KeyHint keys="A / D" label="Move" />
            <KeyHint
              keys="W / Space"
              label="Jetpack"
              icon={<Zap className="h-3 w-3 text-sky-400" />}
            />
            <KeyHint keys="S" label="Drop" />
            <KeyHint
              keys="LMB"
              label="Fire"
              icon={<Crosshair className="h-3 w-3 text-rose-400" />}
            />
            <KeyHint
              keys="RMB / G"
              label={`Frag (${telemetry.bombsLeft})`}
              icon={<Flame className="h-3 w-3 text-amber-400" />}
              onClick={onThrowBomb}
            />
            <KeyHint
              keys="E / F"
              label="Melee"
              icon={<Swords className="h-3 w-3 text-emerald-400" />}
              onClick={onMelee}
            />
            <KeyHint
              keys="R"
              label="Reload"
              icon={<RotateCcw className="h-3 w-3 text-sky-300" />}
              onClick={onReload}
            />
            <KeyHint
              keys="Q / 1-2"
              label="Switch"
              icon={<Repeat className="h-3 w-3 text-amber-300" />}
              onClick={() => onSwitchWeapon()}
            />
            <KeyHint
              keys="Z / Shift"
              label="5X Scope"
              active={telemetry.isScoped}
              onClick={onToggleScope}
            />
            <KeyHint
              keys="T"
              label="Chat"
              icon={<MessageSquare className="h-3 w-3 text-amber-300" />}
              onClick={onOpenChat}
            />
            <KeyHint keys="Tab" label="Scores" onClick={onToggleScoreboard} />
            <KeyHint keys="Esc" label="Pause" onClick={onTogglePause} />
          </div>
        </div>
      )}

      {/* === LIVE SCOREBOARD OVERLAY (Tab) === */}
      {scoreboardOpen && !isPaused && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black tracking-wider text-amber-400 uppercase">
                {selectedMap.name} — Live Battle
              </h3>
              <span className="text-xs font-bold text-slate-400">
                {contendersLeft} Contenders
              </span>
            </div>
            <div className="space-y-1.5">
              {[...playersList]
                .sort((a, b) => b.livesLeft - a.livesLeft || b.kills - a.kills)
                .map((p) => {
                  const charDef = CHARACTER_CATALOG[p.characterId];
                  const isMe = p.userId === currentUserId;
                  return (
                    <div
                      key={p.userId}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                        isMe
                          ? "border-sky-400/40 bg-sky-500/15"
                          : "border-white/5 bg-slate-950/70"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {p.livesLeft <= 0 && (
                          <Skull className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        <span
                          className={
                            p.livesLeft > 0
                              ? "font-bold text-white"
                              : "text-slate-500 line-through"
                          }
                        >
                          {p.username}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-black text-slate-950"
                          style={{ backgroundColor: charDef.palette.sashColor }}
                        >
                          {charDef.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-slate-200">
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: p.maxLives }).map((_, i) => (
                            <Heart
                              key={i}
                              className={`h-3 w-3 ${
                                i < p.livesLeft
                                  ? "fill-rose-500 text-rose-400"
                                  : "text-slate-700"
                              }`}
                            />
                          ))}
                        </span>
                        <span className="font-bold text-amber-300">
                          {p.kills}K
                        </span>
                        <span className="text-slate-400">{p.deaths}D</span>
                        <span className="hidden text-slate-400 sm:inline">
                          {Math.round(p.damageDealt)} DMG
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* === PAUSE / AUDIO / ALIGNMENT DEBUG MODAL === */}
      {isPaused && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black tracking-wide uppercase">
                  Game Paused
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedMap.name} • Real-time match continues in background
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className="rounded-xl border border-white/15 bg-slate-800 p-2 text-white hover:bg-slate-700"
                aria-label="Toggle mute"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-sky-300" />
                )}
              </button>
            </div>

            {/* Audio Bus Sliders */}
            <div className="mb-4 space-y-2.5 rounded-xl border border-white/10 bg-slate-950/60 p-3">
              {(
                [
                  { key: "master", label: "Master Volume" },
                  { key: "sfx", label: "Weapons & Explosions" },
                  { key: "ambience", label: "Jungle Ambience" },
                  { key: "ui", label: "UI & Hitmarkers" },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="block text-xs">
                  <div className="mb-1 flex justify-between font-bold text-slate-300">
                    <span>{label}</span>
                    <span className="font-mono text-sky-300">
                      {Math.round(volumes[key] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes[key]}
                    onChange={(e) =>
                      onVolumeChange(key, Number(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-sky-400"
                  />
                </label>
              ))}
            </div>

            {/* Map Alignment Collision Debug Toggles */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleDebugCollisions}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  debug.showCollisions
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                Collision Boxes (F3)
              </button>
              <button
                type="button"
                onClick={onToggleDebugSpawns}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  debug.showSpawns
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                    : "border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Spawns & Pads
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onTogglePause}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-black text-slate-950 hover:bg-sky-400"
              >
                <Play className="h-4 w-4 fill-current" />
                Resume Battle
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-slate-800 py-2 text-xs font-bold text-white hover:bg-slate-700"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </button>
                {onBackToRoom && (
                  <button
                    type="button"
                    onClick={onBackToRoom}
                    className="flex-1 rounded-xl border border-white/15 bg-slate-800 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
                  >
                    Back to Room
                  </button>
                )}
                {onLeaveMatch && (
                  <button
                    type="button"
                    onClick={onLeaveMatch}
                    className="flex items-center justify-center gap-1 rounded-xl bg-rose-600/85 px-3 py-2 text-xs font-bold text-white hover:bg-rose-500"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Leave
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MOBILE PORTRAIT LANDSCAPE GUARD === */}
      {isMobile && isPortrait && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-6 text-center backdrop-blur">
          <Smartphone className="h-12 w-12 rotate-90 text-amber-400" />
          <h2 className="text-xl font-black text-white">Rotate to Landscape</h2>
          <p className="max-w-xs text-sm text-slate-300">
            Pocket War plays in landscape mode for full jungle visibility and
            dual-thumb combat controls.
          </p>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-black text-slate-950"
          >
            Enter Fullscreen Landscape
          </button>
        </div>
      )}
    </div>
  );
}
