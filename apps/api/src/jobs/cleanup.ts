import { and, eq, gt, inArray, lt, notExists, schema, sql } from "@kridora/db";
import { db } from "../lib/db";

const GUEST_MAX_IDLE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Deletes guest (anonymous) users that have no live session and have been offline or logged out for 5+ days.
 * Cascades to player_profiles and sessions; prevents database bloat from temporary visitors.
 * Returns how many guest accounts were permanently removed.
 */
export async function deleteStaleGuests(): Promise<number> {
  const now = new Date();
  const olderThan = new Date(now.getTime() - GUEST_MAX_IDLE_MS);

  const staleGuests = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(
      and(
        eq(schema.user.isAnonymous, true),
        lt(schema.user.createdAt, olderThan),
        notExists(
          db
            .select({ one: sql`1` })
            .from(schema.session)
            .where(
              and(
                eq(schema.session.userId, schema.user.id),
                gt(schema.session.expiresAt, now),
              ),
            ),
        ),
      ),
    )
    .limit(500);

  if (staleGuests.length === 0) return 0;

  const ids = staleGuests.map((g) => g.id);

  // Remove any ephemeral guest ledger entries so user deletion cascades cleanly
  for (const id of ids) {
    await db
      .delete(schema.ringTransactions)
      .where(eq(schema.ringTransactions.userId, id));
  }

  const removed = await db
    .delete(schema.user)
    .where(inArray(schema.user.id, ids))
    .returning({ id: schema.user.id });

  return removed.length;
}
