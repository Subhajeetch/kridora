import type { GameDefinition } from "@kridora/shared";
import { Clock, Users } from "lucide-react";
import { Link } from "react-router";
import { GameThumbnail } from "@/components/games/GameThumbnail";

interface GameCardProps {
  game: GameDefinition;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <li className="h-full list-none">
      <Link
        to={`/${game.slug}`}
        className="group filter drop-shadow-[0_4px_0_#78350f] hover:drop-shadow-[0_7px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f] transition-all hover:-translate-y-1 flex flex-col h-full"
      >
        <div className="pixel-corners-md bg-[#facc15] p-[3px] group-hover:bg-[#fde047] transition-colors h-full flex flex-col">
          <div className="pixel-corners-sm bg-[#12131a] p-3 flex flex-col h-full flex-1">
            <div className="pixel-corners-sm relative aspect-[16/10] overflow-hidden bg-black/60 border border-white/10">
              <GameThumbnail
                slug={game.slug}
                name={game.name}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 pixel-corners-sm bg-black/85 px-2 py-0.5 font-retro text-[8px] uppercase tabular-nums text-white">
                <Users className="size-2.5 text-[#facc15]" />
                {game.minPlayers}-{game.maxPlayers} PLAYERS
              </span>
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 pixel-corners-sm bg-black/85 px-2 py-0.5 font-retro text-[8px] text-white">
                <Clock className="size-2.5 text-[#facc15]" />
                {game.playTime}
              </span>
            </div>

            <div className="mt-3 flex flex-1 flex-col">
              <h3 className="font-retro text-sm sm:text-base font-bold uppercase tracking-wide text-white group-hover:text-[#facc15] transition-colors">
                {game.name}
              </h3>
              <p className="mt-1 line-clamp-1 text-xs font-semibold text-amber-300/90">
                {game.tagline}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                {game.description}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
