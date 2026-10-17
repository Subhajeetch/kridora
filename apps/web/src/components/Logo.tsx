import { cn } from "@/lib/utils"

/** Two interlocked rings: the brand mark (and a nod to the Rings currency). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 28" className={cn("h-7 w-10", className)} fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="10" stroke="#fbbf24" strokeWidth="3.5" />
      <circle cx="26" cy="14" r="10" stroke="#a78bfa" strokeWidth="3.5" />
      {/* re-draw a small arc of the amber ring on top to make them look interlocked */}
      <path d="M20 5.2a10 10 0 0 1 0 17.6" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-xl font-bold tracking-tight">Kridora</span>
    </span>
  )
}
