import { ROOM_CODE_LENGTH } from "@kridora/shared";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Play, Plus, Users } from "lucide-react";
import type { ComponentType } from "react";

interface StepItem {
  number: string;
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string }>;
}

const STEPS: readonly StepItem[] = [
  {
    number: "01",
    title: "CREATE A ROOM",
    body: "Pick a game and open a room in one tap.",
    Icon: Plus,
  },
  {
    number: "02",
    title: "SHARE THE CODE",
    body: `Send the ${ROOM_CODE_LENGTH}-character code or the invite link to your friends.`,
    Icon: Users,
  },
  {
    number: "03",
    title: "PLAY TOGETHER",
    body: "Everyone gets ready, the owner hits start and the match begins.",
    Icon: Play,
  },
];

const gridVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          3 STEPS TO PLAY
        </p>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-tight sm:text-4xl">
          HOW IT WORKS
        </h2>
      </div>

      <div className="relative mt-12">
        <div
          aria-hidden="true"
          className="quest-line pointer-events-none absolute top-12 right-[16%] left-[16%] hidden h-0.5 md:block"
        >
          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,rgba(250,212,111,0.4)_0_8px,transparent_8px_16px)]" />
          <span className="quest-dot absolute -top-1 left-0 size-2.5 rounded-full bg-primary shadow-[0_0_12px_#fad46f]" />
        </div>

        <motion.div
          variants={gridVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="relative z-10 grid gap-5 md:grid-cols-3"
        >
          {STEPS.map(({ number, title, body, Icon }) => (
            <motion.article
              key={number}
              variants={cardVariants}
              className="group relative rounded-3xl border border-white/10 bg-panel/80 p-6 transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-neon-violet to-neon-pink text-white shadow-[0_0_24px_-6px_rgba(255,61,184,0.65)]">
                  <Icon className="size-6" />
                </div>
                <span
                  aria-hidden="true"
                  className="font-display text-4xl leading-none select-none"
                  style={{
                    color: "transparent",
                    WebkitTextStroke: "1.5px rgba(255,255,255,0.22)",
                  }}
                >
                  {number}
                </span>
              </div>
              <h3 className="mt-6 font-display text-xl uppercase tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
