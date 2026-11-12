import type { FC } from "react";

export const CenterBankIllustration: FC = () => (
  <svg
    viewBox="0 0 260 240"
    fill="none"
    className="h-44 w-44 select-none drop-shadow-md sm:h-56 sm:w-56 pointer-events-none"
  >
    {/* Isometric Base Platform */}
    <polygon points="130,218 28,162 130,106 232,162" fill="#8b857c" />
    <polygon points="130,210 38,158 130,108 222,158" fill="#b7b1a6" />
    {/* Green Courtyards */}
    <polygon points="130,202 98,184 130,166 162,184" fill="#6ab04c" />
    <polygon points="75,170 52,157 75,144 98,157" fill="#6ab04c" />
    {/* Main Left & Right Building Walls */}
    <polygon points="72,156 72,88 130,118 130,186" fill="#e6dec8" />
    <polygon points="188,156 188,88 130,118 130,186" fill="#cfc5ad" />
    {/* Roof Cornice */}
    <polygon points="130,58 64,90 130,122 196,90" fill="#f3efe3" />
    {/* Classical Portico Pillars Left & Right */}
    <rect x="82" y="115" width="7" height="45" fill="#f7f4eb" />
    <rect x="98" y="123" width="7" height="45" fill="#f7f4eb" />
    <rect x="114" y="131" width="7" height="45" fill="#f7f4eb" />
    <rect x="140" y="131" width="7" height="45" fill="#ded6c1" />
    <rect x="156" y="123" width="7" height="45" fill="#ded6c1" />
    <rect x="172" y="115" width="7" height="45" fill="#ded6c1" />
    {/* Dome Drum & Half-Sphere Dome */}
    <ellipse cx="130" cy="84" rx="36" ry="16" fill="#d9d0b8" />
    <path d="M94 84 C94 42, 166 42, 166 84 Z" fill="#ded6c3" />
    <ellipse cx="118" cy="63" rx="6" ry="4" fill="#ffffff" opacity="0.75" />
  </svg>
);

export const SpecialTileArtwork: FC<{ tileIndex: number; name: string }> = ({
  tileIndex,
  name,
}) => {
  switch (name) {
    case "START":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <div className="flex flex-1 items-center justify-center">
            <svg viewBox="0 0 40 30" className="h-6 w-8">
              <path
                d="M8 22 A10 10 0 1 1 24 12 L29 12 L22 20 L15 12 L20 12"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="rounded-full bg-slate-400 px-2 py-0.5 text-[9px] font-black tracking-wider text-white">
            START
          </span>
        </div>
      );

    case "HARBOR":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <span className="text-[8px] font-black tracking-wider text-lime-600">
            HARBOR
          </span>
          <svg viewBox="0 0 36 36" className="h-7 w-7">
            <path d="M18 5 L18 25 L8 25 Z" fill="#38bdf8" />
            <path d="M19 8 L29 25 L19 25 Z" fill="#bae6fd" />
            <path d="M6 26 L30 26 L26 31 L10 31 Z" fill="#ea580c" />
          </svg>
        </div>
      );

    case "MYSTERY":
      return (
        <div className="flex h-full w-full items-center justify-center bg-white p-1.5">
          <div className="flex h-full w-full items-center justify-center rounded border border-slate-200 shadow-inner">
            <span className="text-2xl font-black text-slate-400">?</span>
          </div>
        </div>
      );

    case "RAILWAY":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <span className="text-[8px] font-black tracking-wider text-emerald-700">
            RAILWAY
          </span>
          <svg viewBox="0 0 36 36" className="h-7 w-7">
            <rect x="8" y="8" width="20" height="18" rx="4" fill="#ef4444" />
            <rect x="11" y="11" width="14" height="6" rx="1" fill="#e2e8f0" />
            <path
              d="M6 31 L12 26 M30 31 L24 26"
              stroke="#64748b"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      );

    case "JAIL":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <svg viewBox="0 0 36 28" className="h-6 w-8">
            <rect x="6" y="6" width="24" height="18" rx="2" fill="#93c5fd" />
            <path
              d="M11 6V24M16 6V24M21 6V24M26 6V24"
              stroke="#1e3a8a"
              strokeWidth="1.8"
            />
          </svg>
          <span className="rounded-full bg-slate-400 px-2 py-0.5 text-[9px] font-black tracking-wider text-white">
            JAIL
          </span>
        </div>
      );

    case "ELECTRICITY":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <span className="text-[7px] font-black tracking-tight text-amber-600">
            ELECTRICITY
          </span>
          <svg viewBox="0 0 36 36" className="h-7 w-7">
            <circle cx="18" cy="15" r="9" fill="#fde047" />
            <rect x="14" y="23" width="8" height="5" rx="1" fill="#94a3b8" />
            <path
              d="M15 15 L18 10 L21 15"
              stroke="#ca8a04"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
      );

    case "AUCTION":
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <svg viewBox="0 0 36 28" className="h-6 w-7">
            <rect
              x="14"
              y="4"
              width="12"
              height="6"
              rx="1"
              transform="rotate(-30 14 4)"
              fill="#92400e"
            />
            <line
              x1="16"
              y1="10"
              x2="28"
              y2="22"
              stroke="#b45309"
              strokeWidth="3"
            />
            <ellipse cx="12" cy="22" rx="7" ry="2.5" fill="#78350f" />
          </svg>
          <span className="rounded-full bg-slate-400 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white">
            AUCTION
          </span>
        </div>
      );

    case "AIRPORT":
    default:
      return (
        <div className="flex h-full w-full flex-col items-center justify-between bg-white p-1">
          <span className="text-[8px] font-black tracking-wider text-emerald-700">
            AIRPORT
          </span>
          <svg viewBox="0 0 36 36" className="h-7 w-7">
            <path
              d="M6 22 L30 12 L26 26 L18 21 L12 26 Z"
              fill="#38bdf8"
              stroke="#0284c7"
              strokeWidth="1.2"
            />
          </svg>
          <span className="sr-only">{tileIndex}</span>
        </div>
      );
  }
};

export const SingleDieFace: FC<{ value: number; rolling: boolean }> = ({
  value,
  rolling,
}) => {
  const pipsByValue: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [
      [28, 28],
      [72, 72],
    ],
    3: [
      [26, 26],
      [50, 50],
      [74, 74],
    ],
    4: [
      [28, 28],
      [72, 28],
      [28, 72],
      [72, 72],
    ],
    5: [
      [26, 26],
      [74, 26],
      [50, 50],
      [26, 74],
      [74, 74],
    ],
    6: [
      [28, 24],
      [72, 24],
      [28, 50],
      [72, 50],
      [28, 76],
      [72, 76],
    ],
  };

  const pips = pipsByValue[value] ?? pipsByValue[1]!;

  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-sky-400/70 bg-sky-400/20 p-1.5 shadow-[0_0_20px_rgba(56,189,248,0.25)] ${
        rolling ? "animate-spin" : ""
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full rounded-xl bg-white shadow-inner"
      >
        {pips.map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={value === 1 ? 12 : 9}
            fill={value === 1 || value === 6 ? "#e11d48" : "#0f172a"}
          />
        ))}
      </svg>
    </div>
  );
};
