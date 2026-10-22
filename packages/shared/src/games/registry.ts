import { RESERVED_SLUGS } from "../constants";
import type { GameDefinition } from "./types";

/**
 * Every game that exists in the codebase. Whether a game is actually visible to players is decided by
 * `config.development.ts` / `config.production.ts`, not by this file.
 *
 * To add a game: add its definition here, add its slug to the config file(s), and register its
 * React component in apps/web/src/games/registry.ts.
 */
export const GAME_DEFINITIONS = {
  monopoly: {
    slug: "monopoly",
    name: "Monopoly",
    tagline: "Buy, trade and bankrupt your friends.",
    description:
      "Roll the dice, buy properties, build houses and drive everyone else into bankruptcy. Last player standing wins.",
    accent: "#f43f5e",
    playTime: "60-120 min",
    minPlayers: 2,
    maxPlayers: 6,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
  },
  fatebyai: {
    slug: "fatebyai",
    name: "Fate by AI",
    tagline: "An AI narrator decides how your story ends.",
    description:
      "Everyone makes a choice, the AI weaves them into one story, and fate decides who comes out on top.",
    accent: "#8b5cf6",
    playTime: "20-40 min",
    minPlayers: 2,
    maxPlayers: 8,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
  },
  ludo: {
    slug: "ludo",
    name: "Ludo",
    tagline: "A little luck. A lot of friendly rivalry.",
    description:
      "Race four pieces around the board, send rivals back to their yards and be the first to bring every piece home.",
    accent: "#fb7185",
    playTime: "15-30 min",
    minPlayers: 2,
    maxPlayers: 4,
    requirements: { allPlayersReady: true, allPlayersConnected: true },
  },
} satisfies Record<string, GameDefinition>;

export type GameSlug = keyof typeof GAME_DEFINITIONS;

// Fail fast (at import time) on slugs that would collide with real routes or break URLs.
for (const slug of Object.keys(GAME_DEFINITIONS)) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid game slug "${slug}": use lowercase letters, numbers and dashes only.`);
  }
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    throw new Error(`Game slug "${slug}" is reserved by the app router.`);
  }
}

export function isKnownGameSlug(slug: string): slug is GameSlug {
  return Object.hasOwn(GAME_DEFINITIONS, slug);
}
