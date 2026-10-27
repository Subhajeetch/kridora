import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FloatingSpritesProps {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  inView?: boolean;
}

interface ParallaxSpriteProps {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  staggerIndex: number;
  className: string;
  idleAnimate: TargetAndTransition;
  idleTransition: Transition;
  active: boolean;
  reduce: boolean;
  children: ReactNode;
}

const hoverTarget: TargetAndTransition = { scale: 1.12 };
const tapTarget: TargetAndTransition = { scale: 0.92, rotate: 12 };

const diceIdleAnimate: TargetAndTransition = {
  y: [0, -14, 0],
  rotate: [-12, -6, -12],
};
const diceIdleTransition: Transition = {
  duration: 5.4,
  repeat: Infinity,
  ease: "easeInOut",
};

const coinIdleAnimate: TargetAndTransition = {
  y: [0, -12, 0],
  scaleX: [1, 0.15, 1],
};
const coinIdleTransition: Transition = {
  duration: 3.2,
  repeat: Infinity,
  ease: "easeInOut",
  delay: 0.3,
};

const controllerIdleAnimate: TargetAndTransition = {
  y: [0, -14, 0],
  rotate: [8, 13, 8],
};
const controllerIdleTransition: Transition = {
  duration: 6.1,
  repeat: Infinity,
  ease: "easeInOut",
  delay: 0.5,
};

const trophyIdleAnimate: TargetAndTransition = {
  y: [0, -14, 0],
  rotate: [-6, 4, -6],
};
const trophyIdleTransition: Transition = {
  duration: 5.8,
  repeat: Infinity,
  ease: "easeInOut",
  delay: 0.2,
};

interface StarConfig {
  id: string;
  className: string;
  color: string;
  delay: number;
  duration: number;
}

const STARS: readonly StarConfig[] = [
  {
    id: "star-1",
    className: "left-[23%] top-[18%] size-7",
    color: "#ffd23f",
    delay: 1.2,
    duration: 3.4,
  },
  {
    id: "star-2",
    className: "right-[22%] top-[34%] size-6",
    color: "#22e4ff",
    delay: 1.4,
    duration: 4.1,
  },
  {
    id: "star-3",
    className: "left-[26%] top-[68%] size-8",
    color: "#ff3db8",
    delay: 1.6,
    duration: 3.8,
  },
];

function ParallaxSprite({
  mx,
  my,
  depth,
  staggerIndex,
  className,
  idleAnimate,
  idleTransition,
  active,
  reduce,
  children,
}: ParallaxSpriteProps) {
  const x = useTransform(mx, (v) => (reduce ? 0 : v * depth * 36));
  const y = useTransform(my, (v) => (reduce ? 0 : v * depth * 36));
  const entranceTransition: Transition = {
    type: "spring",
    stiffness: 260,
    damping: 20,
    delay: 1.1 + staggerIndex * 0.1,
  };

  return (
    <motion.div
      style={reduce ? undefined : { x, y }}
      className={cn("absolute select-none", className)}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={entranceTransition}
      >
        <motion.div
          className="pointer-events-auto cursor-pointer"
          animate={active ? idleAnimate : undefined}
          transition={idleTransition}
          whileHover={reduce ? undefined : hoverTarget}
          whileTap={reduce ? undefined : tapTarget}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function DiceSvg() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-full"
      style={{ filter: "drop-shadow(0 0 14px rgba(255,61,184,0.55))" }}
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="14"
        y="14"
        width="68"
        height="68"
        rx="18"
        fill="#c026d3"
        stroke="#0b0720"
        strokeWidth="4"
      />
      <path
        d="M16 32C16 22 22 16 32 16H64C74 16 80 22 80 32V52H16V32Z"
        fill="#ff3db8"
      />
      <path
        d="M24 22H60"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect
        x="14"
        y="14"
        width="68"
        height="68"
        rx="18"
        stroke="#0b0720"
        strokeWidth="4"
      />
      <circle cx="32" cy="32" r="5.5" fill="#0b0720" />
      <circle cx="64" cy="32" r="5.5" fill="#0b0720" />
      <circle
        cx="48"
        cy="48"
        r="6"
        fill="#f4f1ff"
        stroke="#0b0720"
        strokeWidth="2.5"
      />
      <circle cx="32" cy="64" r="5.5" fill="#0b0720" />
      <circle cx="64" cy="64" r="5.5" fill="#0b0720" />
    </svg>
  );
}

function RingCoinSvg() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-full"
      style={{ filter: "drop-shadow(0 0 14px rgba(255,210,63,0.55))" }}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="48"
        cy="48"
        r="34"
        fill="#d97706"
        stroke="#0b0720"
        strokeWidth="4"
      />
      <path d="M16 48A32 32 0 0 1 80 48Z" fill="#ffd23f" />
      <circle
        cx="48"
        cy="48"
        r="16"
        fill="#07050f"
        stroke="#0b0720"
        strokeWidth="4"
      />
      <path
        d="M26 30A26 26 0 0 1 62 22"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="48" r="34" stroke="#0b0720" strokeWidth="4" />
    </svg>
  );
}

function ControllerSvg() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-full"
      style={{ filter: "drop-shadow(0 0 14px rgba(34,228,255,0.55))" }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22 30H74C82 30 88 37 86 46L82 68C80 75 73 78 67 73L58 64H38L29 73C23 78 16 75 14 68L10 46C8 37 14 30 22 30Z"
        fill="#0891b2"
        stroke="#0b0720"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M22 32H74C80 32 85 37 84 44L82 54H14L12 44C11 37 16 32 22 32Z"
        fill="#22e4ff"
      />
      <path
        d="M24 37H58"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M22 30H74C82 30 88 37 86 46L82 68C80 75 73 78 67 73L58 64H38L29 73C23 78 16 75 14 68L10 46C8 37 14 30 22 30Z"
        stroke="#0b0720"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M29 43V55M23 49H35"
        stroke="#0b0720"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle
        cx="63"
        cy="45"
        r="4.5"
        fill="#ff3db8"
        stroke="#0b0720"
        strokeWidth="2.5"
      />
      <circle
        cx="72"
        cy="52"
        r="4.5"
        fill="#ffd23f"
        stroke="#0b0720"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function TrophySvg() {
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-full"
      style={{ filter: "drop-shadow(0 0 14px rgba(255,210,63,0.55))" }}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M28 24H16C14 24 12 26 12 29C12 39 19 46 29 46H31"
        stroke="#0b0720"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M28 24H16C14 24 12 26 12 29C12 39 19 46 29 46H31"
        stroke="#ffd23f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M68 24H80C82 24 84 26 84 29C84 39 77 46 67 46H65"
        stroke="#0b0720"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M68 24H80C82 24 84 26 84 29C84 39 77 46 67 46H65"
        stroke="#d97706"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M26 18H70V38C70 51 60 60 48 60C36 60 26 51 26 38V18Z"
        fill="#d97706"
        stroke="#0b0720"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M28 20H54V58C38 57 28 48 28 38V20Z" fill="#ffd23f" />
      <path
        d="M33 25V41"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M26 18H70V38C70 51 60 60 48 60C36 60 26 51 26 38V18Z"
        stroke="#0b0720"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect
        x="42"
        y="60"
        width="12"
        height="12"
        fill="#d97706"
        stroke="#0b0720"
        strokeWidth="4"
      />
      <rect
        x="28"
        y="72"
        width="40"
        height="10"
        rx="4"
        fill="#ffd23f"
        stroke="#0b0720"
        strokeWidth="4"
      />
    </svg>
  );
}

function StarSprite({
  star,
  active,
  reduce,
}: {
  star: StarConfig;
  active: boolean;
  reduce: boolean;
}) {
  const starTransition: Transition = {
    duration: star.duration,
    repeat: Infinity,
    ease: "easeInOut",
    delay: star.delay,
  };

  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute hidden select-none md:block",
        star.className,
      )}
      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
      animate={
        active
          ? { opacity: [0.4, 0.95, 0.4], scale: [0.85, 1.15, 0.85] }
          : { opacity: 0.75, scale: 1 }
      }
      transition={starTransition}
    >
      <svg
        viewBox="0 0 96 96"
        className="size-full"
        style={{ filter: `drop-shadow(0 0 10px ${star.color})` }}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M48 10L58 38L86 48L58 58L48 86L38 58L10 48L38 38L48 10Z"
          fill={star.color}
          stroke="#0b0720"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M48 18L54 38L48 48L42 38L48 18Z"
          fill="rgba(255,255,255,0.35)"
        />
      </svg>
    </motion.div>
  );
}

export function FloatingSprites({
  mx,
  my,
  inView = true,
}: FloatingSpritesProps) {
  const reduce = Boolean(useReducedMotion());
  const active = !reduce && inView;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <ParallaxSprite
        mx={mx}
        my={my}
        depth={1.0}
        staggerIndex={0}
        className="left-[9%] top-[24%] hidden size-[88px] -rotate-12 md:block"
        idleAnimate={diceIdleAnimate}
        idleTransition={diceIdleTransition}
        active={active}
        reduce={reduce}
      >
        <DiceSvg />
      </ParallaxSprite>

      <ParallaxSprite
        mx={mx}
        my={my}
        depth={0.7}
        staggerIndex={1}
        className="right-[6%] top-[14%] size-11 md:right-[10%] md:top-[20%] md:size-[72px]"
        idleAnimate={coinIdleAnimate}
        idleTransition={coinIdleTransition}
        active={active}
        reduce={reduce}
      >
        <RingCoinSvg />
      </ParallaxSprite>

      <ParallaxSprite
        mx={mx}
        my={my}
        depth={1.2}
        staggerIndex={2}
        className="left-[14%] top-[58%] hidden size-[92px] md:block"
        idleAnimate={controllerIdleAnimate}
        idleTransition={controllerIdleTransition}
        active={active}
        reduce={reduce}
      >
        <ControllerSvg />
      </ParallaxSprite>

      <ParallaxSprite
        mx={mx}
        my={my}
        depth={0.9}
        staggerIndex={3}
        className="right-[13%] top-[54%] hidden size-[84px] md:block"
        idleAnimate={trophyIdleAnimate}
        idleTransition={trophyIdleTransition}
        active={active}
        reduce={reduce}
      >
        <TrophySvg />
      </ParallaxSprite>

      {STARS.map((star) => (
        <StarSprite key={star.id} star={star} active={active} reduce={reduce} />
      ))}
    </div>
  );
}
