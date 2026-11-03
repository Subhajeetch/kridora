import { Gamepad2, Sparkles } from "lucide-react";
import { useState } from "react";
import { getGameThumbnailSrc } from "@/lib/game-art";
import { cn } from "@/lib/utils";

interface GameThumbnailProps {
  slug: string;
  name: string;
  className?: string;
}

type ImageState = { src: string; status: "loaded" | "error" } | null;

export function GameThumbnail({ slug, name, className }: GameThumbnailProps) {
  const src = getGameThumbnailSrc(slug);
  const [state, setState] = useState<ImageState>(null);
  const status = state && state.src === src ? state.status : "loading";

  return (
    <div
      data-game={name}
      className={cn(
        "relative overflow-hidden bg-[#0d0e14] select-none",
        className,
      )}
    >
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,#1c1e2d_0%,#0c0d14_100%)] p-4 text-center">
          <div className="grid size-12 place-items-center rounded-xl border border-[#facc15]/30 bg-[#facc15]/10 text-[#facc15] shadow-sm">
            {slug === "fatebyai" ? (
              <Sparkles className="size-6" />
            ) : (
              <Gamepad2 className="size-6" />
            )}
          </div>
          <span className="mt-2 font-retro text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {name}
          </span>
        </div>
      )}

      {status !== "error" && (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState({ src, status: "loaded" })}
          onError={() => setState({ src, status: "error" })}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
