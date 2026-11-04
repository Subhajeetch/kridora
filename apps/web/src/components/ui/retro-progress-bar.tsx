import { cn } from "@/lib/utils";

export interface RetroProgressBarProps {
  /** Numerical progress between 0 and 100 */
  progress: number;
  /** Optional status label displayed alongside the bar */
  statusMessage?: string;
  /** Whether to show numeric percentage readout (e.g. "84%") */
  showPercent?: boolean;
  /** Extra container styling */
  className?: string;
  /** Height of the progress well */
  heightClass?: string;
  /** Theme variation */
  variant?: "gold" | "cyan";
}

export function RetroProgressBar({
  progress,
  statusMessage,
  showPercent = false,
  className,
  heightClass = "h-2.5 sm:h-3",
  variant = "gold",
}: RetroProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const isComplete = clamped >= 100;

  const borderClass =
    variant === "cyan"
      ? "bg-neon-cyan/50 filter drop-shadow-[0_2px_0_#0284c7]"
      : "bg-[#facc15] filter drop-shadow-[0_2px_0_#78350f]";

  const fillGradient =
    variant === "cyan"
      ? "bg-gradient-to-r from-[#0284c7] via-[#22e4ff] to-[#a5f3fc]"
      : "bg-gradient-to-r from-[#b45309] via-[#facc15] to-[#fef08a]";

  const textColor = variant === "cyan" ? "text-neon-cyan" : "text-[#facc15]";

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      {(statusMessage !== undefined || showPercent) && (
        <div className="flex items-center justify-between gap-2 px-0.5 text-[10px] sm:text-xs font-retro uppercase tracking-wider">
          <span className="truncate text-amber-200/90 font-medium flex items-center gap-1.5">
            {statusMessage && (
              <>
                <span>{statusMessage}</span>
                {!isComplete && (
                  <span className="inline-block size-1 bg-amber-400 animate-ping" />
                )}
              </>
            )}
          </span>
          {showPercent && (
            <span
              className={cn(
                "tabular-nums font-bold shrink-0 ml-auto",
                textColor,
                isComplete && "drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]",
              )}
            >
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}

      {/* Retro Pixel Outer Frame */}
      <div className={cn("w-full pixel-corners-sm p-[1.5px]", borderClass)}>
        <div
          role="progressbar"
          aria-valuenow={Math.round(clamped)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn(
            "w-full pixel-corners-sm bg-[#0a0b10] relative overflow-hidden",
            heightClass,
          )}
        >
          {/* CRT Scanlines Overlay inside track */}
          <div className="pointer-events-none absolute inset-0 scanlines opacity-40 z-10" />

          {/* Retro Segmented Grid Lines Overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 7px, rgba(0,0,0,0.85) 7px, rgba(0,0,0,0.85) 8px)",
            }}
          />

          {/* Animated Fill Bar */}
          <div
            className={cn(
              "h-full relative transition-[width] duration-150 ease-out",
              fillGradient,
            )}
            style={{ width: `${clamped}%` }}
          >
            {/* Leading edge bright pixel cap */}
            {clamped > 0 && clamped < 100 && (
              <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_#ffffff]" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
