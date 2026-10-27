import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
  type Variants,
} from "framer-motion";

const LINE_1_WORDS = ["PLAY", "GAMES"] as const;
const LINE_2_WORDS = ["WITH", "FRIENDS"] as const;

const line1ContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.25,
    },
  },
};

const line2ContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.56,
    },
  },
};

const wordVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.028,
    },
  },
};

const letterVariants: Variants = {
  hidden: { opacity: 0, y: 36, rotateX: -70 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: "spring", stiffness: 420, damping: 22 },
  },
};

const letterHover: TargetAndTransition = { y: -6, rotate: -3 };
const letterHoverSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 18,
};

export function HeroTitle() {
  const reduce = useReducedMotion();

  return (
    <h1
      aria-label="Level up your game night"
      className="mt-5 font-display text-[clamp(2.25rem,8.5vw,6.25rem)] leading-[0.95] uppercase tracking-tight select-none"
    >
      <motion.span
        aria-hidden="true"
        variants={line1ContainerVariants}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="block text-foreground"
        style={{
          textShadow: "0 4px 0 rgba(0,0,0,0.45), 0 0 30px rgba(0,0,0,0.6)",
        }}
      >
        {LINE_1_WORDS.map((word, wIdx) => (
          <motion.span
            key={word}
            variants={wordVariants}
            className="inline-block whitespace-nowrap"
          >
            {Array.from(word).map((char, cIdx) => (
              <motion.span
                key={`${word}-${cIdx}`}
                variants={reduce ? undefined : letterVariants}
                whileHover={reduce ? undefined : letterHover}
                transition={letterHoverSpring}
                className="inline-block origin-bottom"
              >
                {char}
              </motion.span>
            ))}
            {wIdx < LINE_1_WORDS.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </motion.span>

      <motion.span
        aria-hidden="true"
        variants={line2ContainerVariants}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="text-shimmer mt-1 block"
        style={{ filter: "drop-shadow(0 0 24px rgba(255,61,184,0.45))" }}
      >
        {LINE_2_WORDS.map((word, wIdx) => (
          <motion.span
            key={word}
            variants={wordVariants}
            className="inline-block whitespace-nowrap"
          >
            {Array.from(word).map((char, cIdx) => (
              <motion.span
                key={`${word}-${cIdx}`}
                variants={reduce ? undefined : letterVariants}
                whileHover={reduce ? undefined : letterHover}
                transition={letterHoverSpring}
                className="text-shimmer inline-block origin-bottom"
              >
                {char}
              </motion.span>
            ))}
            {wIdx < LINE_2_WORDS.length - 1 ? "\u00A0" : ""}
          </motion.span>
        ))}
      </motion.span>
    </h1>
  );
}
