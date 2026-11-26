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
  Maximize2,
  Minimize2,
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
  type CharacterAbilityInfo,
  type PocketWarCharacterId,
  type PocketWarMapId,
  type PocketWarState,
} from "../types";
import { pocketWarAssets } from "../assets/AssetLoader";
import { drawCharacterShowcase } from "../engine/render/CharacterRigRenderer";
import type { SoundFX } from "../engine/SoundFX";

export interface SetupScreenProps {
  state: PocketWarState;
  currentUserId: string;
  isHost: boolean;
  roomCode: string;
  soundFx: SoundFX;
  muted: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSelectCharacter: (characterId: PocketWarCharacterId) => void;
  onToggleReady: (isReady: boolean) => void;
  onSelectMap: (mapId: PocketWarMapId) => void;
  onForceStart: () => void;
  onRefreshState: () => void;
  onBackToRoom?: () => void;
}

function AbilityFallbackGlyph({ abilityId }: { abilityId: string }) {
  if (abilityId.includes("grenade")) {
    return <Flame className="h-5 w-5 text-amber-300 sm:h-6 sm:w-6" />;
  }
  if (abilityId.includes("jetpack")) {
    return <Zap className="h-5 w-5 text-sky-300 sm:h-6 sm:w-6" />;
  }
  if (abilityId.includes("melee")) {
    return <Swords className="h-5 w-5 text-emerald-300 sm:h-6 sm:w-6" />;
  }
  return <Crosshair className="h-5 w-5 text-slate-100 sm:h-6 sm:w-6" />;
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
      className="h-6 w-6 object-contain drop-shadow sm:h-9 sm:w-9"
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
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-white sm:h-6 sm:w-6">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between text-[9px] font-black tracking-wider text-slate-200 uppercase sm:text-[10px]">
          <span>{label}</span>
          <span className="font-mono text-slate-300">{value}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-900/90 p-[1px] ring-1 ring-white/15 sm:h-2.5">
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
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
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

  // Preload map layers, collision.json, and icons while players pick their character
  useEffect(() => {
    pocketWarAssets.preloadAll(selectedMap);
  }, [selectedMap]);

  // Countdown ticker & state refresh when all players confirm
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

  // Animated 60 FPS hero stage canvas
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
        const w = Math.max(1, parent.clientWidth);
        const h = Math.max(1, parent.clientHeight);
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
        const baseScale = Math.max(1.55, Math.min(3.4, h / 110));
        const centerX = w * 0.5;
        const centerY = h * 0.58;

        const spot = ctx.createRadialGradient(
          centerX,
          centerY - 10,
          10,
          centerX,
          centerY - 10,
          Math.min(w, h) * 0.44,
        );
        spot.addColorStop(0, "rgba(125, 211, 252, 0.28)");
        spot.addColorStop(0.55, "rgba(56, 189, 248, 0.08)");
        spot.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(15, 23, 42, 0.36)";
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY + 26 * baseScale,
          Math.min(w * 0.38, 240),
          18,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const sideOffset = Math.min(w * 0.3, 260);
        const showLeftSide = CHARACTER_IDS.length > 2 || selectedIndex === 1;
        const showRightSide = CHARACTER_IDS.length > 2 || selectedIndex === 0;

        if (showLeftSide && w > 420) {
          drawCharacterShowcase(ctx, centerX - sideOffset, centerY + 10, {
            characterId: prevCharId,
            aimAngle: -0.05,
            timeSec: timeSec + 1.2,
            scale: baseScale * 0.68,
            dimmed: true,
          });
        }

        if (showRightSide && w > 420) {
          drawCharacterShowcase(ctx, centerX + sideOffset, centerY + 10, {
            characterId: nextCharId,
            aimAngle: Math.PI + 0.05,
            timeSec: timeSec + 2.4,
            scale: baseScale * 0.68,
            dimmed: true,
          });
        }

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
      className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-[#162033] via-[#1f2d47] to-[#111927] text-white select-none"
      onPointerDown={() => soundFx.unlock()}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(56,189,248,0.16),transparent_65%)]" />

      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 pt-2 pb-1 sm:px-5 sm:pt-3">
        <div className="flex items-center gap-2">
          {onBackToRoom && (
            <button
              type="button"
              onClick={() => {
                soundFx.unlock();
                soundFx.playUiClick();
                onBackToRoom();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/75 text-white shadow transition hover:bg-slate-800 active:scale-95 sm:h-10 sm:w-10"
              aria-label="Back to room"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          <div className="hidden md:block">
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
        <div className="flex max-w-[64vw] items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:gap-2.5">
          {playersList.map((p) => {
            const c = CHARACTER_CATALOG[p.characterId];
            const isMe = p.userId === currentUserId;
            return (
              <div
                key={p.userId}
                className="flex shrink-0 flex-col items-center gap-0.5"
              >
                <div
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-black shadow-md transition sm:h-10 sm:w-10 ${
                    p.isReady
                      ? "border-emerald-400 bg-emerald-950/80 text-emerald-100"
                      : isMe
                        ? "border-sky-400 bg-sky-950/80 text-white"
                        : "border-white/20 bg-slate-900/80 text-slate-200"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white sm:h-6 sm:w-6"
                    style={{ backgroundColor: c.palette.sashColor }}
                  >
                    {p.username.slice(0, 2).toUpperCase()}
                  </span>
                  {p.isReady && (
                    <span className="absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow">
                      <Check className="h-2 w-2 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap sm:text-[10px] ${
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
                  <span className="max-w-16 truncate">
                    {isMe ? "You" : p.username}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-1.5">
          {isHost &&
            !needsMorePlayers &&
            readyCount >= 1 &&
            countdownSeconds === null && (
              <button
                type="button"
                onClick={() => {
                  soundFx.unlock();
                  soundFx.playUiConfirm();
                  onForceStart();
                }}
                className="flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[10px] font-black text-amber-300 transition hover:bg-amber-500/30 active:scale-95 sm:py-1.5 sm:text-[11px]"
                title="Force start match now"
              >
                <Play className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Force Start</span>
              </button>
            )}

          <button
            type="button"
            onClick={() => {
              soundFx.unlock();
              onToggleMute();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/75 text-white shadow transition hover:bg-slate-800 sm:h-9 sm:w-9"
            aria-label="Toggle audio"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-sky-300" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.unlock();
              onToggleFullscreen();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-slate-900/75 text-white shadow transition hover:bg-slate-800 sm:h-9 sm:w-9"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-slate-200" />
            ) : (
              <Maximize2 className="h-4 w-4 text-slate-200" />
            )}
          </button>
        </div>
      </header>

      {/* Center Hero Stage */}
      <main className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        <div className="pointer-events-none absolute top-0.5 left-1/2 z-10 -translate-x-1/2 text-center sm:top-2">
          <h1 className="text-xl font-black tracking-widest text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.65)] sm:text-4xl">
            {selectedChar.name}
          </h1>
          <p className="text-[10px] font-bold tracking-wider text-sky-300 uppercase sm:text-xs">
            {selectedChar.role}
          </p>
        </div>

        {/* Top-Right Stat Bars */}
        <aside className="absolute top-0.5 right-2 z-20 w-32 space-y-1 rounded-xl border border-white/10 bg-slate-950/55 p-2 backdrop-blur-md sm:top-3 sm:right-6 sm:w-52 sm:space-y-2 sm:p-3">
          <StatRow
            icon={<Heart className="h-3 w-3 text-rose-400 sm:h-3.5 sm:w-3.5" />}
            label="HP"
            value={selectedChar.stats.hp}
            barColor="#F43F5E"
          />
          <StatRow
            icon={
              <Wind className="h-3 w-3 text-emerald-400 sm:h-3.5 sm:w-3.5" />
            }
            label="MOBILITY"
            value={selectedChar.stats.mobility}
            barColor="#34D399"
          />
          <StatRow
            icon={<Zap className="h-3 w-3 text-sky-400 sm:h-3.5 sm:w-3.5" />}
            label="JETPACK"
            value={selectedChar.stats.jetpack}
            barColor="#38BDF8"
          />
          <StatRow
            icon={
              <Crosshair className="h-3 w-3 text-amber-300 sm:h-3.5 sm:w-3.5" />
            }
            label="ACCURACY"
            value={selectedChar.stats.accuracy}
            barColor="#FBBF24"
          />
        </aside>

        {/* Live Animated Showcase Canvas */}
        <div className="relative h-full w-full max-w-4xl">
          <canvas ref={stageCanvasRef} className="block h-full w-full" />

          <button
            type="button"
            onClick={() => handleCycleCharacter(-1)}
            className="absolute top-1/2 left-2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:scale-110 hover:bg-slate-900/80 active:scale-95 sm:left-16 sm:h-14 sm:w-14"
            aria-label="Previous character"
          >
            <ChevronLeft className="h-7 w-7 sm:h-9 sm:w-9" />
          </button>

          <button
            type="button"
            onClick={() => handleCycleCharacter(1)}
            className="absolute top-1/2 right-2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/45 text-white ring-1 ring-white/20 backdrop-blur transition hover:scale-110 hover:bg-slate-900/80 active:scale-95 sm:right-16 sm:h-14 sm:w-14"
            aria-label="Next character"
          >
            <ChevronRight className="h-7 w-7 sm:h-9 sm:w-9" />
          </button>
        </div>

        {/* Ability Info Popover */}
        {inspectedAbility && (
          <div className="absolute bottom-2 left-1/2 z-30 w-80 max-w-[92vw] -translate-x-1/2 rounded-2xl border border-sky-400/40 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white sm:text-sm">
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
            <p className="text-[11px] leading-relaxed text-slate-300 sm:text-xs">
              {inspectedAbility.description}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Dock */}
      <footer className="relative z-20 border-t border-white/10 bg-[#1c2331]/95 px-2.5 py-2 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] backdrop-blur sm:px-5 sm:py-3">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4">
          {/* Host Map Card */}
          <div className="flex items-center">
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  soundFx.unlock();
                  soundFx.playUiClick();
                  setMapModalOpen(true);
                }}
                className="group relative h-12 w-28 overflow-hidden rounded-xl border-2 border-white/75 bg-gradient-to-br from-sky-400 via-emerald-600 to-teal-900 shadow-lg transition hover:scale-[1.03] hover:border-amber-300 active:scale-95 sm:h-16 sm:w-44"
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
                    <MapIcon className="h-5 w-5 text-white/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
                <span className="absolute top-1 left-1 flex items-center gap-1 rounded bg-amber-400 px-1 py-0.5 text-[7px] font-black text-slate-950 uppercase sm:text-[8px]">
                  <Crown className="h-2.5 w-2.5" />
                  MAP
                </span>
                <span className="absolute inset-x-1 bottom-0.5 truncate text-center text-[10px] font-black tracking-wide text-white drop-shadow sm:bottom-1 sm:text-xs">
                  {selectedMap.name}
                </span>
              </button>
            ) : (
              <div className="flex w-28 flex-col justify-center rounded-xl border border-white/10 bg-slate-900/60 px-2.5 py-1.5 sm:w-44 sm:px-3 sm:py-2">
                <span className="text-[8px] font-bold tracking-wider text-slate-400 uppercase sm:text-[9px]">
                  Arena
                </span>
                <span className="truncate text-[10px] font-black text-emerald-300 sm:text-xs">
                  {selectedMap.name}
                </span>
              </div>
            )}
          </div>

          {/* Ability Icons */}
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
                  className={`relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border transition sm:h-16 sm:w-16 ${
                    isOpen
                      ? "border-sky-400 bg-sky-500/20 shadow-lg shadow-sky-500/20"
                      : "border-white/15 bg-slate-900/80 hover:border-white/35 hover:bg-slate-800/90"
                  }`}
                  title={`${ability.name}: ${ability.description}`}
                >
                  <AbilityTileIcon ability={ability} />
                  <span className="mt-0.5 max-w-full truncate px-0.5 text-[7px] font-black tracking-tight text-slate-200 sm:px-1 sm:text-[9px]">
                    {ability.badge}
                  </span>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-white shadow ring-2 ring-[#1c2331] sm:h-4 sm:w-4">
                    <Info className="h-2 w-2 stroke-[2.6] sm:h-2.5 sm:w-2.5" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Confirm Button */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleConfirmToggle}
              className={`flex h-12 min-w-24 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-black tracking-wider uppercase shadow-lg transition active:scale-95 sm:h-16 sm:min-w-44 sm:px-7 sm:text-base ${
                currentPlayer?.isReady
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400"
                  : "bg-[#1a95e8] text-white shadow-sky-500/30 hover:bg-[#2aa5f8]"
              }`}
            >
              {countdownSeconds !== null ? (
                <span>START ({countdownSeconds})</span>
              ) : currentPlayer?.isReady ? (
                <>
                  <Check className="h-4 w-4 stroke-[3] sm:h-5 sm:w-5" />
                  <span>READY</span>
                </>
              ) : (
                <span>CONFIRM</span>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Owner-Only Map Selection Modal */}
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
