import type { GameSlug } from "./registry";

/**
 * Production: only games that are finished and approved for players.
 * Add a slug here when a game is ready to ship.
 */
export const productionGames: readonly GameSlug[] = ["ludo"];
