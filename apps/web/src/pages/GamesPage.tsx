import { Clock, Users } from "lucide-react"
import { Link } from "react-router"
import { RequireIdentity } from "@/components/RequireIdentity"
import { enabledGames } from "@/config/games"

export default function GamesPage() {
  return (
    <RequireIdentity>
      <section className="py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Browse games</h1>
        <p className="mt-2 text-muted-foreground">Pick a game to create a room or join one.</p>

        {enabledGames.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No games are available yet. Check back soon.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {enabledGames.map((game) => (
              <li key={game.slug}>
                <Link
                  to={`/${game.slug}`}
                  className="group block h-full rounded-3xl border border-white/10 bg-card/70 p-6 outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
                  style={{ borderLeft: `4px solid ${game.accent}` }}
                >
                  <h2 className="text-xl font-semibold">{game.name}</h2>
                  <p className="mt-1.5 text-muted-foreground">{game.tagline}</p>
                  <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" /> {game.minPlayers} to {game.maxPlayers} players
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" /> {game.playTime}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </RequireIdentity>
  )
}
