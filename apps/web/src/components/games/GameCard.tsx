import type { GameDefinition } from "@kridora/shared";
import { motion, type Variants } from "framer-motion";
import { Clock, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router";
import { GameThumbnail } from "@/components/games/GameThumbnail";

interface GameCardProps {
  game: GameDefinition;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

export function GameCard({ game }: GameCardProps) {
  return (
    <motion.li variants={itemVariants} className="h-full">
      <Link
        to={`/${game.slug}`}
        className="game-card group flex h-full flex-col transition-transform duration-200 hover:-translate-y-1 active:scale-[0.985]"
        style={{ "--game-accent": game.accent } as CSSProperties}
      >
        {/* 1. Thumbnail zone */}
        <div className="relative overflow-hidden">
          <GameThumbnail
            slug={game.slug}
            name={game.name}
            className="aspect-[16/10]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#120d2b] via-transparent to-transparent"
          />
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-void/70 px-2.5 py-1 text-xs font-medium uppercase tabular-nums backdrop-blur-sm">
            <Users className="size-3.5" aria-hidden="true" />
            {game.minPlayers}-{game.maxPlayers} PLAYERS
          </span>
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-void/70 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
            <Clock className="size-3.5" aria-hidden="true" />
            {game.playTime}
          </span>
          <div aria-hidden="true" className="game-card__shine" />
        </div>

        {/* 2. Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-2xl uppercase tracking-tight">
            {game.name}
          </h3>
          <p className="game-card__tagline mt-0.5 text-sm font-semibold">
            {game.tagline}
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {game.description}
          </p>
        </div>
      </Link>
    </motion.li>
  );
}
