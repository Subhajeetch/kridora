import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useState } from "react";

interface PlayerHudProps {
  name: string;
  image?: string | null | undefined;
  level?: number | null | undefined;
  xp?: number | null | undefined;
  isGuest?: boolean;
  isVerified?: boolean;
  onClick?: () => void;
}

const barSpring: Transition = { type: "spring", stiffness: 180, damping: 24 };

function getInitial(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "P";

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    const [first] = segmenter.segment(trimmed);
    const char = first?.segment || "P";
    const upper = char.toUpperCase();
    const [firstUpper] = segmenter.segment(upper);
    return firstUpper?.segment || "P";
  }

  const firstChar = Array.from(trimmed)[0] || "P";
  const upper = firstChar.toUpperCase();
  return Array.from(upper)[0] || "P";
}

function computeXpRatio(level: number, xp: number): number {
  const safeLevel = Math.max(1, level);
  const floor = 100 * (safeLevel - 1) ** 2;
  const next = 100 * safeLevel ** 2;
  const span = Math.max(1, next - floor);
  return Math.min(1, Math.max(0, (xp - floor) / span));
}

export function PlayerHud({
  name,
  image,
  level,
  xp,
  isGuest,
  isVerified,
  onClick,
}: PlayerHudProps) {
  const reduce = useReducedMotion();
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(image && !imgError);
  const initial = getInitial(name);
  const showLevel = Boolean(
    isVerified && typeof level === "number" && typeof xp === "number",
  );
  const ratio =
    showLevel &&
    level !== null &&
    level !== undefined &&
    xp !== null &&
    xp !== undefined
      ? computeXpRatio(level, xp)
      : null;

  if (isGuest) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer text-left shrink-0"
        aria-label="View guest profile and user ID"
      >
        <div className="pixel-corners-sm bg-[#facc15] hover:bg-white group-hover:bg-white p-[2px] transition-colors">
          <div className="pixel-corners-sm bg-[#12131a] flex items-center h-8 sm:h-9 px-2 sm:px-2.5 gap-2">
            <span
              aria-hidden="true"
              className="grid size-5.5 sm:size-6 place-items-center pixel-corners-sm bg-linear-to-br from-amber-400 to-amber-600 font-display text-[10px] sm:text-[11px] leading-none uppercase text-black font-bold overflow-hidden shadow-xs"
            >
              {hasImage ? (
                <img
                  src={image!}
                  alt=""
                  onError={() => setImgError(true)}
                  className="size-full object-cover"
                />
              ) : (
                initial
              )}
            </span>

            <div className="flex min-w-0 items-center gap-1.5">
              <span className="max-w-20 truncate text-xs font-semibold text-white sm:max-w-32">
                {name}
              </span>
              <span className="hidden pixel-corners-sm border border-amber-400/50 bg-amber-400/20 px-1.5 py-0.5 text-[8px] font-retro font-bold uppercase tracking-wider text-amber-300 sm:inline-flex">
                GUEST
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  if (isVerified === false) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer text-left shrink-0"
        aria-label="View profile and user ID"
      >
        <div className="pixel-corners-sm bg-[#facc15] hover:bg-white group-hover:bg-white p-[2px] transition-colors">
          <div className="pixel-corners-sm bg-[#12131a] flex items-center h-8 sm:h-9 px-2 sm:px-2.5 gap-2">
            <span
              aria-hidden="true"
              className="grid size-5.5 sm:size-6 shrink-0 place-items-center pixel-corners-sm bg-linear-to-br from-amber-400 to-amber-600 font-display text-[10px] sm:text-[11px] leading-none uppercase text-black font-bold overflow-hidden shadow-xs"
            >
              {hasImage ? (
                <img
                  src={image!}
                  alt=""
                  onError={() => setImgError(true)}
                  className="size-full object-cover"
                />
              ) : (
                initial
              )}
            </span>

            <div className="flex min-w-0 items-center gap-1.5">
              <span className="max-w-20 truncate text-xs font-semibold text-white sm:max-w-32">
                {name}
              </span>
              <span className="hidden pixel-corners-sm border border-amber-400/50 bg-amber-400/20 px-1.5 py-0.5 text-[8px] font-retro font-bold uppercase tracking-wider text-amber-300 sm:inline-flex">
                UNVERIFIED
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer text-left shrink-0"
      aria-label="View profile and user ID"
    >
      <div className="pixel-corners-sm bg-[#facc15] hover:bg-white group-hover:bg-white p-[2px] transition-colors">
        <div className="pixel-corners-sm bg-[#12131a] flex items-center h-8 sm:h-9 px-2 sm:px-2.5 gap-2">
          <span
            aria-hidden="true"
            className="grid size-5.5 sm:size-6 shrink-0 place-items-center pixel-corners-sm bg-linear-to-br from-amber-400 to-amber-600 font-display text-[10px] sm:text-[11px] leading-none uppercase text-black font-bold overflow-hidden shadow-xs"
          >
            {hasImage ? (
              <img
                src={image!}
                alt=""
                onError={() => setImgError(true)}
                className="size-full object-cover"
              />
            ) : (
              initial
            )}
          </span>

          <div className="flex min-w-0 items-center gap-1.5">
            <span className="max-w-20 truncate text-xs font-semibold text-white sm:max-w-28">
              {name}
            </span>
            {showLevel && level ? (
              <div className="hidden items-center gap-1 sm:flex">
                <span className="pixel-corners-sm bg-coin/20 px-1.5 py-0.5 text-[8px] font-retro font-bold uppercase tabular-nums text-coin">
                  LV {level}
                </span>
                <div
                  className="h-1.5 w-12 overflow-hidden pixel-corners-sm bg-white/10"
                  aria-label="XP progress"
                >
                  <motion.div
                    className="h-full w-full origin-left bg-linear-to-r from-neon-cyan to-neon-violet"
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: ratio ?? 0 }}
                    transition={barSpring}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
