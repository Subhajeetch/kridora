import { motion, useReducedMotion } from "framer-motion"

const ORBS = [
  { className: "left-[-10%] top-[-15%] h-[34rem] w-[34rem] bg-violet-600/30", x: [0, 60, 0], y: [0, 40, 0], duration: 26 },
  { className: "right-[-12%] top-[20%] h-[30rem] w-[30rem] bg-amber-500/15", x: [0, -50, 0], y: [0, 60, 0], duration: 32 },
  { className: "bottom-[-20%] left-[25%] h-[32rem] w-[32rem] bg-sky-500/20", x: [0, 40, 0], y: [0, -50, 0], duration: 29 },
]

/** Fixed, slow-moving colour glow behind every page. Static when the player prefers reduced motion. */
export function Background() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {ORBS.map((orb) => (
        <motion.div
          key={orb.className}
          className={`absolute rounded-full blur-3xl ${orb.className}`}
          animate={reduce ? undefined : { x: orb.x, y: orb.y }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,oklch(0.145_0_0)_100%)]" />
    </div>
  )
}
