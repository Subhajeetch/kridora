import type { GameSlug } from "@kridora/shared";
import type { ComponentType, LazyExoticComponent } from "react";
import { lazyWithRetry } from "@/lib/chunk-reload";
import type { GameComponentProps } from "./types";

type GameLoader = () => Promise<{ default: ComponentType<GameComponentProps> }>;

const gameLoaders: Record<GameSlug, GameLoader> = {
  fatebyai: () => import("./fatebyai/main"),
  ludo: () => import("./ludo/main"),
  truthAndDare: () => import("./truth-and-dare/main"),
  business: () => import("./business/main"),
};

/** Preload game component code ahead of launch so that transition into active gameplay is instant. */
export function preloadGame(slug: GameSlug): Promise<unknown> {
  const loader = gameLoaders[slug];
  if (!loader) return Promise.resolve();
  return loader();
}

/**
 * Maps every game slug to its React entry point. Typed as Record<GameSlug, ...>, so adding a game to
 * packages/shared/src/games/registry.ts without registering its component here is a compile error.
 * Components are lazy-loaded so players only download the game they open.
 */
export const gameComponents: Record<
  GameSlug,
  LazyExoticComponent<ComponentType<GameComponentProps>>
> = {
  fatebyai: lazyWithRetry(gameLoaders.fatebyai),
  ludo: lazyWithRetry(gameLoaders.ludo),
  truthAndDare: lazyWithRetry(gameLoaders.truthAndDare),
  business: lazyWithRetry(gameLoaders.business),
};
