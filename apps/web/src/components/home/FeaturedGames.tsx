import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { GameCard } from "@/components/games/GameCard";
import { arcadeButtonVariants } from "@/components/ui/arcade-button";
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

export function FeaturedGames() {
  const reduce = useReducedMotion();
  const featured = enabledGames.slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:py-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            SELECT YOUR GAME
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-tight sm:text-4xl">
            FEATURED GAMES
          </h2>
        </div>
        <Link
          to="/games"
          className={arcadeButtonVariants({ variant: "ghost", size: "md" })}
        >
          SEE ALL GAMES <ArrowRight />
        </Link>
      </div>

      <motion.ul
        variants={gridVariants}
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {featured.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </motion.ul>
    </section>
  );
}
