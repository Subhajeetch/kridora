import {
  AnimatePresence,
  motion,
  stagger,
  useAnimate,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { useLocation, useOutlet } from "react-router";
import { LogoMark } from "@/components/Logo";
import { cn } from "@/lib/utils";

const BAR_COLORS = [
  "#22e4ff",
  "#ff3db8",
  "#8b5cf6",
  "#ffd23f",
  "#22e4ff",
  "#ff3db8",
];

const pageVariants: Variants = {
  enter: { opacity: 0, scale: 0.985, y: 14 },
  center: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, delay: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 1.03,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};
const reducedVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate();
  const previousPath = useRef(location.pathname);
  const isFirstMount = useRef(true);
  const transitionIdRef = useRef(0);
  const wide = location.pathname === "/";

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      previousPath.current = location.pathname;
      return;
    }
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    if (reduce) return;

    const currentId = ++transitionIdRef.current;

    void (async () => {
      // Make the overlay visible only during the page transition
      animate(
        scope.current,
        { opacity: 1, visibility: "visible" },
        { duration: 0 },
      );

      // Batch 1 (Entrance & Obscure):
      // - Wipe bars cascade down to cover screen
      // - Emblem fades in
      // - Logo executes Batch 1 spin (0° -> 360°) with high-kinetic AAA easing
      // - Subtle neon backing glow pulses up
      await Promise.all([
        animate(
          ".wipe-bar",
          { y: ["-120%", "0%"] },
          { duration: 0.22, ease: "easeIn", delay: stagger(0.025) },
        ),
        animate(
          ".wipe-emblem",
          { opacity: [0, 1] },
          { duration: 0.22, ease: "easeOut" },
        ),
        animate(
          ".wipe-logo",
          { rotate: [0, 360] },
          { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        ),
        animate(
          ".wipe-glow",
          { opacity: [0, 0.9] },
          { duration: 0.3, ease: "easeOut" },
        ),
      ]);
      if (transitionIdRef.current !== currentId) return;

      // Apex Hold: Screen is fully covered; logo is poised and centered
      await new Promise((resolve) => setTimeout(resolve, 80));
      if (transitionIdRef.current !== currentId) return;

      // Batch 2 (Exit & Reveal):
      // - Wipe bars sweep down and off the screen
      // - Logo executes Batch 2 spin (360° -> 720°) completing the kinetic cycle
      // - Emblem and backing glow dissolve smoothly into the new page
      await Promise.all([
        animate(
          ".wipe-bar",
          { y: ["0%", "120%"] },
          { duration: 0.22, ease: "easeOut", delay: stagger(0.025) },
        ),
        animate(
          ".wipe-logo",
          { rotate: [360, 720] },
          { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        ),
        animate(
          ".wipe-emblem",
          { opacity: [1, 0] },
          { duration: 0.22, delay: 0.05, ease: "easeIn" },
        ),
        animate(
          ".wipe-glow",
          { opacity: [0.9, 0] },
          { duration: 0.25, ease: "easeIn" },
        ),
      ]);
      if (transitionIdRef.current !== currentId) return;

      // Reset all elements so idle state has zero shadow bleed or stray transforms
      animate(
        scope.current,
        { opacity: 0, visibility: "hidden" },
        { duration: 0 },
      );
      animate(".wipe-bar", { y: "-120%" }, { duration: 0 });
      animate(".wipe-logo", { rotate: 0 }, { duration: 0 });
      animate(".wipe-emblem", { opacity: 0 }, { duration: 0 });
      animate(".wipe-glow", { opacity: 0 }, { duration: 0 });
    })();
  }, [location.pathname, animate, reduce, scope]);

  return (
    <>
      <div
        ref={scope}
        aria-hidden="true"
        style={{ visibility: "hidden", opacity: 0 }}
        className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      >
        {BAR_COLORS.map((color, i) => (
          <div
            key={`${color}-${i}`}
            className="wipe-bar absolute top-0 h-full bg-linear-to-b from-night to-void"
            style={{
              left: `${(i * 100) / BAR_COLORS.length}%`,
              width: `${100 / BAR_COLORS.length + 0.4}%`,
              transform: "translateY(-120%)",
              borderBottom: `3px solid ${color}`,
              boxShadow: `0 10px 30px -6px ${color}`,
            }}
          />
        ))}
        <div className="wipe-emblem pointer-events-none absolute inset-0 grid place-items-center opacity-0">
          <div className="relative flex items-center justify-center">
            {/* Ambient cyber glow backdrop */}
            <div
              className="wipe-glow absolute size-36 rounded-full bg-linear-to-tr from-neon-cyan/35 via-neon-pink/25 to-purple-500/30 blur-2xl pointer-events-none"
              style={{ opacity: 0 }}
            />
            {/* Dedicated rotating brand mark: size is fixed without shrinking */}
            <div className="wipe-logo relative z-10 flex items-center justify-center">
              <LogoMark className="size-20 object-contain drop-shadow-[0_0_24px_rgba(34,228,255,0.45)]" />
            </div>
          </div>
        </div>
      </div>
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => window.scrollTo(0, 0)}
      >
        <motion.div
          key={location.pathname}
          variants={reduce ? reducedVariants : pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className={cn(!wide && "mx-auto w-full max-w-5xl px-4 pb-16")}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
