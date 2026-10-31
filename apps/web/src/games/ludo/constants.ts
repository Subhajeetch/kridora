import {
  LUDO_COLOR_STARTS,
  LUDO_STAR_SQUARES,
  type LudoColor,
} from "@kridora/shared";
import type { BoardCoordinate, LudoSeatDefinition } from "./types";

/**
 * 52-square perimeter track in clockwise order starting at Red's start [6, 1] (index 0).
 * Each player traverses 51 squares (progress 0..50), ending on their entry arrow before
 * turning directly into their 5-square safe home column (progress 51..55) and goal (56).
 * All coordinates are [row, column].
 */
export const MAIN_TRACK: ReadonlyArray<BoardCoordinate> = [
  // Red arm top row moving right (0..4)
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  // Top arm left col moving up (5..10)
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  // Top middle turn / Green entry arrow (11)
  [0, 7],
  // Top arm right col moving down (12..17) - index 13 is Green start [1, 8]
  [0, 8],
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  // Right arm top row moving right (18..23)
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  // Right middle turn / Yellow entry arrow (24)
  [7, 14],
  // Right arm bottom row moving left (25..30) - index 26 is Yellow start [8, 13]
  [8, 14],
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  // Bottom arm right col moving down (31..36)
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  // Bottom middle turn / Blue entry arrow (37)
  [14, 7],
  // Bottom arm left col moving up (38..43) - index 39 is Blue start [13, 6]
  [14, 6],
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  // Left arm bottom row moving left (44..49)
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  // Left middle turn / Red entry arrow (50) and corner before Red start (51)
  [7, 0],
  [6, 0],
];

export const BOARD_TRACK = MAIN_TRACK;
export const GREY_STAR_INDICES = new Set<number>(LUDO_STAR_SQUARES);

export const DICE_ROTATIONS: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  6: "rotateX(0deg) rotateY(180deg)",
  3: "rotateX(0deg) rotateY(-90deg)",
  4: "rotateX(0deg) rotateY(90deg)",
  2: "rotateX(-90deg) rotateY(0deg)",
  5: "rotateX(90deg) rotateY(0deg)",
};

/**
 * 4 Corner Seats in classic Ludo layout:
 * - Seat 0: Top-Left     (Red    / coral)
 * - Seat 1: Top-Right    (Green  / mint)
 * - Seat 2: Bottom-Right (Yellow / sunshine)
 * - Seat 3: Bottom-Left  (Blue   / sky)
 *
 * `homeColumn` has the exact 5 safe boxes (steps 51..55) before the center goal (step 56).
 */
export const SEAT_DEFINITIONS: Record<LudoColor, LudoSeatDefinition> = {
  coral: {
    id: 0,
    color: "coral",
    name: "Red",
    defaultLabel: "Player1",
    boardHex: "#ff1a1a",
    socketHex: "#c81919",
    pawnLight: "#ff6b6b",
    pawnMid: "#ef1a1a",
    pawnDark: "#870707",
    rimStroke: "#520303",
    startTrackIdx: LUDO_COLOR_STARTS.coral,
    homeColumn: [
      [7, 1],
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
    ],
    goalCoord: [7.5, 6.45],
    yardCoords: [
      [2, 2],
      [2, 4],
      [4, 2],
      [4, 4],
    ],
  },
  mint: {
    id: 1,
    color: "mint",
    name: "Green",
    defaultLabel: "Player2",
    boardHex: "#12b84a",
    socketHex: "#0b7a30",
    pawnLight: "#5ff58f",
    pawnMid: "#12b84a",
    pawnDark: "#065f22",
    rimStroke: "#043b15",
    startTrackIdx: LUDO_COLOR_STARTS.mint,
    homeColumn: [
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
    ],
    goalCoord: [6.45, 7.5],
    yardCoords: [
      [2, 11],
      [2, 13],
      [4, 11],
      [4, 13],
    ],
  },
  sunshine: {
    id: 2,
    color: "sunshine",
    name: "Yellow",
    defaultLabel: "Player3",
    boardHex: "#f6ce00",
    socketHex: "#c5a500",
    pawnLight: "#fff066",
    pawnMid: "#eab308",
    pawnDark: "#854d0e",
    rimStroke: "#452404",
    startTrackIdx: LUDO_COLOR_STARTS.sunshine,
    homeColumn: [
      [7, 13],
      [7, 12],
      [7, 11],
      [7, 10],
      [7, 9],
    ],
    goalCoord: [7.5, 8.55],
    yardCoords: [
      [11, 11],
      [11, 13],
      [13, 11],
      [13, 13],
    ],
  },
  sky: {
    id: 3,
    color: "sky",
    name: "Blue",
    defaultLabel: "Player4",
    boardHex: "#0098ec",
    socketHex: "#006ca8",
    pawnLight: "#67d4ff",
    pawnMid: "#0098ec",
    pawnDark: "#004d80",
    rimStroke: "#022a47",
    startTrackIdx: LUDO_COLOR_STARTS.sky,
    homeColumn: [
      [13, 7],
      [12, 7],
      [11, 7],
      [10, 7],
      [9, 7],
    ],
    goalCoord: [8.55, 7.5],
    yardCoords: [
      [11, 2],
      [11, 4],
      [13, 2],
      [13, 4],
    ],
  },
};

/** Subtle spreads inside each home triangle when multiple pawns reach step 56. */
export const GOAL_SLOT_OFFSETS: Record<
  LudoColor,
  ReadonlyArray<BoardCoordinate>
> = {
  coral: [
    [-0.36, -0.08],
    [0.36, -0.08],
    [-0.14, 0.16],
    [0.14, 0.16],
  ],
  mint: [
    [-0.08, -0.36],
    [-0.08, 0.36],
    [0.16, -0.14],
    [0.16, 0.14],
  ],
  sunshine: [
    [-0.36, 0.08],
    [0.36, 0.08],
    [-0.14, -0.16],
    [0.14, -0.16],
  ],
  sky: [
    [0.08, -0.36],
    [0.08, 0.36],
    [-0.16, -0.14],
    [-0.16, 0.14],
  ],
};

export const COLOR_ORDER: LudoColor[] = ["coral", "mint", "sunshine", "sky"];

/** Entry arrows [row, col] pointing directly into each color's 5-box home lane. */
export const ENTRY_ARROWS: Record<string, { hex: string; rot: number }> = {
  "7,0": { hex: "#ff1a1a", rot: 0 },
  "0,7": { hex: "#12b84a", rot: 90 },
  "7,14": { hex: "#f6ce00", rot: 180 },
  "14,7": { hex: "#0098ec", rot: 270 },
};

export interface StaticBoardCell {
  key: string;
  row: number;
  col: number;
  bg: string;
  kind: "plain" | "home" | "start" | "star" | "arrow";
  arrowHex?: string;
  arrowRot?: number;
}

/** Precomputed once at module load so LudoBoard never rebuilds 15x15 grid metadata during animations. */
export const STATIC_BOARD_CELLS: ReadonlyArray<StaticBoardCell> = (() => {
  const trackMap = new Map<string, number>();
  BOARD_TRACK.forEach(([r, c], idx) => {
    trackMap.set(`${r},${c}`, idx);
  });

  const homeMap = new Map<string, string>();
  const startOwnerByIdx = new Map<number, string>();
  for (const seat of Object.values(SEAT_DEFINITIONS)) {
    startOwnerByIdx.set(seat.startTrackIdx, seat.boardHex);
    for (const [r, c] of seat.homeColumn) {
      homeMap.set(`${r},${c}`, seat.boardHex);
    }
  }

  const cells: StaticBoardCell[] = [];
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const inTL = row < 6 && col < 6;
      const inTR = row < 6 && col >= 9;
      const inBL = row >= 9 && col < 6;
      const inBR = row >= 9 && col >= 9;
      const inCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8;
      if (inTL || inTR || inBL || inBR || inCenter) continue;

      const key = `${row},${col}`;
      const homeHex = homeMap.get(key);
      if (homeHex) {
        cells.push({ key, row, col, bg: homeHex, kind: "home" });
        continue;
      }

      const trackIdx = trackMap.get(key);
      if (trackIdx !== undefined) {
        const startHex = startOwnerByIdx.get(trackIdx);
        if (startHex) {
          cells.push({ key, row, col, bg: startHex, kind: "start" });
          continue;
        }
        if (GREY_STAR_INDICES.has(trackIdx)) {
          cells.push({ key, row, col, bg: "#ced8e2", kind: "star" });
          continue;
        }
        const arrow = ENTRY_ARROWS[key];
        if (arrow) {
          cells.push({
            key,
            row,
            col,
            bg: "#ffffff",
            kind: "arrow",
            arrowHex: arrow.hex,
            arrowRot: arrow.rot,
          });
          continue;
        }
      }

      cells.push({ key, row, col, bg: "#ffffff", kind: "plain" });
    }
  }

  return cells;
})();
