import { GAME_DEFINITIONS } from "@kridora/shared";
import { ArrowRight, Gamepad2, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { JoinRoomDialog } from "@/components/JoinRoomDialog";
import { Logo } from "@/components/Logo";
import { GameThumbnail } from "@/components/games/GameThumbnail";
import { enabledGames } from "@/config/games";
import { useRealtime } from "@/providers/realtime-context";

export default function HomePage() {
  const { activeRoom } = useRealtime();
  const [joinOpen, setJoinOpen] = useState(false);

  // Popular games list: use all enabled games, or fallback to all registered definitions
  const popularGames =
    enabledGames.length > 0 ? enabledGames : Object.values(GAME_DEFINITIONS);

  return (
    <div className="w-full">
      {/* ==================================================================== */}
      {/* HERO SECTION MATCHING ui-ref.png */}
      {/* ==================================================================== */}
      <section className="pt-6 sm:pt-14 pb-12 sm:pb-16 w-full">
        <div className="space-y-1">
          <h1 className="font-retro text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#facc15] drop-shadow-[0_2px_0_#b45309]">
            PLAY GAMES
          </h1>
          <h2 className="font-retro text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-white drop-shadow-[0_2px_0_#1f2937] mt-1 sm:mt-2">
            WITH FRIENDS!
          </h2>
        </div>

        <p className="mt-4 sm:mt-6 max-w-xl text-base sm:text-lg text-gray-300 font-medium leading-relaxed">
          Create rooms and play games online. No downloads, just instant
          multiplayer fun right in your browser.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/games"
            className="filter drop-shadow-[0_5px_0_#78350f] hover:drop-shadow-[0_6px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer inline-flex"
          >
            <div className="pixel-corners-sm bg-black p-[2.5px]">
              <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-xs sm:text-sm font-bold uppercase tracking-wider px-6 sm:px-8 py-3 sm:py-3.5 flex items-center justify-center gap-2.5">
                <Gamepad2 className="size-5" />
                <span>BROWSE GAMES</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="filter drop-shadow-[0_5px_0_#78350f] hover:drop-shadow-[0_6px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer inline-flex"
          >
            <div className="pixel-corners-sm bg-[#facc15] p-[2.5px]">
              <div className="pixel-corners-sm bg-[#12131a] hover:bg-[#1a1b24] text-[#facc15] font-retro text-xs sm:text-sm font-bold uppercase tracking-wider px-6 sm:px-8 py-3 sm:py-3.5 flex items-center justify-center gap-2.5">
                <Users className="size-5" />
                <span>JOIN ROOM</span>
              </div>
            </div>
          </button>
        </div>

        {/* Active room indicator if user is already participating in an ongoing room */}
        {activeRoom && (
          <Link
            to={`/${activeRoom.gameSlug}/room`}
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#facc15]/40 bg-[#12131a] px-4 py-3 text-xs sm:text-sm text-foreground hover:border-[#facc15] transition-all max-w-xl shadow-[0_4px_0_#b45309]"
          >
            <span className="inline-flex items-center gap-2 font-retro text-xs font-bold uppercase text-[#facc15]">
              <span className="size-2 animate-pulse rounded-full bg-[#facc15]" />
              ROOM IN PROGRESS
            </span>
            <span className="font-medium text-white">
              Room{" "}
              <strong className="font-mono text-[#facc15] tracking-widest">
                {activeRoom.code}
              </strong>{" "}
              ·{" "}
              {GAME_DEFINITIONS[activeRoom.gameSlug]?.name ??
                activeRoom.gameSlug}
            </span>
            <span className="inline-flex items-center gap-1 font-retro text-xs text-[#facc15]">
              RETURN <ArrowRight className="size-3.5" />
            </span>
          </Link>
        )}
      </section>

      {/* ==================================================================== */}
      {/* POPULAR GAMES SECTION MATCHING ui-ref.png */}
      {/* ==================================================================== */}
      <section className="pt-4 pb-12 sm:pb-20">
        {/* Section Header: Title & View All link on the same line */}
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="font-retro text-base sm:text-xl md:text-2xl font-bold uppercase tracking-wider text-white">
            POPULAR GAMES
          </h2>

          <Link
            to="/games"
            className="inline-flex items-center gap-1.5 font-retro text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-[#facc15] hover:text-white transition-colors shrink-0 group"
          >
            <span>VIEW ALL GAMES</span>
            <ArrowRight className="size-3.5 sm:size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Game Cards Grid: 2 columns on phone, 3 on tablet, 4 on desktop */}
        <div className="grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {popularGames.map((game) => (
            <Link
              to={`/${game.slug}`}
              key={game.slug}
              className="group filter drop-shadow-[0_4px_0_#78350f] hover:drop-shadow-[0_7px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f] transition-all hover:-translate-y-1 flex flex-col"
            >
              <div className="pixel-corners-md bg-[#facc15] p-[2.5px] sm:p-[3px] group-hover:bg-[#fde047] transition-colors h-full flex flex-col">
                <div className="pixel-corners-sm bg-[#12131a] p-2 sm:p-2.5 md:p-3 flex flex-col h-full flex-1">
                  <div className="pixel-corners-sm relative aspect-[16/10] w-full overflow-hidden bg-black/60 border border-white/10">
                    <GameThumbnail
                      slug={game.slug}
                      name={game.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="mt-2 sm:mt-2.5 flex flex-col">
                    <h3 className="font-retro text-xs sm:text-sm md:text-base font-bold uppercase tracking-wide text-white truncate group-hover:text-[#facc15] transition-colors">
                      {game.name}
                    </h3>
                    <span className="font-retro text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5 group-hover:text-amber-300 transition-colors">
                      PLAY NOW
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Clean lightweight footer */}
      <footer className="mt-8 border-t border-white/10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <Logo />
          <p className="font-medium text-gray-400">
            Instant multiplayer browser retro gaming.
          </p>
        </div>
      </footer>

      {/* Join room dialog */}
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
