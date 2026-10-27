import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Lock } from "lucide-react";
import { GameCard } from "@/components/games/GameCard";
import { enabledGames } from "@/config/games";

const gridVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.1,
    },
  },
};

export default function GamesPage() {
  const reduce = useReducedMotion();
  const count = enabledGames.length;
  const onlineLabel = count === 1 ? "1 GAME" : `${count} GAMES`;

  return (
    <section className="py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-tight sm:text-5xl">
            BROWSE GAMES
          </h1>
          <p className="mt-1 text-muted-foreground">
            Pick a game to create a room or join one.
          </p>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-panel/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground sm:inline-flex">
          <span
            className="size-2 animate-pulse rounded-full bg-ok"
            aria-hidden="true"
          />
          <span className="tabular-nums">{onlineLabel}</span>
        </div>
      </div>

      <h2 className="sr-only">Available games</h2>

      {count === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/15 bg-panel/40 px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-white/10 bg-panel-2 text-muted-foreground">
            <Lock className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-muted-foreground">
            No games are available yet. Check back soon.
          </p>
        </div>
      ) : (
        <motion.ul
          variants={gridVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {enabledGames.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </motion.ul>
      )}
    </section>
  );
}
