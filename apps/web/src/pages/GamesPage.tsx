import { Lock, Search } from "lucide-react";
import { useSearchParams } from "react-router";
import { GameCard } from "@/components/games/GameCard";
import { enabledGames } from "@/config/games";

export default function GamesPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").toLowerCase().trim();

  const filteredGames = query
    ? enabledGames.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.tagline.toLowerCase().includes(query) ||
          g.description.toLowerCase().includes(query),
      )
    : enabledGames;

  const count = filteredGames.length;
  const onlineLabel = count === 1 ? "1 GAME" : `${count} GAMES`;

  return (
    <section className="py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-retro text-3xl sm:text-4xl font-bold uppercase tracking-tight text-[#facc15] drop-shadow-[0_2px_0_#b45309]">
            BROWSE GAMES
          </h1>
          <p className="mt-2 text-sm text-gray-300 font-medium">
            {query
              ? `Showing results matching "${query}"`
              : "Pick a game to create a room or join one."}
          </p>
        </div>

        <div className="hidden items-center gap-2 rounded-xl border-2 border-[#facc15]/30 bg-[#12131a] px-3.5 py-1.5 font-retro text-xs font-bold uppercase tracking-wider text-[#facc15] sm:inline-flex shadow-[0_2px_0_#b45309]">
          <span
            className="size-2 animate-pulse rounded-full bg-[#facc15]"
            aria-hidden="true"
          />
          <span className="tabular-nums">{onlineLabel}</span>
        </div>
      </div>

      <h2 className="sr-only">Available games</h2>

      {count === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/40 px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-white/10 bg-[#12131a] text-muted-foreground">
            {query ? (
              <Search className="size-5" />
            ) : (
              <Lock className="size-5" />
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {query
              ? `No games found matching "${query}".`
              : "No games are available yet. Check back soon."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </ul>
      )}
    </section>
  );
}
