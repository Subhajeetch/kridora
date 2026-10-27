const MARQUEE_ITEMS = [
  "MULTIPLAYER",
  "NO DOWNLOAD",
  "PRIVATE ROOMS",
  "PUBLIC LOBBIES",
  "INVITE LINKS",
  "XP & RINGS",
  "MULTIPLAYER",
  "NO DOWNLOAD",
  "PRIVATE ROOMS",
  "PUBLIC LOBBIES",
  "INVITE LINKS",
  "XP & RINGS",
] as const;

export function Marquee() {
  return (
    <div aria-hidden="true" className="overflow-x-clip py-2">
      <div
        className="-mx-2 -rotate-[0.6deg] border-y border-neon-violet/30 bg-night/80 py-3.5"
        style={{
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
          maskImage:
            "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
        }}
      >
        <div className="marquee-track">
          {[0, 1].map((groupIndex) => (
            <div key={groupIndex} className="flex shrink-0 items-center">
              {MARQUEE_ITEMS.map((item, idx) => (
                <span
                  key={`${groupIndex}-${idx}`}
                  className="inline-flex items-center"
                >
                  <span className="px-6 font-display text-sm uppercase tracking-[0.3em] text-white/70">
                    {item}
                  </span>
                  <span className="size-2 rotate-45 bg-neon-pink" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
