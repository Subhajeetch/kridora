import type { GameComponentProps } from "../types";

/** Entry point of Monopoly. Replace this placeholder with the real game board. */
const Monopoly = ({ room, userId }: GameComponentProps) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-card/70 p-8">
      <h1 className="text-2xl font-semibold">Monopoly</h1>
      <p className="mt-2 text-muted-foreground">
        The game has started (match {room.matchId}). Build the board here.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {room.players.map((p, seat) => (
          <li key={p.userId} className="flex items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-500/20 text-xs font-semibold overflow-hidden">
              {p.image ? (
                <img src={p.image} alt="" className="size-full object-cover" />
              ) : (
                p.name.charAt(0).toUpperCase()
              )}
            </span>
            <span>
              Seat {seat + 1}: {p.name}
              {p.userId === userId ? " (you)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Monopoly;
