import type { SocketUser } from "@kridora/shared";
import { z } from "zod";

export const MAX_WS_FRAME_BYTES = 16 * 1024; // 16 KB max frame size
export const WS_OPEN_READY_STATE = 1;

export const wsClientFrameSchema = z.object({
  id: z.number().int().nonnegative().optional(),
  event: z.string().min(1).max(64),
  payload: z.unknown().optional(),
});

export interface SocketAttachment {
  user: SocketUser;
  connectedAt: number;
}

export class SlidingWindowLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly windowMs: number,
    private readonly maxEvents: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.maxEvents;
  }

  prune(): void {
    const now = Date.now();
    for (const [k, v] of this.buckets.entries()) {
      if (now > v.resetAt) this.buckets.delete(k);
    }
  }
}
