import { useState } from "react"
import { getGameThumbnailSrc } from "@/lib/game-art"
import { cn } from "@/lib/utils"

interface GameThumbnailProps {
  slug: string
  name: string
  className?: string
}

type ImageState = { src: string; status: "loaded" | "error" } | null

export function GameThumbnail({ slug, name, className }: GameThumbnailProps) {
  const src = getGameThumbnailSrc(slug)
  const [state, setState] = useState<ImageState>(null)
  const status = state && state.src === src ? state.status : "loading"

  return (
    <div data-game={name} className={cn("thumb-frame relative overflow-hidden", className)}>
      {status !== "loaded" && (
        <div className="absolute inset-0 grid place-items-center text-white/30">
          <svg
            viewBox="0 0 64 64"
            className="size-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="6" y="10" width="52" height="44" rx="9" strokeDasharray="5 5" />
            <circle cx="32" cy="32" r="11" />
            <path d="M24.2 39.8 39.8 24.2" />
          </svg>
        </div>
      )}
      {status !== "error" && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState({ src, status: "loaded" })}
          onError={() => setState({ src, status: "error" })}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  )
}