import { displayNameSchema, emailSchema, passwordSchema } from "@kridora/shared"
import { X } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import { usePublicConfig } from "@/hooks/usePublicConfig"
import { authClient, startGuestSession } from "@/lib/auth-client"

type Mode = "guest" | "login" | "signup" | "forgot" | "check-email" | "reset-sent"

interface AuthDialogProps {
  open: boolean
  /** Leave undefined to force the visitor to pick a name or log in before continuing. */
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  initialMode?: Mode
}

const TITLES: Record<Mode, string> = {
  guest: "Pick a name to play",
  login: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
  "check-email": "Check your email",
  "reset-sent": "Check your email",
}

function messageFor(error: { code?: string | undefined; message?: string | undefined }): string {
  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email first. We just sent you a new link."
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Wrong email or password."
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try logging in."
    default:
      return error.message || "Something went wrong. Please try again."
  }
}

export function AuthDialog({ open, onOpenChange, onSuccess, initialMode = "guest" }: AuthDialogProps) {
  const { googleEnabled } = usePublicConfig()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "email" | "password", string>>>({})

  function go(next: Mode) {
    setMode(next)
    setError(undefined)
    setFieldErrors({})
  }

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(undefined)
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  function validate(fields: { name?: string; email?: string; password?: string }) {
    const errors: typeof fieldErrors = {}
    if (fields.name !== undefined) {
      const r = displayNameSchema.safeParse(fields.name)
      if (!r.success) errors.name = r.error.issues[0]?.message
    }
    if (fields.email !== undefined) {
      const r = emailSchema.safeParse(fields.email)
      if (!r.success) errors.email = r.error.issues[0]?.message
    }
    if (fields.password !== undefined) {
      const r = passwordSchema.safeParse(fields.password)
      if (!r.success) errors.password = r.error.issues[0]?.message
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    if (mode === "guest") {
      if (!validate({ name })) return
      void run(async () => {
        await startGuestSession(displayNameSchema.parse(name))
        onOpenChange?.(false)
        onSuccess?.()
      })
    } else if (mode === "login") {
      if (!validate({ email, password })) return
      void run(async () => {
        const res = await authClient.signIn.email({ email: emailSchema.parse(email), password })
        if (res.error) throw new Error(messageFor(res.error))
        onOpenChange?.(false)
        onSuccess?.()
      })
    } else if (mode === "signup") {
      if (!validate({ name, email, password })) return
      void run(async () => {
        const res = await authClient.signUp.email({
          name: displayNameSchema.parse(name),
          email: emailSchema.parse(email),
          password,
          callbackURL: `${window.location.origin}/`,
        })
        if (res.error) throw new Error(messageFor(res.error))
        go("check-email")
      })
    } else if (mode === "forgot") {
      if (!validate({ email })) return
      void run(async () => {
        // Always show the same result so nobody can probe which emails have accounts.
        await authClient.requestPasswordReset({
          email: emailSchema.parse(email),
          redirectTo: `${window.location.origin}/reset-password`,
        })
        go("reset-sent")
      })
    }
  }

  function continueWithGoogle() {
    void run(async () => {
      const res = await authClient.signIn.social({ provider: "google", callbackURL: window.location.href })
      if (res.error) throw new Error(messageFor(res.error))
    })
  }

  const showForm = mode !== "check-email" && mode !== "reset-sent"

  return (
    <Dialog open={open} {...(onOpenChange ? { onOpenChange } : {})}>
      <DialogContent>
        {onOpenChange && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            className="absolute top-4 right-4 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        )}
        <DialogTitle>{TITLES[mode]}</DialogTitle>

        {mode === "guest" && (
          <DialogDescription>
            Guest sessions are not saved to an account. If your session ends, your name and progress are gone.
          </DialogDescription>
        )}
        {mode === "check-email" && (
          <DialogDescription>
            We sent a verification link to <strong>{email}</strong>. Open it, then come back and log in.
            {import.meta.env.DEV && " (Dev: the link is printed in the API console.)"}
          </DialogDescription>
        )}
        {mode === "reset-sent" && (
          <DialogDescription>
            If an account exists for <strong>{email}</strong>, we sent a link to choose a new password.
            {import.meta.env.DEV && " (Dev: the link is printed in the API console.)"}
          </DialogDescription>
        )}
        {mode === "forgot" && <DialogDescription>Enter your email and we will send you a reset link.</DialogDescription>}

        {showForm && (
          <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
            {(mode === "guest" || mode === "signup") && (
              <Field label="Display name" error={fieldErrors.name}>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should players call you?"
                  maxLength={20}
                  autoComplete="nickname"
                  autoFocus
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </Field>
            )}
            {mode !== "guest" && (
              <Field label="Email" error={fieldErrors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus={mode === "login" || mode === "forgot"}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
              </Field>
            )}
            {(mode === "login" || mode === "signup") && (
              <Field label="Password" error={fieldErrors.password}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  aria-invalid={Boolean(fieldErrors.password)}
                />
              </Field>
            )}

            {error && (
              <p role="alert" className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy
                ? "Please wait..."
                : mode === "guest"
                  ? "Play as guest"
                  : mode === "login"
                    ? "Log in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
            </Button>

            {googleEnabled && (mode === "login" || mode === "signup") && (
              <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} onClick={continueWithGoogle}>
                Continue with Google
              </Button>
            )}
          </form>
        )}

        <div className="mt-5 space-y-1.5 text-center text-sm text-muted-foreground">
          {mode === "guest" && (
            <p>
              Already have an account?{" "}
              <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go("login")}>
                Log in
              </button>
            </p>
          )}
          {mode === "login" && (
            <>
              <p>
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => go("forgot")}>
                  Forgot your password?
                </button>
              </p>
              <p>
                New here?{" "}
                <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go("signup")}>
                  Create an account
                </button>{" "}
                or{" "}
                <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go("guest")}>
                  play as a guest
                </button>
              </p>
            </>
          )}
          {mode === "signup" && (
            <p>
              Have an account?{" "}
              <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go("login")}>
                Log in
              </button>
            </p>
          )}
          {(mode === "forgot" || mode === "check-email" || mode === "reset-sent") && (
            <p>
              <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => go("login")}>
                Back to log in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
