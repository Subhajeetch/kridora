import {
  getLudoTrackSquare,
  LUDO_HOME_STEP,
  LUDO_HOME_LANE_START,
  type LudoColor,
  type LudoPlayerState,
} from "@kridora/shared";
import { BOARD_TRACK, SEAT_DEFINITIONS } from "./constants";
import type { BoardCoordinate } from "./types";

export const HOP_MS = 220;
export const LAUNCH_MS = 380;
export const CAPTURE_MS = 440;
export const ROLL_MS = 560;

export function boardTurns(color?: LudoColor): number {
  return color ? (3 - SEAT_DEFINITIONS[color].id + 4) % 4 : 0;
}

export function rotateCoord(
  coord: BoardCoordinate,
  turns: number,
): BoardCoordinate {
  let [row, col] = coord;
  for (let i = 0; i < turns; i++) [row, col] = [col, 15 - row];
  return [row, col];
}

export function tokenCoord(
  color: LudoColor,
  index: number,
  step: number,
): BoardCoordinate {
  const seat = SEAT_DEFINITIONS[color];
  if (step < 0) return seat.yardCoords[index]!;
  if (step >= LUDO_HOME_STEP) return seat.goalCoord;
  if (step >= LUDO_HOME_LANE_START) {
    const [r, c] = seat.homeColumn[step - LUDO_HOME_LANE_START]!;
    return [r + 0.5, c + 0.5];
  }
  const [r, c] = BOARD_TRACK[getLudoTrackSquare(color, step)!]!;
  return [r + 0.5, c + 0.5];
}

export function tokenRoute(
  color: LudoColor,
  index: number,
  from: number,
  to: number,
): BoardCoordinate[] {
  const route = [tokenCoord(color, index, from)];
  if (to < 0) return [...route, tokenCoord(color, index, to)];
  for (let step = Math.max(0, from + 1); step <= to; step++)
    route.push(tokenCoord(color, index, step));
  return route;
}

export type TokenPlacement = { coord: BoardCoordinate; scale: number };

/** Fit every occupant into its own slot, including mixed-colour safe-square stacks. */
export function tokenLayout(
  players: readonly LudoPlayerState[],
  turns: number,
): Map<string, TokenPlacement> {
  const groups = new Map<
    string,
    { id: string; coord: BoardCoordinate; home: boolean }[]
  >();
  for (const player of players)
    player.tokens.forEach((step, index) => {
      const coord = rotateCoord(tokenCoord(player.color, index, step), turns);
      const key = step < 0 ? `${player.userId}:${index}` : coord.join(":");
      const group = groups.get(key) ?? [];
      group.push({
        id: `${player.userId}:${index}`,
        coord,
        home: step === LUDO_HOME_STEP,
      });
      groups.set(key, group);
    });
  const result = new Map<string, TokenPlacement>();
  for (const group of groups.values()) {
    const cols = Math.min(4, group.length);
    const rows = Math.ceil(group.length / cols);
    group.forEach((token, index) => {
      const countInRow = Math.min(
        cols,
        group.length - Math.floor(index / cols) * cols,
      );
      const scale =
        group.length === 1
          ? token.home
            ? 0.72
            : 1
          : Math.min(0.94 / cols, 0.9 / rows);
      const coord: BoardCoordinate = [
        token.coord[0] +
          ((Math.floor(index / cols) - (rows - 1) / 2) * 0.9) / rows,
        token.coord[1] +
          (((index % cols) - (countInRow - 1) / 2) * 0.94) / cols,
      ];
      result.set(token.id, { coord, scale });
    });
  }
  return result;
}

export function tokenTransform([row, col]: BoardCoordinate, scale = 1): string {
  return `translate3d(${(col - 0.5) * 100}%, ${(row - 0.5) * 100}%, 0) scale(${scale})`;
}
