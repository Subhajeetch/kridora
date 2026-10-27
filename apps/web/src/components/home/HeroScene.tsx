import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Transition,
} from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { ArcadeCanvas } from "@/components/home/ArcadeCanvas";
import { FloatingSprites } from "@/components/home/FloatingSprites";
import { HORIZON } from "@/components/home/scene-config";

interface HeroSceneProps {
  children: ReactNode;
}

const fadeTransition: Transition = { duration: 0.6, ease: "easeOut" };
const sunBobTransition: Transition = {
  duration: 8,
  repeat: Infinity,
  ease: "easeInOut",
};

export function HeroScene({ children }: HeroSceneProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const inView = useInView(sectionRef, { amount: 0.05 });
  const reduce = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smoothX = useSpring(mx, { stiffness: 60, damping: 18 });
  const smoothY = useSpring(my, { stiffness: 60, damping: 18 });

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function handlePointerLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <section
      ref={sectionRef}
      data-paused={!inView}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative isolate min-h-[max(40rem,calc(100dvh-4.5rem))] overflow-hidden [&[data-paused=true]_.hero-anim]:[animation-play-state:paused]"
    >
      {/* 1. Synthwave Sun + Glow */}
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeTransition}
        style={{ top: `${HORIZON * 100}%` }}
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <motion.div
          animate={reduce || !inView ? undefined : { y: [0, -8, 0] }}
          transition={sunBobTransition}
          className="relative grid place-items-center"
        >
          <div className="hero-sun-glow aspect-square w-[clamp(400px,60vw,760px)] rounded-full" />
          <div className="hero-sun absolute aspect-square w-[clamp(200px,30vw,380px)] rounded-full opacity-60" />
        </motion.div>
      </motion.div>

      {/* 2. Perspective Neon Floor + Particles Canvas */}
      <ArcadeCanvas horizon={HORIZON} className="absolute inset-0 size-full" />

      {/* 3. Legibility Scrim, Scanlines & Bottom Fade */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_38%,rgba(7,5,15,0.7),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="scanlines pointer-events-none absolute inset-0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-b from-transparent to-background"
      />

      {/* 5. Floating Arcade Sprites */}
      <FloatingSprites mx={smoothX} my={smoothY} inView={inView} />

      {/* 6. Foreground Content */}
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-16 pb-28 text-center sm:pt-24">
        {children}
      </div>
    </section>
  );
}
