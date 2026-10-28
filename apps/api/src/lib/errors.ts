import { RingsError } from "@kridora/db";
import type { Ack, ErrorCode, ErrorPayload } from "@kridora/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { AppContext } from "../types";

export const ERROR_CODE_TO_STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  GAME_NOT_FOUND: 404,
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  ROOM_IN_PROGRESS: 409,
  ROOM_BUSY: 409,
  ALREADY_IN_ROOM: 409,
  NOT_IN_ROOM: 400,
  NOT_ROOM_OWNER: 403,
  INVALID_TARGET: 400,
  BANNED_FROM_ROOM: 403,
  NO_PUBLIC_ROOM: 404,
  START_REQUIREMENTS_NOT_MET: 422,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    statusOverride?: ContentfulStatusCode,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = statusOverride ?? ERROR_CODE_TO_STATUS[code] ?? 500;
    this.details = details;
  }

  toPayload(): ErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function okAck<T>(data: T): Ack<T> {
  return { ok: true, data };
}

export function errAck(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Ack<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

export function toErrorPayload(err: unknown): ErrorPayload {
  if (err instanceof ApiError) {
    return err.toPayload();
  }
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    return {
      code: "VALIDATION_ERROR",
      message: firstIssue?.message ?? "Invalid request payload",
      details: {
        issues: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    };
  }
  if (err instanceof RingsError) {
    const code: ErrorCode =
      err.code === "PROFILE_NOT_FOUND" ? "NOT_FOUND" : "VALIDATION_ERROR";
    return {
      code,
      message: err.message,
      details: { ringsCode: err.code },
    };
  }
  console.error("[unhandled-error]", err);
  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected server error occurred. Please try again.",
  };
}

export function handleHttpError(err: unknown, c: Context<AppContext>) {
  const payload = toErrorPayload(err);
  const status =
    err instanceof ApiError
      ? err.status
      : (ERROR_CODE_TO_STATUS[payload.code] ?? 500);

  return c.json({ error: payload }, status);
}
