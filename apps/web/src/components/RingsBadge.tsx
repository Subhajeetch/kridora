import { motion, useReducedMotion, type Transition } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface RingsBadgeProps {
  rings: number | undefined;
  className?: string;
}

const bumpSpring: Transition = { type: "spring", stiffness: 420, damping: 18 };

/** Shows the player's Rings balance. */
export function RingsBadge({ rings, className }: RingsBadgeProps) {
  const gradId = useId();
  const reduce = useReducedMotion();

  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-coin/40 bg-linear-to-b from-coin/15 to-coin/5 px-3 text-sm text-coin hidden",
        className,
      )}
      title="Rings"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4 shrink-0"
        style={{ filter: "drop-shadow(0 0 6px rgba(255,210,63,0.55))" }}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="0"
            y1="0"
            x2="0"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#ffe27a" />
            <stop offset="100%" stopColor="#ffd23f" />
          </linearGradient>
        </defs>
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke={`url(#${gradId})`}
          strokeWidth="3"
        />
        <path
          d="M8.5 6.8A6.5 6.5 0 0 1 14.5 6"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <motion.span
        key={rings ?? "empty"}
        initial={reduce ? false : { scale: 1.25 }}
        animate={{ scale: 1 }}
        transition={bumpSpring}
        className="inline-block font-display tabular-nums"
      >
        {rings === undefined ? "-" : rings.toLocaleString()}
      </motion.span>
      <span className="sr-only">Rings</span>
    </span>
  );
}
