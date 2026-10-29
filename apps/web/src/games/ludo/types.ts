import type { LudoColor } from "@kridora/shared";

export type BoardCoordinate = readonly [number, number];

export interface LudoSeatDefinition {
  id: number;
  color: LudoColor;
  name: string;
  defaultLabel: string;
  boardHex: string;
  socketHex: string;
  pawnLight: string;
  pawnMid: string;
  pawnDark: string;
  rimStroke: string;
  startTrackIdx: number;
  homeColumn: BoardCoordinate[];
  goalCoord: BoardCoordinate;
  yardCoords: BoardCoordinate[];
}

export interface MovementPath {
  id: number;
  points: BoardCoordinate[];
  step: number;
  launchFrom?: BoardCoordinate;
}

export interface CapturedReturnPath {
  id: number;
  points: BoardCoordinate[];
  step: number;
}

export interface DragState {
  tokenId: string;
  tokenIndex: number;
  playerId: string;
  color: LudoColor;
  x: number;
  y: number;
  startClientX: number;
  startClientY: number;
  pointerId: number;
}
