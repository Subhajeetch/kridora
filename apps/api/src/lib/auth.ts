import { ensureProfile, schema } from "@kridora/db";
import { normalizeDisplayName } from "@kridora/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { anonymous } from "better-auth/plugins";
import { env, isProduction } from "../env";
import { db } from "./db";
import { mailer } from "./mailer";
import { redis } from "./redis-client";

const AUTH_PREFIX = "kridora:auth:";
const INCREMENT_WITH_TTL = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return value`;
/** Header our own bridge sets (after stripping any client-supplied copy) so rate limits see the real IP. */
export const CLIENT_IP_HEADER = "x-kridora-client-ip";

export const auth = betterAuth({
  appName: "Kridora",
  baseURL: env.APP_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  // Redis backs rate limiting (shared across API instances). Sessions are still persisted in Postgres.
  secondaryStorage: {
    get: async (key) => redis.get(`${AUTH_PREFIX}${key}`),
    getAndDelete: async (key) => redis.getdel(`${AUTH_PREFIX}${key}`),
    // Atomic counter whose TTL is only set on creation (fixed rate-limit window).
    increment: async (key, ttl) => Number(await redis.eval(INCREMENT_WITH_TTL, 1, `${AUTH_PREFIX}${key}`, ttl)),
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(`${AUTH_PREFIX}${key}`, value, "EX", ttl);
      else await redis.set(`${AUTH_PREFIX}${key}`, value);
    },
    delete: async (key) => {
      await redis.del(`${AUTH_PREFIX}${key}`);
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    // Not awaited on purpose: response timing must not reveal whether an email exists.
    sendResetPassword: async ({ user, url, token }) => {
      void mailer.sendPasswordResetEmail({ to: user.email, name: user.name, url, token });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // If someone tries to log in before verifying, send a fresh link automatically.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url, token }) => {
      void mailer.sendVerificationEmail({ to: user.email, name: user.name, url, token });
    },
  },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {},

  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    storeSessionInDatabase: true,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 3 },
      "/sign-in/anonymous": { window: 60, max: 10 },
    },
  },

  advanced: {
    cookiePrefix: "kridora",
    useSecureCookies: isProduction,
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },

  plugins: [
    // Name-only guest accounts. If a guest later signs in to a real account, the guest user is deleted.
    anonymous({ emailDomainName: "guest.kridora.invalid" }),
  ],

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Names can come from Google profiles, so clean them instead of rejecting the sign-in.
          const cleaned = normalizeDisplayName(user.name ?? "");
          return { data: { ...user, name: cleaned.length >= 2 ? cleaned : "Player" } };
        },
        after: async (user) => {
          // Every account gets a game profile (Rings wallet, XP).
          await ensureProfile(db, user.id);
        },
      },
      update: {
        before: async (data) => {
          if (typeof data.name !== "string") return { data };
          const cleaned = normalizeDisplayName(data.name);
          if (cleaned.length < 2) {
            throw new APIError("BAD_REQUEST", { message: "Pick a name with at least 2 letters or numbers" });
          }
          return { data: { ...data, name: cleaned } };
        },
      },
    },
  },
});

export type Auth = typeof auth;
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>> & {};
