import type React from "react";

function PixelStarSvg({
  color = "#facc15",
  coreColor = "#fef08a",
  className,
  style,
}: {
  color?: string;
  coreColor?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 15 15"
      className={className}
      style={style}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* 4 outer point tips */}
      <rect x="7" y="0" width="1" height="2" fill={color} />
      <rect x="7" y="13" width="1" height="2" fill={color} />
      <rect x="0" y="7" width="2" height="1" fill={color} />
      <rect x="13" y="7" width="2" height="1" fill={color} />

      {/* Main star rays */}
      <rect x="6" y="2" width="3" height="11" fill={color} />
      <rect x="2" y="6" width="11" height="3" fill={color} />

      {/* Inner diamond ring */}
      <rect x="5" y="4" width="5" height="7" fill={color} />
      <rect x="4" y="5" width="7" height="5" fill={color} />

      {/* Radiant core */}
      <rect x="5" y="5" width="5" height="5" fill={coreColor} />
      <rect x="6" y="6" width="3" height="3" fill="#ffffff" />
    </svg>
  );
}

function PixelCrossSvg({
  color = "#facc15",
  className,
  style,
}: {
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 5 5"
      className={className}
      style={style}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect x="2" y="0" width="1" height="5" fill={color} />
      <rect x="0" y="2" width="5" height="1" fill={color} />
      <rect x="2" y="2" width="1" height="1" fill="#ffffff" />
    </svg>
  );
}

/**
 * Clean, lightweight retro dark background inspired by ui-ref.png.
 * Features deep charcoal black, subtle scanlines, scattered pixel stars,
 * and 3 designated stars that animate like Claude AI icon (expanding from a point in pixels).
 * Pure CSS hardware-accelerated transforms; zero JS animation overhead.
 */
export function Background() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#090a0f]"
    >
      {/* Subtle radial ambient vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#11121c_0%,#08090d_80%)]" />

      {/* Ultra lightweight scanline texture */}
      <div className="scanlines absolute inset-0 opacity-40 pointer-events-none" />

      {/* ==================================================================== */}
      {/* 3 ANIMATED STARS: "like claude AI icon does (star growing from a point in pixels)" */}
      {/* ==================================================================== */}

      {/* Star 1: Mid-Left Blooming Star */}
      <div
        className="absolute top-[18%] left-[7%] size-6"
        style={{
          animation: "star-claude-bloom 6s ease-in-out infinite 0s",
          transformOrigin: "center center",
        }}
      >
        <PixelStarSvg className="size-full drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
      </div>

      {/* Star 2: Main Hero Star on Mid-Right (Prominently featured in ui-ref.png) */}
      <div
        className="absolute top-[32%] right-[8%] size-8"
        style={{
          animation: "star-claude-bloom 5.2s ease-in-out infinite 2s",
          transformOrigin: "center center",
        }}
      >
        <PixelStarSvg className="size-full drop-shadow-[0_0_12px_rgba(250,204,21,0.75)]" />
      </div>

      {/* Star 3: Silver Sparkle Star on Lower-Right (Matching ui-ref.png silver sparkle) */}
      <div
        className="absolute bottom-[20%] right-[11%] size-7"
        style={{
          animation: "star-claude-bloom 6.8s ease-in-out infinite 4s",
          transformOrigin: "center center",
        }}
      >
        <PixelStarSvg
          color="#cbd5e1"
          coreColor="#f8fafc"
          className="size-full drop-shadow-[0_0_10px_rgba(226,232,240,0.6)]"
        />
      </div>

      {/* ==================================================================== */}
      {/* STATIC & SUBTLE TWINKLE PIXEL STARS MATCHING ui-ref.png */}
      {/* ==================================================================== */}

      {/* Top row stars & crosses */}
      <PixelCrossSvg className="absolute top-[8%] left-[16%] size-3 opacity-60" />
      <PixelCrossSvg className="absolute top-[12%] right-[24%] size-3.5 opacity-75" />
      <PixelCrossSvg className="absolute top-[6%] right-[12%] size-2.5 opacity-50" />

      {/* Left side constellation */}
      <div className="absolute top-[40%] left-[4%] size-1.5 bg-amber-400 opacity-60" />
      <div className="absolute top-[48%] left-[9%] size-1 bg-amber-300 opacity-50" />
      <PixelCrossSvg className="absolute top-[58%] left-[3%] size-3 opacity-70" />
      <div className="absolute top-[70%] left-[8%] size-1 bg-amber-400 opacity-60" />
      <PixelCrossSvg className="absolute top-[82%] left-[4%] size-2.5 opacity-40" />
      <div className="absolute top-[90%] left-[12%] size-1 bg-amber-300 opacity-50" />

      {/* Right side constellation */}
      <div className="absolute top-[22%] right-[4%] size-1.5 bg-amber-400 opacity-50" />
      <PixelCrossSvg className="absolute top-[26%] right-[16%] size-3 opacity-60" />
      <div className="absolute top-[45%] right-[5%] size-1 bg-amber-300 opacity-60" />
      <div className="absolute top-[62%] right-[3%] size-1.5 bg-amber-400 opacity-70" />
      <PixelCrossSvg className="absolute top-[74%] right-[7%] size-3 opacity-50" />
      <div className="absolute bottom-[8%] right-[18%] size-1 bg-amber-300 opacity-40" />
      <div className="absolute bottom-[5%] right-[6%] size-1.5 bg-amber-400 opacity-60" />
    </div>
  );
}
