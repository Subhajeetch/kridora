import { passwordSchema } from "@kridora/shared"
import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router"
import { Button, buttonVariants } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get("token")
  const linkInvalid = !token || params.get("error") !== null

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || !token) return
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0]?.message)
    if (password !== confirm) return setError("The passwords do not match")

    setBusy(true)
    setError(undefined)
    const res = await authClient.resetPassword({ newPassword: password, token })
    setBusy(false)
    if (res.error) setError(res.error.message || "This link is invalid or has expired.")
    else setDone(true)
  }

  return (
    <section className="mx-auto max-w-sm py-16">
      <div className="rounded-3xl border border-white/10 bg-card p-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>

        {done ? (
          <>
            <p className="mt-3 text-muted-foreground">Your password was changed. You can log in with it now.</p>
            <Link to="/" className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
              Go to Kridora
            </Link>
          </>
        ) : linkInvalid ? (
          <>
            <p className="mt-3 text-muted-foreground">This reset link is invalid or has expired. Request a new one from the log in screen.</p>
            <Link to="/" className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
              Back to Kridora
            </Link>
          </>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4" noValidate>
            <Field label="New password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
            </Field>
            <Field label="Repeat password">
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Saving..." : "Change password"}
            </Button>
          </form>
        )}
      </div>
    </section>
  )
}
