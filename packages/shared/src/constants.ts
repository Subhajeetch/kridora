/** Room codes avoid look-alike characters (0/O, 1/I) so they are easy to read out loud. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

/** How long the room waits before handing ownership to the next player after the owner goes offline. */
export const OWNER_TRANSFER_DELAY_MS = 40_000;
/** How long a disconnected (non-owner) player keeps their seat in a lobby before being removed. */
export const PLAYER_DISCONNECT_GRACE_MS = 60_000;
/** A room with nobody connected is closed after this long. */
export const EMPTY_ROOM_CLOSE_DELAY_MS = 5 * 60_000;

export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** URL segments that can never be used as a game slug because the web app already routes them. */
export const RESERVED_SLUGS = [
  "games",
  "login",
  "signup",
  "reset-password",
  "room",
  "rooms",
  "api",
  "settings",
  "account",
  "assets",
  "audio",
] as const;
