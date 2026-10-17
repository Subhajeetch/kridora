import { createAuthClient } from "better-auth/react"
import { anonymousClient } from "better-auth/client/plugins"

/** Same origin as the page (Vite / the reverse proxy forwards /api to the API), so cookies are first-party. */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
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
