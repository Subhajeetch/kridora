import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@kridora/shared";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** CSPRNG Room Code generator (alphabet length is 32, a power of 2 -> zero modulo bias). */
export function generateSecureRoomCode(): string {
  const alphabetLen = ROOM_CODE_ALPHABET.length;
  const randomBytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(randomBytes);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const byte = randomBytes[i] ?? 0;
    code += ROOM_CODE_ALPHABET.charAt(byte % alphabetLen);
  }
  return code;
}

/** CSPRNG URL-safe token for invite links and single-use ticket nonces. */
export function generateSecureToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** CSPRNG unbiased 1..N dice roll using rejection sampling. */
export function rollSecureDie(sides = 6): number {
  if (!Number.isInteger(sides) || sides < 2 || sides > 255) {
    throw new RangeError("sides must be an integer between 2 and 255");
  }
  const limit = Math.floor(256 / sides) * sides;
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    const val = buf[0] ?? 255;
    if (val < limit) {
      return (val % sides) + 1;
    }
  }
}

export interface WsTicketClaims {
  sub: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
  ipHash: string;
  nonce: string;
  exp: number;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function hashClientIp(
  ip: string,
  secret: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${ip}:${secret}`),
  );
  return toBase64Url(new Uint8Array(digest).slice(0, 12));
}

/** Signs a 30-second single-use HMAC-SHA256 WebSocket upgrade ticket. */
export async function signWsTicket(
  claims: WsTicketClaims,
  secret: string,
): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Verifies an HMAC-SHA256 WebSocket upgrade ticket in constant time. */
export async function verifyWsTicket(
  token: string,
  secret: string,
): Promise<WsTicketClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await importHmacKey(secret);
    const sigBytes = fromBase64Url(sigB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(payloadB64),
    );
    if (!valid) return null;

    const claims = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadB64)),
    ) as WsTicketClaims;

    if (
      !claims ||
      typeof claims.sub !== "string" ||
      typeof claims.nonce !== "string" ||
      typeof claims.exp !== "number" ||
      Date.now() > claims.exp
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
