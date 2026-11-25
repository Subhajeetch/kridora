import {
  ensureProfile,
  mergeGuestProfileIntoUser,
  schema,
  type Database,
} from "@kridora/db";
import { displayNameSchema, normalizeDisplayName } from "@kridora/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import type { Env } from "../types";

export function isLocalNetworkOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch {
    return false;
  }
}

export function getAllowedOrigins(env: Env): string[] {
  const raw = [env.WEB_URL, env.CORS_ORIGIN, env.BETTER_AUTH_URL]
    .filter((v): v is string => Boolean(v))
    .flatMap((item) => item.split(","))
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (env.NODE_ENV !== "production") {
    raw.push(
      "http://localhost:5173",
      "http://localhost:2020",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:2020",
    );
  }
  return Array.from(new Set(raw));
}

export function createAuth(db: Database, env: Env) {
  const isProd = env.NODE_ENV === "production";
  const trustedOrigins = getAllowedOrigins(env);
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: isProd
      ? trustedOrigins
      : [
          ...trustedOrigins,
          "http://192.168.*:*",
          "http://10.*:*",
          "http://172.*:*",
          "http://*.local:*",
        ],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      async sendResetPassword({ user, url }) {
        if (!isProd) {
          console.info(`[auth] Password reset link for ${user.email}: ${url}`);
        }
      },
    },
    ...(googleClientId && googleClientSecret
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          },
        }
      : {}),
    plugins: [
      anonymous({
        emailDomainName: "guest.kridora.local",
        generateName: (ctx) => {
          const body = ctx?.body as { name?: string } | undefined;
          const cleanName = body?.name
            ? normalizeDisplayName(body.name) || "Player"
            : "Player";
          const parsed = displayNameSchema.safeParse(cleanName);
          return parsed.success ? parsed.data : "Player";
        },
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await mergeGuestProfileIntoUser(
            db,
            anonymousUser.user.id,
            newUser.user.id,
          );
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const cleanName =
              normalizeDisplayName(user.name || "Player") || "Player";
            const parsed = displayNameSchema.safeParse(cleanName);
            return {
              data: {
                ...user,
                name: parsed.success ? parsed.data : "Player",
              },
            };
          },
          after: async (user) => {
            try {
              await ensureProfile(db, user.id);
            } catch (err) {
              console.error("[auth] Failed to ensure profile on signup:", err);
            }
          },
        },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
        httpOnly: true,
        path: "/",
      },
    },
  });
}
