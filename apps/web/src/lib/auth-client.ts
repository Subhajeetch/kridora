import { createAuthClient } from "better-auth/react"
import { anonymousClient } from "better-auth/client/plugins"
import { API_URL } from "./api-url"

/**
 * In local dev (Vite proxy): same origin as the page.
 * In production: points to the backend API origin (e.g. https://api.kridora.org).
 */
export const authClient = createAuthClient({
  baseURL: API_URL || window.location.origin,
  plugins: [anonymousClient()],
})

/** Creates a name-only guest session. */
export async function startGuestSession(name: string): Promise<void> {
  const created = await authClient.signIn.anonymous()
  if (created.error) throw new Error(created.error.message || "Could not start a guest session")

  const renamed = await authClient.updateUser({ name })
  if (renamed.error) {
    // Do not leave a nameless "Anonymous" session behind.
    await authClient.signOut()
    throw new Error(renamed.error.message || "That name is not allowed")
  }
}
