import { cn } from "@/lib/utils"

/** Shows the player's Rings balance. */
export function RingsBadge({ rings, className }: { rings: number | undefined; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-4xl border border-amber-400/30 bg-amber-400/10 px-3 text-sm font-medium text-amber-300",
        className,
      )}
      title="Rings"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="3" />
      </svg>
      <span className="tabular-nums">{rings === undefined ? "-" : rings.toLocaleString()}</span>
      <span className="sr-only">Rings</span>
    </span>
  )
}
