import type { GameSlug } from "@kridora/shared";
import { fateByAiGameModule } from "./fatebyai";
import { ludoGameModule } from "./ludo";
import { truthAndDareGameModule } from "./truth-and-dare";
import { businessGameModule } from "./business";
import type { ServerGameModule } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SERVER_GAME_MODULES: Record<GameSlug, ServerGameModule<any>> = {
  ludo: ludoGameModule,
  fatebyai: fateByAiGameModule,
  truthAndDare: truthAndDareGameModule,
  business: businessGameModule,
};

export function getServerGameModule(slug: GameSlug): ServerGameModule<unknown> {
  return SERVER_GAME_MODULES[slug] as ServerGameModule<unknown>;
}
