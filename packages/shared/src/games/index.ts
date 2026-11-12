import { developmentGames } from "./config.development";
import { productionGames } from "./config.production";
import { GAME_DEFINITIONS, isKnownGameSlug, type GameSlug } from "./registry";
import type { GameDefinition } from "./types";

export type AppEnvironment = "development" | "production";

/** Picks the production config in production and the development config everywhere else. */
export function getEnabledGameSlugs(env: AppEnvironment): readonly GameSlug[] {
  return env === "production" ? productionGames : developmentGames;
}

export function getEnabledGames(env: AppEnvironment): GameDefinition[] {
  return getEnabledGameSlugs(env).map((slug) => GAME_DEFINITIONS[slug]);
}

export function isGameEnabled(
  env: AppEnvironment,
  slug: string,
): slug is GameSlug {
  return isKnownGameSlug(slug) && getEnabledGameSlugs(env).includes(slug);
}

export function isProductionGame(slug: string): boolean {
  return (
    isKnownGameSlug(slug) &&
    (productionGames as readonly string[]).includes(slug)
  );
}

export function getGameDefinition(slug: GameSlug): GameDefinition {
  return GAME_DEFINITIONS[slug];
}

export { GAME_DEFINITIONS, isKnownGameSlug } from "./registry";
export type { GameSlug } from "./registry";
export type {
  GameDefinition,
  StartContext,
  GameScreenshot,
  GameHowToPlayStep,
  GameControlHint,
} from "./types";
export { evaluateStartRequirements } from "./requirements";
export type {
  StartCheck,
  UnmetRequirement,
  UnmetRequirementCode,
} from "./requirements";
export * from "./ludo";
export * from "./truth-and-dare";
export * from "./business";
export { developmentGames } from "./config.development";
export { productionGames } from "./config.production";
