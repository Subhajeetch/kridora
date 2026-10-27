import { createContext, useContext } from "react";

export interface GameLayoutContextValue {
  /** True when a player is actively playing a game inside a room (top header hidden). */
  inGameMode: boolean;
  setInGameMode: (value: boolean) => void;
}

const defaultLayoutValue: GameLayoutContextValue = {
  inGameMode: false,
  setInGameMode: () => {},
};

export const GameLayoutContext =
  createContext<GameLayoutContextValue>(defaultLayoutValue);

export function useGameLayout(): GameLayoutContextValue {
  return useContext(GameLayoutContext);
}
