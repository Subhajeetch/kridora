import { motion, useReducedMotion } from "framer-motion"
import { Background } from "@/components/Background"
import { LogoMark } from "@/components/Logo"

/** Shown while we find out whether the visitor already has a session. */
export function SplashScreen() {
  const reduce = useReducedMotion()
  return (
    <div className="grid min-h-dvh place-items-center">
      <Background />
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <LogoMark className="h-14 w-20" />
        <span className="text-3xl font-bold tracking-tight">Kridora</span>
        <span className="sr-only" role="status">
          Loading
        </span>
      </motion.div>
    </div>
  )
}
