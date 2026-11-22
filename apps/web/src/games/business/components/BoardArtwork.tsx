import type { FC } from "react";

export const CenterBankIllustration: FC = () => (
  <svg
    viewBox="0 0 260 240"
    fill="none"
    className="pointer-events-none h-28 w-28 select-none drop-shadow-[0_12px_18px_rgba(15,23,42,0.22)] sm:h-40 sm:w-40 md:h-48 md:w-48 lg:h-56 lg:w-56"
  >
    <polygon points="130,218 28,162 130,106 232,162" fill="#8b857c" />
    <polygon points="130,210 38,158 130,108 222,158" fill="#bfb9ae" />
    <polygon points="130,202 98,184 130,166 162,184" fill="#6ab04c" />
    <polygon points="75,170 52,157 75,144 98,157" fill="#6ab04c" />
    <polygon points="185,170 162,157 185,144 208,157" fill="#5da042" />
    <polygon points="72,156 72,88 130,118 130,186" fill="#ebe3cf" />
    <polygon points="188,156 188,88 130,118 130,186" fill="#d3c9b1" />
    <polygon points="130,58 64,90 130,122 196,90" fill="#f7f3e8" />
    <rect x="82" y="115" width="7" height="45" rx="1.5" fill="#faf7ef" />
    <rect x="98" y="123" width="7" height="45" rx="1.5" fill="#faf7ef" />
    <rect x="114" y="131" width="7" height="45" rx="1.5" fill="#faf7ef" />
    <rect x="140" y="131" width="7" height="45" rx="1.5" fill="#e2dac6" />
    <rect x="156" y="123" width="7" height="45" rx="1.5" fill="#e2dac6" />
    <rect x="172" y="115" width="7" height="45" rx="1.5" fill="#e2dac6" />
    <ellipse cx="130" cy="84" rx="36" ry="16" fill="#d9d0b8" />
    <path d="M94 84 C94 42, 166 42, 166 84 Z" fill="#e5decb" />
    <ellipse cx="118" cy="63" rx="6" ry="4" fill="#ffffff" opacity="0.8" />
  </svg>
);

export const SpecialTileArtwork: FC<{ tileIndex: number; name: string }> = ({
  tileIndex,
  name,
}) => {
  switch (name) {
    case "START":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#f0fdf4] to-[#dcfce7] p-0.5 sm:p-1">
          <div className="flex flex-1 items-center justify-center">
            <svg
              viewBox="0 0 48 42"
              className="h-5 w-6 sm:h-7 sm:w-8 md:h-8 md:w-10"
            >
              <circle cx="24" cy="21" r="16" fill="#bbf7d0" />
              <path
                d="M14 25 A10 10 0 1 1 32 16"
                fill="none"
                stroke="#16a34a"
                strokeWidth="4.2"
                strokeLinecap="round"
              />
              <path d="M35 12 L34 22 L25 18 Z" fill="#16a34a" />
              <circle
                cx="24"
                cy="21"
                r="4.5"
                fill="#facc15"
                stroke="#ca8a04"
                strokeWidth="1.2"
              />
            </svg>
          </div>
          <span className="rounded-full bg-[#16a34a] px-1.5 py-[1px] text-[7px] font-black tracking-wide text-white shadow-xs sm:px-2 sm:py-0.5 sm:text-[9px] md:text-[10px]">
            START
          </span>
        </div>
      );

    case "HARBOR":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#f0f9ff] to-[#e0f2fe] p-0.5 sm:p-1">
          <span className="text-[7px] font-black tracking-tight text-sky-700 sm:text-[8.5px] md:text-[10px]">
            HARBOR
          </span>
          <svg
            viewBox="0 0 48 44"
            className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9"
          >
            {/* Mast */}
            <rect x="23" y="5" width="2.4" height="24" rx="1" fill="#64748b" />
            {/* Main curved sail */}
            <path d="M23 7 Q10 16 11 26 L23 26 Z" fill="#0ea5e9" />
            {/* Front jib sail */}
            <path d="M25.5 10 Q36 18 35 26 L25.5 26 Z" fill="#7dd3fc" />
            {/* Flag */}
            <path d="M25.4 5 L32 7.5 L25.4 10 Z" fill="#f97316" />
            {/* Hull */}
            <path d="M8 28 L40 28 L35 35 L13 35 Z" fill="#ea580c" />
            <path
              d="M11 31 L37 31"
              stroke="#fed7aa"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Ocean wave */}
            <path
              d="M5 38 Q11 35 17 38 T29 38 T43 38"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case "MYSTERY":
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fef3c7] to-[#fde68a] p-1 sm:p-1.5">
          <svg
            viewBox="0 0 48 48"
            className="h-7 w-7 drop-shadow-xs sm:h-10 sm:w-10 md:h-11 md:w-11"
          >
            {/* Back tilted card */}
            <rect
              x="12"
              y="7"
              width="25"
              height="33"
              rx="6"
              transform="rotate(-10 24 24)"
              fill="#f59e0b"
            />
            {/* Front card */}
            <rect
              x="12"
              y="7"
              width="25"
              height="33"
              rx="6"
              transform="rotate(6 24 24)"
              fill="#ffffff"
              stroke="#f59e0b"
              strokeWidth="2.2"
            />
            {/* Question mark */}
            <path
              d="M21 19 C21 15.5 28.5 15.5 28.5 19.5 C28.5 22 25 22.8 25 25.5"
              fill="none"
              stroke="#d97706"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <circle cx="25" cy="30.5" r="2.1" fill="#d97706" />
            {/* Sparkles */}
            <circle cx="8" cy="11" r="2" fill="#f59e0b" />
            <circle cx="42" cy="36" r="1.8" fill="#ea580c" />
          </svg>
        </div>
      );

    case "RAILWAY":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#fef2f2] to-[#fee2e2] p-0.5 sm:p-1">
          <span className="text-[7px] font-black tracking-tight text-rose-700 sm:text-[8.5px] md:text-[10px]">
            RAILWAY
          </span>
          <svg
            viewBox="0 0 48 44"
            className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9"
          >
            {/* Tracks */}
            <path
              d="M10 40 L18 31 M38 40 L30 31"
              stroke="#64748b"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M13 37 H35 M16 34 H32"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Train Body */}
            <rect x="11" y="7" width="26" height="24" rx="6" fill="#ef4444" />
            <rect x="14" y="5" width="20" height="4" rx="2" fill="#b91c1c" />
            {/* Panoramic Window */}
            <rect x="15" y="11" width="18" height="9" rx="2.5" fill="#bae6fd" />
            <path d="M17 13 L21 13 L18 18 Z" fill="#ffffff" opacity="0.65" />
            {/* Headlights */}
            <circle cx="17" cy="25.5" r="2.6" fill="#fef08a" />
            <circle cx="31" cy="25.5" r="2.6" fill="#fef08a" />
            <rect
              x="21.5"
              y="24.5"
              width="5"
              height="2"
              rx="1"
              fill="#fca5a5"
            />
          </svg>
        </div>
      );

    case "JAIL":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#f1f5f9] to-[#e2e8f0] p-0.5 sm:p-1">
          <svg
            viewBox="0 0 48 38"
            className="h-5 w-6 sm:h-7 sm:w-8 md:h-8 md:w-10"
          >
            {/* Cell window backing */}
            <rect
              x="7"
              y="4"
              width="34"
              height="28"
              rx="6"
              fill="#cbd5e1"
              stroke="#475569"
              strokeWidth="2.5"
            />
            <rect x="10" y="7" width="28" height="22" rx="3" fill="#93c5fd" />
            {/* Cute padlock silhouette inside */}
            <rect x="19" y="17" width="10" height="9" rx="2" fill="#f59e0b" />
            <path
              d="M21 17 V14 A3 3 0 0 1 27 14 V17"
              fill="none"
              stroke="#b45309"
              strokeWidth="2.2"
            />
            {/* Iron Bars */}
            <path
              d="M15 5 V31 M21 5 V31 M27 5 V31 M33 5 V31"
              stroke="#334155"
              strokeWidth="2.4"
            />
            <path
              d="M8 18 H40"
              stroke="#475569"
              strokeWidth="1.6"
              opacity="0.55"
            />
          </svg>
          <span className="rounded-full bg-slate-600 px-1.5 py-[1px] text-[7px] font-black tracking-wide text-white shadow-xs sm:px-2 sm:py-0.5 sm:text-[9px] md:text-[10px]">
            JAIL
          </span>
        </div>
      );

    case "ELECTRICITY":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#fefce8] to-[#fef9c3] p-0.5 sm:p-1">
          <span className="text-[6.8px] font-black tracking-tight text-amber-700 sm:text-[8.5px] md:text-[9.5px]">
            POWER
          </span>
          <svg
            viewBox="0 0 48 44"
            className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9"
          >
            {/* Sunburst rays */}
            <path
              d="M24 3 V7 M9 10 L12 13 M39 10 L36 13 M5 21 H9 M39 21 H43"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Glowing bulb glass */}
            <path
              d="M14 20 A10 10 0 1 1 34 20 C34 25 30 27 29 31 H19 C18 27 14 25 14 20 Z"
              fill="#fde047"
              stroke="#eab308"
              strokeWidth="1.8"
            />
            {/* Lightning bolt inside */}
            <path
              d="M25 13 L20 21 H24.5 L22.5 27 L28.5 19 H24 Z"
              fill="#ea580c"
            />
            {/* Metallic screw base */}
            <rect
              x="19"
              y="31"
              width="10"
              height="3.5"
              rx="1.5"
              fill="#94a3b8"
            />
            <rect
              x="20.5"
              y="35.5"
              width="7"
              height="3.5"
              rx="1.7"
              fill="#64748b"
            />
          </svg>
        </div>
      );

    case "AUCTION":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#fff7ed] to-[#ffedd5] p-0.5 sm:p-1">
          <svg
            viewBox="0 0 48 38"
            className="h-5 w-6 sm:h-7 sm:w-8 md:h-8 md:w-10"
          >
            {/* Sound block */}
            <rect x="7" y="29" width="22" height="5" rx="2.5" fill="#78350f" />
            <rect
              x="10"
              y="26"
              width="16"
              height="3.5"
              rx="1.5"
              fill="#b45309"
            />
            {/* Gavel handle */}
            <line
              x1="23"
              y1="15"
              x2="40"
              y2="30"
              stroke="#d97706"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
            {/* Gavel head */}
            <g transform="rotate(-38 22 14)">
              <rect x="13" y="9" width="18" height="10" rx="3" fill="#92400e" />
              <rect
                x="12"
                y="8"
                width="3.5"
                height="12"
                rx="1.5"
                fill="#fbbf24"
              />
              <rect
                x="28.5"
                y="8"
                width="3.5"
                height="12"
                rx="1.5"
                fill="#fbbf24"
              />
            </g>
            {/* Impact sparkles */}
            <path
              d="M9 20 L12 22 M7 24 H10"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="rounded-full bg-[#d97706] px-1.5 py-[1px] text-[6.8px] font-black tracking-wide text-white shadow-xs sm:px-2 sm:py-0.5 sm:text-[8.5px] md:text-[9.5px]">
            AUCTION
          </span>
        </div>
      );

    case "AIRPORT":
    default:
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-gradient-to-b from-[#ecfeff] to-[#cffafe] p-0.5 sm:p-1">
          <span className="text-[7px] font-black tracking-tight text-cyan-800 sm:text-[8.5px] md:text-[10px]">
            AIRPORT
          </span>
          <svg
            viewBox="0 0 48 44"
            className="h-6 w-6 sm:h-8 sm:w-8 md:h-9 md:w-9"
          >
            {/* Soft clouds */}
            <circle cx="13" cy="34" r="5" fill="#ffffff" />
            <circle cx="19" cy="35" r="4" fill="#ffffff" />
            <circle cx="35" cy="13" r="4" fill="#ffffff" />
            {/* Sleek jetliner */}
            <path
              d="M8 25 L38 11 C40 10 42 12 40 14 L29 22 L33 34 L28 36 L22 25 L14 29 L13 34 L10 34 L10 27 Z"
              fill="#0284c7"
              stroke="#0369a1"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M18 22 L34 14"
              stroke="#7dd3fc"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">{tileIndex}</span>
        </div>
      );
  }
};
