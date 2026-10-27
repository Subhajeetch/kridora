import { motion, useReducedMotion, type Transition } from "framer-motion";

interface OrbConfig {
  id: string;
  className: string;
  x: number[];
  y: number[];
  transition: Transition;
}

const ORBS: readonly OrbConfig[] = [
  {
    id: "pink-orb",
    className: "left-[-10%] top-[-12%] h-[34rem] w-[34rem] bg-neon-pink/15",
    x: [0, 56, 0],
    y: [0, 38, 0],
    transition: { duration: 28, repeat: Infinity, ease: "easeInOut" },
  },
  {
    id: "cyan-orb",
    className: "bottom-[-16%] right-[-10%] h-[32rem] w-[32rem] bg-neon-cyan/10",
    x: [0, -48, 0],
    y: [0, -42, 0],
    transition: { duration: 34, repeat: Infinity, ease: "easeInOut" },
  },
];

/** Fixed, slow-moving colour glow behind every page. Static when the player prefers reduced motion. */
export function Background() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,#2a0f5c_0%,#120a2e_38%,#07050f_75%)]" />
      {ORBS.map((orb) => (
        <motion.div
          key={orb.id}
          className={`absolute rounded-full blur-3xl ${orb.className}`}
          animate={reduce ? undefined : { x: orb.x, y: orb.y }}
          transition={orb.transition}
        />
      ))}
      <div className="bg-stars absolute inset-0 opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#07050f_100%)]" />
    </div>
  );
}
