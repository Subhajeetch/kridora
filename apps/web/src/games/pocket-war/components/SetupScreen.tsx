import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Crown,
  Flame,
  Heart,
  Info,
  Map as MapIcon,
  Play,
  Swords,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  CHARACTER_CATALOG,
  CHARACTER_IDS,
  MAP_CATALOG,
  MAP_IDS,
  POCKET_WAR_LIMITS,
} from "@kridora/shared/games/pocket-war";
import { pocketWarAssets } from "../assets/AssetLoader";
import { drawCharacterShowcase } from "../engine/render/CharacterRigRenderer";
import type { SoundFX } from "../engine/SoundFX";
import type {
  CharacterAbilityInfo,
  PocketWarCharacterId,
  PocketWarMapId,
  PocketWarState,
} from "../types";

interface SetupScreenProps {
  state: PocketWarState;
  currentUserId: string;
  isHost: boolean;
  roomCode: string;
  soundFx: SoundFX;
  muted: boolean;
  onToggleMute: () => void;
  onSelectCharacter: (characterId: PocketWarCharacterId) => void;
  onToggleReady: (isReady: boolean) => void;
  onSelectMap: (mapId: PocketWarMapId) => void;
  onForceStart: () => void;
  onRefreshState: () => void;
  onBackToRoom?: () => void;
}

function AbilityFallbackGlyph({ abilityId }: { abilityId: string }) {
  if (abilityId.includes("grenade")) {
    return <Flame className="h-6 w-6 text-amber-300" />;
  }
  if (abilityId.includes("jetpack")) {
    return <Zap className="h-6 w-6 text-sky-300" />;
  }
  if (abilityId.includes("melee")) {
    return <Swords className="h-6 w-6 text-emerald-300" />;
  }
  return <Crosshair className="h-6 w-6 text-slate-100" />;
}

function AbilityTileIcon({ ability }: { ability: CharacterAbilityInfo }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <AbilityFallbackGlyph abilityId={ability.id} />;
  }

  return (
    <img
      src={ability.iconPath}
      alt={ability.name}
      onError={() => setFailed(true)}
      className="h-8 w-8 object-contain drop-shadow sm:h-10 sm:w-10"
      draggable={false}
    />
  );
}

function StatRow({
  icon,
  label,
  value,
  barColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  barColor: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between text-[10px] font-black tracking-wider text-slate-200 uppercase">
          <span>{label}</span>
          <span className="font-mono text-slate-300">{value}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-900/90 p-[1px] ring-1 ring-white/15">
          <div
            className="h-full rounded-[2px] transition-all duration-300"
            style={{
              width: `${Math.max(8, Math.min(100, value))}%`,
              backgroundColor: barColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function SetupScreen({
  state,
  currentUserId,
  isHost,
  roomCode,
  soundFx,
  muted,
  onToggleMute,
  onSelectCharacter,
  onToggleReady,
  onSelectMap,
  onForceStart,
  onRefreshState,
  onBackToRoom,
}: SetupScreenProps) {
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const countdownPingedRef = useRef<number | null>(null);

  const [inspectedAbilityId, setInspectedAbilityId] = useState<string | null>(
    null,
  );
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const playersList = useMemo(
    () => Object.values(state.players),
    [state.players],
  );
  const currentPlayer = state.players[currentUserId];
  const selectedCharId: PocketWarCharacterId =
    currentPlayer?.characterId ?? "rex";
  const selectedChar = CHARACTER_CATALOG[selectedCharId];
  const selectedMap = MAP_CATALOG[state.settings.mapId];

  const selectedIndex = Math.max(0, CHARACTER_IDS.indexOf(selectedCharId));
  const prevCharId: PocketWarCharacterId =
    CHARACTER_IDS[
      (selectedIndex - 1 + CHARACTER_IDS.length) % CHARACTER_IDS.length
    ] ?? "rex";
  const nextCharId: PocketWarCharacterId =
    CHARACTER_IDS[(selectedIndex + 1) % CHARACTER_IDS.length] ?? "nova";

  // Preload map & icon assets quietly while players pick their character
  useEffect(() => {
    pocketWarAssets.preloadAll(selectedMap);
  }, [selectedMap]);

  // Countdown ticker & authoritative transition ping when all players confirm
  useEffect(() => {
    const endsAt = state.setupCountdownEndsAt;
    if (endsAt === null) {
      countdownPingedRef.current = null;
      return;
    }

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= endsAt && countdownPingedRef.current !== endsAt) {
        countdownPingedRef.current = endsAt;
        onRefreshState();
      }
    }, 150);

    return () => window.clearInterval(timer);
  }, [state.setupCountdownEndsAt, onRefreshState]);

  // Animated 60 FPS hero stage canvas (center hero + dimmed side previews)
  useEffect(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;

    const render = (now: number) => {
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
        ctx.clearRect(0, 0, w, h);

        const timeSec = now / 1000;
        const baseScale = Math.max(1.9, Math.min(3.5, h / 112));
        const centerX = w * 0.5;
        const centerY = h * 0.57;

        // Soft spotlight halo behind center hero
        const spot = ctx.createRadialGradient(
          centerX,
          centerY - 12,
          12,
          centerX,
          centerY - 12,
          Math.min(w, h) * 0.44,
        );
        spot.addColorStop(0, "rgba(125, 211, 252, 0.28)");
        spot.addColorStop(0.55, "rgba(56, 189, 248, 0.08)");
        spot.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, w, h);

        // Floor stage arc
        ctx.fillStyle = "rgba(15, 23, 42, 0.35)";
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY + 28 * baseScale,
          Math.min(w * 0.42, 260),
          22,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const sideOffset = Math.min(w * 0.31, 270);
        const showLeftSide = CHARACTER_IDS.length > 2 || selectedIndex === 1;
        const showRightSide = CHARACTER_IDS.length > 2 || selectedIndex === 0;

        if (showLeftSide && w > 420) {
          drawCharacterShowcase(ctx, centerX - sideOffset, centerY + 12, {
            characterId: prevCharId,
            aimAngle: -0.05,
            timeSec: timeSec + 1.2,
            scale: baseScale * 0.68,
            dimmed: true,
          });
        }

        if (showRightSide && w > 420) {
          drawCharacterShowcase(ctx, centerX + sideOffset, centerY + 12, {
            characterId: nextCharId,
            aimAngle: Math.PI + 0.05,
            timeSec: timeSec + 2.4,
            scale: baseScale * 0.68,
            dimmed: true,
          });
        }

        // Active center hero
        drawCharacterShowcase(ctx, centerX, centerY, {
          characterId: selectedCharId,
          aimAngle: -0.08 + Math.sin(timeSec * 1.4) * 0.04,
          timeSec,
          scale: baseScale,
          dimmed: false,
          isBoosting: Boolean(currentPlayer?.isReady),
        });
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    currentPlayer?.isReady,
    nextCharId,
    prevCharId,
    selectedCharId,
    selectedIndex,
  ]);

  const handleCycleCharacter = (dir: -1 | 1) => {
    soundFx.unlock();
    soundFx.playUiSwitch();
    const nextIdx =
      (selectedIndex + dir + CHARACTER_IDS.length) % CHARACTER_IDS.length;
    const nextId = CHARACTER_IDS[nextIdx] ?? "rex";
    setInspectedAbilityId(null);
    onSelectCharacter(nextId);
  };

  const handleConfirmToggle = () => {
    if (!currentPlayer) return;
    soundFx.unlock();
    if (currentPlayer.isReady) {
      soundFx.playUiClick();
    } else {
      soundFx.playUiConfirm();
    }
    onToggleReady(!currentPlayer.isReady);
  };

  const inspectedAbility =
    selectedChar.abilities.find((a) => a.id === inspectedAbilityId) ?? null;

  const readyCount = playersList.filter((p) => p.isReady).length;
  const needsMorePlayers = playersList.length < POCKET_WAR_LIMITS.MIN_PLAYERS;
  const countdownSeconds =
    state.setupCountdownEndsAt !== null
      ? Math.max(0, Math.ceil((state.setupCountdownEndsAt - nowMs) / 1000))
      : null;

  return (
    <div
      className="relative flex h-dvh w-screen flex-col overflow-hidden bg-gradient-to-b from-[#162033] via-[#1f2d47] to-[#111927] text-white select-none"
      onPointerDown={() => soundFx.unlock()}
    >
      {/* Subtle radial top glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(56,189,248,0.16),transparent_65%)]" />

      {/* === TOP BAR: Back Button + Player Roster Chips + Audio Toggle (Image 3 top) === */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5 sm:px-5 sm:pt-3.5">
        <div className="flex items-center gap-2">
          {onBackToRoom && (
            <button
              type="button"
              onClick={() => {
                soundFx.unlock();
                soundFx.playUiClick();
                onBackToRoom();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-900/75 text-white shadow transition hover:bg-slate-800 active:scale-95 sm:h-10 sm:w-10"
              aria-label="Back to room"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold tracking-widest text-sky-300 uppercase">
              Pocket War • Room {roomCode}
            </div>
            <div className="text-xs font-semibold text-slate-300">
              {needsMorePlayers
                ? `Waiting for ${POCKET_WAR_LIMITS.MIN_PLAYERS}+ players`
                : countdownSeconds !== null
                  ? `Launching in ${countdownSeconds}s...`
                  : `${readyCount}/${playersList.length} Confirmed`}
            </div>
          </div>
        </div>

        {/* Center Player Avatar Strip */}
        <div className="flex max-w-[68vw] items-center gap-2 overflow-x-auto px-1 py-0.5 sm:gap-3">
          {playersList.map((p) => {
            const c = CHARACTER_CATALOG[p.characterId];
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.userId}
                className="flex shrink-0 flex-col items-center gap-0.5"
              >
                <div
                  className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black shadow-md transition sm:h-11 sm:w-11 ${
                    p.isReady
                      ? "border-emerald-400 bg-emerald-950/80 text-emerald-100"
                      : isMe
                        ? "border-sky-400 bg-sky-950/80 text-white"
                        : "border-white/20 bg-slate-900/80 text-slate-200"
                  }`}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white sm:h-7 sm:w-7"
                    style={{ backgroundColor: c.palette.sashColor }}
                  >
                    {p.username.slice(0, 2).toUpperCase()}
                  </span>
                  {p.isReady && (
                    <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                    isMe
                      ? "bg-sky-500 text-white shadow"
                      : p.isReady
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-900/60 text-slate-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.isReady ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <span className="max-w-20 truncate">
                    {isMe ? "You" : p.username}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-1.5">
          {isHost && !needsMorePlayers && readyCount >= 1 && countdownSeconds === null && (
            <button
              type="button"
              onClick={() => {
                soundFx.unlock();
                soundFx.playUiConfirm();
                onForceStart();
              }}
              className="flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-black text-amber-300 transition hover:bg-amber-500/30 active:scale-95"
              title="Force start match now"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">Force Start</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundFx.unlock();
              onToggleMute();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-900/75 text-white shadow transition hover:bg-slate-800 sm:h-10 sm:w-10"
            aria-label="Toggle audio"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-sky-300" />
            )}
          </button>
        </div>
      </header>

      {/* === CENTER HERO STAGE (Image 3 center + top-right stats) === */}
      <main className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {/* Character Name & Role Header */}
        <div className="pointer-events-none absolute top-1 left-1/2 z-10 -translate-x-1/2 text-center sm:top-2">
          <h1 className="text-2xl font-black tracking-widest text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)] sm:text-4xl">
            {selectedChar.name}
          </h1>
          <p className="text-[11px] font-bold tracking-wider text-sky-300 uppercase sm:text-xs">
            {selectedChar.role}
          </p>
        </div>

        {/* Top-Right Character Stat Bars (HP / MOBILITY / JETPACK / ACCURACY) */}
        <aside className="absolute top-1 right-3 z-20 w-36 space-y-1.5 rounded-xl border border-white/10 bg-slate-950/55 p-2.5 backdrop-blur-md sm:top-4 sm:right-6 sm:w-52 sm:space-y-2 sm:p-3">
          <StatRow
            icon={<Heart className="h-3.5 w-3.5 text-rose-400" />}
            label="HP"
            value={selectedChar.stats.hp}
            barColor="#F43F5E"
          />
          <StatRow
            icon={<Wind className="h-3.5 w-3.5 text-emerald-400" />}
            label="MOBILITY"
            value={selectedChar.stats.mobility}
            barColor="#34D399"
          />
          <StatRow
            icon={<Zap className="h-3.5 w-3.5 text-sky-400" />}
            label="JETPACK"
            value={selectedChar.stats.jetpack}
            barColor="#38BDF8"
          />
          <StatRow
            icon={<Crosshair className="h-3.5 w-3.5 text-amber-300" />}
            label="ACCURACY"
            value={selectedChar.stats.accuracy}
            barColor="#FBBF24"
          />
        </aside>

        {/* Live Animated Hero Showcase Canvas */}
        <div className="relative h-full w-full max-w-4xl">
          <canvas
            ref={stageCanvasRef}
            className="block h-full w-full"
          />

          {/* Left / Right Character Carousel Arrows */}
          <button
            type="button"
            onClick={() => handleCycleCharacter(-1)}
            className="absolute top-1/2 left-2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:scale-110 hover:bg-slate-900/80 active:scale-95 sm:left-16 sm:h-14 sm:w-14"
            aria-label="Previous character"
          >
            <ChevronLeft className="h-8 w-8 sm:h-9 sm:w-9" />
          </button>

          <button
            type="button"
            onClick={() => handleCycleCharacter(1)}
            className="absolute top-1/2 right-2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:scale-110 hover:bg-slate-900/80 active:scale-95 sm:right-16 sm:h-14 sm:w-14"
            aria-label="Next character"
          >
            <ChevronRight className="h-8 w-8 sm:h-9 sm:w-9" />
          </button>
        </div>

        {/* Ability Info Popover (opens when clicking an ability tile or its "i" badge) */}
        {inspectedAbility && (
          <div className="absolute bottom-3 left-1/2 z-30 w-80 max-w-[92vw] -translate-x-1/2 rounded-2xl border border-sky-400/40 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">
                  {inspectedAbility.name}
                </span>
                <span className="rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-black text-sky-300">
                  {inspectedAbility.badge}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedAbilityId(null)}
                className="rounded-md p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close ability details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {inspectedAbility.description}
            </p>
          </div>
        )}
      </main>

      {/* === BOTTOM DOCK: Host Map Card (left) + Ability Icons (center) + CONFIRM (right) === */}
      <footer className="relative z-20 border-t border-white/10 bg-[#1c2331]/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur sm:px-5 sm:py-3">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2.5 sm:gap-4">
          {/* Bottom-Left: Map Card (Shown ONLY to Room Owner per specification) */}
          <div className="flex items-center">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.unlock();
                  soundFx.playUiClick();
                  setMapModalOpen(true);
                }}
                className="group relative h-14 w-32 overflow-hidden rounded-xl border-2 border-white/75 bg-gradient-to-br from-sky-400 via-emerald-600 to-teal-900 shadow-lg transition hover:scale-[1.03] hover:border-amber-300 active:scale-95 sm:h-16 sm:w-44"
                title="Change Arena Map (Room Owner)"
              >
                {!thumbFailed ? (
                  <img
                    src={selectedMap.assets.thumbnail}
                    alt={selectedMap.name}
                    onError={() => setThumbFailed(true)}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-emerald-950 via-teal-700 to-sky-400">
                    <MapIcon className="h-6 w-6 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                <span className="absolute top-1 left-1.5 flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-slate-950 uppercase">
                  <Crown className="h-2.5 w-2.5" />
                  MAP
                </span>
                <span className="absolute inset-x-1 bottom-1 truncate text-center text-[11px] font-black tracking-wide text-white drop-shadow sm:text-xs">
                  {selectedMap.name}
                </span>
              </button>
            ) : (
              <div className="hidden w-32 flex-col justify-center rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 sm:flex sm:w-44">
                <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                  Arena
                </span>
                <span className="truncate text-xs font-black text-emerald-300">
                  {selectedMap.name}
                </span>
              </div>
            )}
          </div>

          {/* Bottom-Center: Character Abilities & Weapons with "i" Info Badges */}
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-0.5 sm:gap-2.5">
            {selectedChar.abilities.map((ability) => {
              const isOpen = inspectedAbilityId === ability.id;
              return (
                <button
                  key={ability.id}
                  type="button"
                  onClick={() => {
                    soundFx.unlock();
                    soundFx.playUiClick();
                    setInspectedAbilityId((prev) =>
                      prev === ability.id ? null : ability.id,
                    );
                  }}
                  className={`relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition sm:h-16 sm:w-16 ${
                    isOpen
                      ? "border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/20"
                      : "border-white/15 bg-slate-900/80 hover:border-white/35 hover:bg-slate-800/90"
                  }`}
                  title={`${ability.name}: ${ability.description}`}
                >
                  <AbilityTileIcon ability={ability} />
                  <span className="mt-0.5 max-w-full truncate px-1 text-[8px] font-black tracking-tight text-slate-200 sm:text-[9px]">
                    {ability.badge}
                  </span>
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white shadow ring-2 ring-[#1c2331]">
                    <Info className="h-2.5 w-2.5 stroke-[2.6]" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom-Right: Big Blue CONFIRM Button (Image 3 signature) */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleConfirmToggle}
              className={`flex h-14 min-w-28 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black tracking-wider uppercase shadow-lg transition active:scale-95 sm:h-16 sm:min-w-44 sm:px-7 sm:text-base ${
                currentPlayer?.isReady
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400"
                  : "bg-[#1a95e8] text-white shadow-sky-500/30 hover:bg-[#2aa5f8]"
              }`}
            >
              {countdownSeconds !== null ? (
                <span>START ({countdownSeconds})</span>
              ) : currentPlayer?.isReady ? (
                <>
                  <Check className="h-5 w-5 stroke-[3]" />
                  <span>READY</span>
                </>
              ) : (
                <span>CONFIRM</span>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* === OWNER-ONLY MAP SELECTION MODAL === */}
      {mapModalOpen && isHost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={() => setMapModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black tracking-wider text-white uppercase">
                  Select Arena Map
                </h2>
                <p className="text-xs text-slate-400">
                  Room owner controls the battlefield.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close map selector"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {MAP_IDS.map((mapId) => {
                const m = MAP_CATALOG[mapId];
                const isSelected = state.settings.mapId === mapId;
                return (
                  <button
                    key={mapId}
                    type="button"
                    onClick={() => {
                      soundFx.playUiConfirm();
                      onSelectMap(mapId);
                      setMapModalOpen(false);
                    }}
                    className={`overflow-hidden rounded-xl border-2 text-left transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-500/15"
                        : "border-white/15 bg-slate-950/70 hover:border-white/35"
                    }`}
                  >
                    <div className="relative h-24 w-full bg-gradient-to-tr from-emerald-950 via-teal-700 to-sky-400">
                      {!thumbFailed && (
                        <img
                          src={m.assets.thumbnail}
                          alt={m.name}
                          onError={() => setThumbFailed(true)}
                          className="h-full w-full object-cover"
                        />
                      )}
                      {isSelected && (
                        <span className="absolute top-2 right-2 rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-black text-slate-950 uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="text-sm font-black text-white">
                        {m.name}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-300">
                        {m.tagline}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Future-extensible slot preview */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-center">
                <MapIcon className="mb-1.5 h-6 w-6 text-slate-600" />
                <div className="text-xs font-bold text-slate-400">
                  More Arenas Coming Soon
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Built with modular map registry support.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
