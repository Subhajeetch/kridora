import { z } from "zod";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "./constants";

/** Letters/numbers from any language, plus space . _ -  (must start with a letter or number). */
export const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;

export const displayNameSchema = z
  .string()
  .trim()
  .min(
    DISPLAY_NAME_MIN_LENGTH,
    `Use at least ${DISPLAY_NAME_MIN_LENGTH} characters`,
  )
  .max(
    DISPLAY_NAME_MAX_LENGTH,
    `Use at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
  )
  .regex(
    DISPLAY_NAME_PATTERN,
    "Use letters, numbers, spaces, dots, dashes or underscores",
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

const roomCodePattern = new RegExp(
  `^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`,
);

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    roomCodePattern,
    `Room codes are ${ROOM_CODE_LENGTH} letters or numbers`,
  );

/**
 * Best-effort cleanup for names we did not type ourselves (e.g. a Google profile name).
 * Strips unsupported characters and trims to the maximum length.
 */
export function normalizeDisplayName(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH)
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "");
}

/** XP -> level curve used everywhere (API + UI). Level 1 starts at 0 XP, level 2 at 100 XP, level 3 at 400 XP... */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
