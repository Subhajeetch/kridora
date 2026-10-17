export * from "./client";
export * as schema from "./schema";
export type { PlayerProfile, PlayerSettings, RingTransaction, RingTransactionType, Match, MatchPlayer } from "./schema";
export * from "./services/profiles";
export * from "./services/rings";
export * from "./services/matches";

// Re-exported so apps use the exact drizzle-orm instance this package was built against.
export { and, eq, gt, lt, notExists, sql } from "drizzle-orm";
