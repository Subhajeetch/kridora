import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { normalizeDisplayName } from "@kridora/shared";
import { API_URL } from "./api-url";

/**
 * In local dev (Vite proxy): same origin as the page.
 * In production: points to the backend API origin (e.g. https://api.kridora.org).
 */
export const authClient = createAuthClient({
  baseURL: API_URL || window.location.origin,
  plugins: [anonymousClient()],
});

/** Creates a name-only guest session in a single request when possible. */
export async function startGuestSession(name: string): Promise<void> {
  const cleanName = normalizeDisplayName(name) || "Player";
  const anonymousFn = authClient.signIn.anonymous as unknown as (opts?: {
    fetchOptions?: { body?: Record<string, unknown> };
  }) => Promise<{
    error?: { message?: string } | null;
    data?: { user?: { name?: string } } | null;
  }>;

  const created = await anonymousFn({
    fetchOptions: {
      body: { name: cleanName },
    },
  });

  if (created.error) {
    throw new Error(created.error.message || "Could not start a guest session");
  }

  // If the server didn't set the custom name directly, fallback to updating it
  const sessionUser = created.data?.user;
  if (!sessionUser || sessionUser.name !== cleanName) {
    const renamed = await authClient.updateUser({ name: cleanName });
    if (renamed.error) {
      await authClient.signOut();
      throw new Error(renamed.error.message || "That name is not allowed");
    }
  }
}
