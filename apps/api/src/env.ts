import { z } from "zod";

/** Treat `KEY=` (empty) in a .env file the same as an unset variable. */
const optionalString = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(2020),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    /** Public origin of the web app, e.g. http://localhost:5173 or https://kridora.com */
    APP_URL: z.url().transform((v) => v.replace(/\/+$/, "")),
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z
      .string()
      .min(
        32,
        "BETTER_AUTH_SECRET must be at least 32 characters (openssl rand -base64 32)",
      ),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
  })
  .refine(
    (e) => Boolean(e.GOOGLE_CLIENT_ID) === Boolean(e.GOOGLE_CLIENT_SECRET),
    {
      message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
      path: ["GOOGLE_CLIENT_ID"],
    },
  );

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error(
        `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      );
    }
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
/** Which game config file to use (config.production.ts vs config.development.ts). */
export const appEnvironment = isProduction ? "production" : "development";
