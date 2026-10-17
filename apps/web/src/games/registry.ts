import type { GameSlug } from "@kridora/shared"
import { lazy, type ComponentType, type LazyExoticComponent } from "react"
import type { GameComponentProps } from "./types"

/**
 * Maps every game slug to its React entry point. Typed as Record<GameSlug, ...>, so adding a game to
 * packages/shared/src/games/registry.ts without registering its component here is a compile error.
 * Components are lazy-loaded so players only download the game they open.
 */
export const gameComponents: Record<GameSlug, LazyExoticComponent<ComponentType<GameComponentProps>>> = {
  monopoly: lazy(() => import("./monopoly/main")),
  fatebyai: lazy(() => import("./fatebyai/main")),
}
