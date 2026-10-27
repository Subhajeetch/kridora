import {
  getEnabledGames,
  isGameEnabled,
  type AppEnvironment,
  type GameSlug,
} from "@kridora/shared";

/**
 * Production builds use packages/shared/src/games/config.production.ts,
 * everything else (vite dev) uses config.development.ts.
 */
export const APP_ENV: AppEnvironment = import.meta.env.PROD
  ? "production"
  : "development";

/** Games shown on /games. */
export const enabledGames = getEnabledGames(APP_ENV);

export function findEnabledGame(slug: string | undefined): GameSlug | null {
  return slug && isGameEnabled(APP_ENV, slug) ? slug : null;
}
