import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const RING_TRANSACTION_TYPES = [
  "signup_bonus",
  "daily_reward",
  "ad_reward",
  "game_reward",
  "purchase",
  "spend",
  "refund",
  "admin_adjustment",
] as const;

export type RingTransactionType = (typeof RING_TRANSACTION_TYPES)[number];

/**
 * Append-only ledger of every Rings movement. Rows are never updated or deleted.
 * `amount` is signed (+ earn, - spend). `balance_after` makes the history auditable on its own.
 * `idempotency_key` makes retries safe, e.g. a payment webhook delivered twice only credits once.
 */
export const ringTransactions = sqliteTable(
  "ring_transactions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    type: text("type").$type<RingTransactionType>().notNull(),
    reason: text("reason"),
    /** What caused this, e.g. referenceType "match" + referenceId "<uuid>", or "payment" + provider id. */
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key").unique(),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("ring_transactions_user_created_idx").on(t.userId, t.createdAt),
    check("ring_transactions_amount_non_zero", sql`${t.amount} <> 0`),
    check(
      "ring_transactions_balance_after_non_negative",
      sql`${t.balanceAfter} >= 0`,
    ),
  ],
);

export type RingTransaction = typeof ringTransactions.$inferSelect;
