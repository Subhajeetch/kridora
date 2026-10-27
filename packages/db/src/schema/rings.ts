import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const ringTransactionType = pgEnum("ring_transaction_type", [
  "signup_bonus",
  "daily_reward",
  "ad_reward",
  "game_reward",
  "purchase",
  "spend",
  "refund",
  "admin_adjustment",
]);

/**
 * Append-only ledger of every Rings movement. Rows are never updated or deleted.
 * `amount` is signed (+ earn, - spend). `balance_after` makes the history auditable on its own.
 * `idempotency_key` makes retries safe, e.g. a payment webhook delivered twice only credits once.
 */
export const ringTransactions = pgTable(
  "ring_transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    // RESTRICT: a user who has financial history cannot be hard-deleted by accident.
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amount: bigint({ mode: "number" }).notNull(),
    balanceAfter: bigint({ mode: "number" }).notNull(),
    type: ringTransactionType().notNull(),
    reason: text(),
    /** What caused this, e.g. referenceType "match" + referenceId "<uuid>", or "payment" + provider id. */
    referenceType: text(),
    referenceId: text(),
    idempotencyKey: text().unique(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
export type RingTransactionType =
  (typeof ringTransactionType.enumValues)[number];
