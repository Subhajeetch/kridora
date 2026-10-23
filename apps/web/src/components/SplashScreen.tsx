import { motion, useReducedMotion, type Transition } from "framer-motion"
import { Background } from "@/components/Background"
import { LogoMark } from "@/components/Logo"

const popSpring: Transition = { type: "spring", stiffness: 320, damping: 22 }

/** Shown while we find out whether the visitor already has a session. */
export function SplashScreen() {
  const reduce = useReducedMotion()
  return (
    <div className="grid min-h-dvh place-items-center">
      <Background />
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={popSpring}
      >
        <LogoMark className="size-16 object-contain" />
        <span className="font-display text-3xl uppercase tracking-tight">KRIDORA</span>
        <div className="mt-1 flex flex-col items-center gap-2">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="load-bar h-full w-full rounded-full bg-linear-to-r from-neon-cyan to-neon-pink" />
          </div>
          <span className="animate-pulse text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            LOADING
          </span>
        </div>
        <span className="sr-only" role="status">
          Loading
        </span>
      </motion.div>
    </div>
  )
}