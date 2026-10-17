export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "NOT_FOUND",
  "GAME_NOT_FOUND",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_IN_PROGRESS",
  "ROOM_BUSY",
  "ALREADY_IN_ROOM",
  "NOT_IN_ROOM",
  "NOT_ROOM_OWNER",
  "INVALID_TARGET",
  "BANNED_FROM_ROOM",
  "NO_PUBLIC_ROOM",
  "START_REQUIREMENTS_NOT_MET",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorPayload };
export type AckFn<T> = (response: Ack<T>) => void;
