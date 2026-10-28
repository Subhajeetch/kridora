import type { Database } from "@kridora/db";

export interface HyperdriveBinding {
  connectionString: string;
}

export interface Env {
  REALTIME_HUB: DurableObjectNamespace;
  DATABASE_URL: string;
  HYPERDRIVE?: HyperdriveBinding;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  WEB_URL: string;
  CORS_ORIGIN?: string;
  NODE_ENV?: "development" | "production";
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  isAnonymous: boolean;
  role: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface Variables {
  getDb: () => Database;
  user: AuthSessionUser | null;
  session: AuthSession | null;
  requestId: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: Variables;
};
