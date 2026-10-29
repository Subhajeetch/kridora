import {
  LUDO_COLOR_STARTS,
  LUDO_STAR_SQUARES,
  type LudoColor,
} from "@kridora/shared";
import type { LudoSeatDefinition } from "./types";

/**
 * 52-square perimeter track in clockwise order starting at Red's start [6, 1] (index 0).
 * All coordinates are [row, column].
 */
export const MAIN_TRACK: Array<readonly [number, number]> = [
  // Red arm top row moving right (0..4)
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Top arm left col moving up (5..10)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // Top middle turn (11)
  [0, 7],
  // Top arm right col moving down (12..17) - index 13 is Green start [1,8]
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Right arm top row moving right (18..23)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // Right middle turn (24)
  [7, 14],
  // Right arm bottom row moving left (25..30) - index 26 is Yellow start [8,13]
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Bottom arm right col moving down (31..36)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // Bottom middle turn (37)
  [14, 7],
  // Bottom arm left col moving up (38..43) - index 39 is Blue start [13,6]
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Left arm bottom row moving left (44..49)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // Left middle turn (50) and corner before Red start (51)
  [7, 0], [6, 0]
];

export const BOARD_TRACK = MAIN_TRACK;
export const GREY_STAR_INDICES = new Set(LUDO_STAR_SQUARES);

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
 * - Seat 0: Top-Left  (Red    / coral)
 * - Seat 1: Top-Right (Green  / mint)
 * - Seat 2: Bottom-Right (Yellow / sunshine)
 * - Seat 3: Bottom-Left  (Blue   / sky)
 *
 * Coordinates are [row, column].
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
      [7, 6],
    ],
    goalCoord: [7.5, 6.42],
    yardCoords: [
      [2.05, 2.05],
      [2.05, 3.95],
      [3.95, 2.05],
      [3.95, 3.95],
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
      [6, 7],
    ],
    goalCoord: [6.42, 7.5],
    yardCoords: [
      [2.05, 11.05],
      [2.05, 12.95],
      [3.95, 11.05],
      [3.95, 12.95],
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
      [7, 8],
    ],
    goalCoord: [7.5, 8.58],
    yardCoords: [
      [11.05, 11.05],
      [11.05, 12.95],
      [12.95, 11.05],
      [12.95, 12.95],
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
      [8, 7],
    ],
    goalCoord: [8.58, 7.5],
    yardCoords: [
      [11.05, 2.05],
      [11.05, 3.95],
      [12.95, 2.05],
      [12.95, 3.95],
    ],
  },
};

export const COLOR_ORDER: LudoColor[] = ["coral", "mint", "sunshine", "sky"];

/** Entry arrows [row, col] */
export const ENTRY_ARROWS: Record<string, { hex: string; rot: number }> = {
  "7,0": { hex: "#ff1a1a", rot: 0 },
  "0,7": { hex: "#12b84a", rot: 90 },
  "7,14": { hex: "#f6ce00", rot: 180 },
  "14,7": { hex: "#0098ec", rot: 270 },
};
