import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { playerProfiles, ringTransactions, type RingTransaction, type RingTransactionType } from "../schema";

export type RingsErrorCode = "INVALID_AMOUNT" | "PROFILE_NOT_FOUND" | "INSUFFICIENT_RINGS";

export class RingsError extends Error {
  readonly code: RingsErrorCode;

  constructor(code: RingsErrorCode, message: string) {
    super(message);
    this.name = "RingsError";
    this.code = code;
  }
}

export interface RingTransactionInput {
  userId: string;
  /** Signed whole number: positive earns Rings, negative spends them. Zero is rejected. */
  amount: number;
  type: RingTransactionType;
  reason?: string;
  referenceType?: string;
  referenceId?: string;
  /** Supply one for anything that may be retried (webhooks, ad callbacks, match payouts). */
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface RingTransactionResult {
  transaction: RingTransaction;
  balance: number;
  /** True when this idempotency key was already applied and nothing changed. */
  duplicate: boolean;
}

function isUniqueViolation(err: unknown): boolean {
  const anyErr = err as { code?: string; cause?: { code?: string } } | null;
  return anyErr?.code === "23505" || anyErr?.cause?.code === "23505";
}

async function findByIdempotencyKey(db: Database, key: string): Promise<RingTransaction | undefined> {
  const [row] = await db.select().from(ringTransactions).where(eq(ringTransactions.idempotencyKey, key)).limit(1);
  return row;
}

/**
 * The ONLY supported way to change a Rings balance.
 * Locks the profile row, checks funds, writes the ledger entry and updates the cached balance atomically.
 */
export async function applyRingTransaction(
  db: Database,
  input: RingTransactionInput,
): Promise<RingTransactionResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new RingsError("INVALID_AMOUNT", "Amount must be a non-zero whole number");
  }

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(db, input.idempotencyKey);
    if (existing) return { transaction: existing, balance: existing.balanceAfter, duplicate: true };
  }

  try {
    return await db.transaction(async (tx) => {
      const [profile] = await tx
        .select()
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, input.userId))
        .for("update");
      if (!profile) throw new RingsError("PROFILE_NOT_FOUND", "Player profile not found");

      const newBalance = profile.ringsBalance + input.amount;
      if (newBalance < 0) throw new RingsError("INSUFFICIENT_RINGS", "Not enough Rings");
      if (!Number.isSafeInteger(newBalance)) throw new RingsError("INVALID_AMOUNT", "Balance out of range");

      const [transaction] = await tx
        .insert(ringTransactions)
        .values({
          userId: input.userId,
          amount: input.amount,
          balanceAfter: newBalance,
          type: input.type,
          reason: input.reason,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata ?? {},
        })
        .returning();
      if (!transaction) throw new Error("Ledger insert returned no row");

      await tx
        .update(playerProfiles)
        .set({
          ringsBalance: newBalance,
          lifetimeRingsEarned:
            input.amount > 0 ? profile.lifetimeRingsEarned + input.amount : profile.lifetimeRingsEarned,
          lifetimeRingsSpent:
            input.amount < 0 ? profile.lifetimeRingsSpent - input.amount : profile.lifetimeRingsSpent,
        })
        .where(eq(playerProfiles.userId, input.userId));

      return { transaction, balance: newBalance, duplicate: false };
    });
  } catch (err) {
    // Two requests with the same idempotency key raced: the loser reads the winner's result.
    if (input.idempotencyKey && isUniqueViolation(err)) {
      const existing = await findByIdempotencyKey(db, input.idempotencyKey);
      if (existing) return { transaction: existing, balance: existing.balanceAfter, duplicate: true };
    }
    throw err;
  }
}

export type GrantRingsInput = Omit<RingTransactionInput, "amount" | "type"> & {
  /** Positive whole number. */
  amount: number;
  type?: Exclude<RingTransactionType, "spend">;
};

export function grantRings(db: Database, input: GrantRingsInput): Promise<RingTransactionResult> {
  if (!(input.amount > 0)) return Promise.reject(new RingsError("INVALID_AMOUNT", "Grant amount must be positive"));
  return applyRingTransaction(db, { ...input, type: input.type ?? "game_reward" });
}

export type SpendRingsInput = Omit<RingTransactionInput, "amount" | "type"> & {
  /** Positive whole number; it is stored as a negative ledger amount. */
  amount: number;
};

export function spendRings(db: Database, input: SpendRingsInput): Promise<RingTransactionResult> {
  if (!(input.amount > 0)) return Promise.reject(new RingsError("INVALID_AMOUNT", "Spend amount must be positive"));
  return applyRingTransaction(db, { ...input, amount: -input.amount, type: "spend" });
}
