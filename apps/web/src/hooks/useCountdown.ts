import { useEffect, useState } from "react";

/**
 * Seconds left until `targetMs` (epoch ms on the SERVER clock). `serverOffsetMs` = serverTime - clientTime,
 * which keeps the countdown right even when the player's clock is wrong. Returns null when there is no target.
 */
export function useCountdown(
  targetMs: number | null,
  serverOffsetMs: number,
): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs === null) return null;
  return Math.max(0, Math.ceil((targetMs - (now + serverOffsetMs)) / 1000));
}
