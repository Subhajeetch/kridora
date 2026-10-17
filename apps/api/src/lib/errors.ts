import type { ErrorCode, ErrorPayload } from "@kridora/shared";
import { ZodError } from "zod";

/** An error that is safe to show to the client. Anything else is reported as INTERNAL_ERROR. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  GAME_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_IN_PROGRESS: 409,
  ROOM_BUSY: 503,
  ALREADY_IN_ROOM: 409,
  NOT_IN_ROOM: 409,
  NOT_ROOM_OWNER: 403,
  INVALID_TARGET: 400,
  BANNED_FROM_ROOM: 403,
  NO_PUBLIC_ROOM: 404,
  START_REQUIREMENTS_NOT_MET: 409,
  INTERNAL_ERROR: 500,
};

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/** Converts anything thrown into a client-safe payload. Returns `unexpected` so callers can log it. */
export function toErrorPayload(err: unknown): { payload: ErrorPayload; unexpected: boolean } {
  if (err instanceof AppError) {
    return { payload: { code: err.code, message: err.message, details: err.details }, unexpected: false };
  }
  if (err instanceof ZodError) {
    return { payload: { code: "VALIDATION_ERROR", message: "Invalid request" }, unexpected: false };
  }
  return { payload: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." }, unexpected: true };
}
