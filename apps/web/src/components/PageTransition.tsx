import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useLocation, useOutlet } from "react-router";
import { cn } from "@/lib/utils";
import { useGameLayout } from "@/providers/game-layout-context";

/**
 * Ultra-lightweight Motion Blur Page Transition.
 * Perfectly aligns with AppShell's max-w-5xl and horizontal padding.
 */
const motionBlurVariants: Variants = {
  enter: {
    opacity: 0,
    filter: "blur(10px)",
    scale: 0.99,
    y: 8,
  },
  center: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1], // snappy cubic bezier
    },
  },
  exit: {
    opacity: 0,
    filter: "blur(8px)",
    scale: 1.01,
    y: -6,
    transition: {
      duration: 0.16,
      ease: "easeIn",
    },
  },
};

const reducedVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();
  const { inGameMode } = useGameLayout();

  return (
    <AnimatePresence
      mode="wait"
      initial={false}
      onExitComplete={() => window.scrollTo(0, 0)}
    >
      <motion.div
        key={location.pathname}
        variants={reduce ? reducedVariants : motionBlurVariants}
        initial="enter"
        animate="center"
        exit="exit"
        className={cn(
          "w-full",
          inGameMode
            ? "flex-1 flex flex-col max-w-none px-0 pb-0 h-full max-h-full min-h-0 overflow-hidden w-full min-w-full"
            : "mx-auto max-w-5xl px-4 pb-16",
        )}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
