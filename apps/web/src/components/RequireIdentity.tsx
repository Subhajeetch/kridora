import type { ReactNode } from "react"
import { useNavigate } from "react-router"
import { AuthDialog } from "@/components/AuthDialog"
import { authClient } from "@/lib/auth-client"

/**
 * Renders its children only for signed-in players (guest or account).
 * Everyone else gets the "pick a name or log in" dialog.
 * If dismissed, redirects back to the home page.
 */
export function RequireIdentity({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  if (!session) {
    return <AuthDialog open onOpenChange={(open) => { if (!open) void navigate("/") }} />
  }
  return <>{children}</>
}
