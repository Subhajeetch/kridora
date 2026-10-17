import type { GameComponentProps } from "../types"

/** Entry point of Fate by AI. Replace this placeholder with the real game. */
const FateByAI = ({ room, userId }: GameComponentProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-card/70 p-8">
      <h1 className="text-2xl font-semibold">Fate by AI</h1>
      <p className="mt-2 text-muted-foreground">
        The game has started (match {room.matchId}). Build the game here.
      </p>
      <ul className="mt-4 space-y-1 text-sm">
        {room.players.map((p) => (
          <li key={p.userId}>
            {p.name}
            {p.userId === userId ? " (you)" : ""}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FateByAI
