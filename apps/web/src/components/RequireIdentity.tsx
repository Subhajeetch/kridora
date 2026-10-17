import type { ReactNode } from "react"
import { AuthDialog } from "@/components/AuthDialog"
import { authClient } from "@/lib/auth-client"

/**
 * Renders its children only for signed-in players (guest or account).
 * Everyone else gets the "pick a name or log in" dialog, which cannot be dismissed.
 */
export function RequireIdentity({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  if (!session) return <AuthDialog open />
  return <>{children}</>
}
