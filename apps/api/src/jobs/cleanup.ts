import { and, eq, gt, lt, notExists, schema, sql } from "@kridora/db";
import { db } from "../lib/db";

const GUEST_MIN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes guest (anonymous) users that have no live session and never touched the Rings ledger.
 * Their profile rows cascade away; match history of other players is kept (user_id becomes NULL).
 * Returns how many guests were removed.
 */
export async function deleteStaleGuests(): Promise<number> {
  const now = new Date();
  const olderThan = new Date(now.getTime() - GUEST_MIN_AGE_MS);

  const removed = await db
    .delete(schema.user)
    .where(
      and(
        eq(schema.user.isAnonymous, true),
        lt(schema.user.createdAt, olderThan),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.session)
            .where(and(eq(schema.session.userId, schema.user.id), gt(schema.session.expiresAt, now))),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.ringTransactions)
            .where(eq(schema.ringTransactions.userId, schema.user.id)),
        ),
      ),
    )
    .returning({ id: schema.user.id });

  return removed.length;
}
