import { motion, useReducedMotion, type Transition } from "framer-motion"

interface PlayerHudProps {
  name: string
  level?: number | null | undefined
  xp?: number | null | undefined
  isGuest?: boolean
  isVerified?: boolean
}

const barSpring: Transition = { type: "spring", stiffness: 180, damping: 24 }

function getInitial(name: string): string {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return "P"

  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    const [first] = segmenter.segment(trimmed)
    const char = first?.segment || "P"
    const upper = char.toUpperCase()
    const [firstUpper] = segmenter.segment(upper)
    return firstUpper?.segment || "P"
  }

  const firstChar = Array.from(trimmed)[0] || "P"
  const upper = firstChar.toUpperCase()
  return Array.from(upper)[0] || "P"
}

function computeXpRatio(level: number, xp: number): number {
  const safeLevel = Math.max(1, level)
  const floor = 100 * (safeLevel - 1) ** 2
  const next = 100 * safeLevel ** 2
  const span = Math.max(1, next - floor)
  return Math.min(1, Math.max(0, (xp - floor) / span))
}

export function PlayerHud({ name, level, xp, isGuest, isVerified }: PlayerHudProps) {
  const reduce = useReducedMotion()
  const initial = getInitial(name)
  const showLevel = Boolean(isVerified && typeof level === "number" && typeof xp === "number")
  const ratio = showLevel && level !== null && level !== undefined && xp !== null && xp !== undefined
    ? computeXpRatio(level, xp)
    : null

  if (isGuest) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-panel/70 px-2 backdrop-blur">
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full bg-linear-to-br from-neon-violet to-neon-pink font-display text-[11px] leading-none uppercase text-white shadow-xs"
        >
          {initial}
        </span>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-24 truncate text-[13px] font-semibold leading-none mb-1 text-foreground sm:max-w-36">
            {name}
          </span>
          <span className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">
            GUEST
          </span>
        </div>
      </div>
    )
  }

  if (isVerified === false) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-panel/70 px-2 backdrop-blur">
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-lg bg-linear-to-br from-neon-violet to-neon-pink font-display text-xs uppercase text-white shadow-xs"
        >
          {initial}
        </span>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-24 truncate text-xs font-semibold leading-none text-foreground sm:max-w-36">
            {name}
          </span>
          <span className="hidden rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 sm:inline-flex">
            UNVERIFIED
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-panel/70 p-1.5 pr-3 backdrop-blur">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-xl bg-linear-to-br from-neon-violet to-neon-pink font-display text-xs uppercase text-white"
      >
        {initial}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="max-w-24 truncate text-xs font-semibold leading-none text-foreground sm:max-w-32">{name}</span>
        {showLevel && level ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="rounded-md bg-coin/10 px-1.5 text-[10px] font-semibold uppercase tabular-nums text-coin">
              LV {level}
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10" aria-label="XP progress">
              <motion.div
                className="h-full w-full origin-left rounded-full bg-linear-to-r from-neon-cyan to-neon-violet"
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: ratio ?? 0 }}
                transition={barSpring}
              />
            </div>
          </div>
        ) : (
          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="h-3.5 w-9 animate-pulse rounded-md bg-white/10" />
            <span className="h-1.5 w-16 animate-pulse rounded-full bg-white/10" />
          </div>
        )}
      </div>
    </div>
  )
}
