import {
  displayNameSchema,
  emailSchema,
  passwordSchema,
} from "@kridora/shared";
import { AlertCircle, Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { authClient, startGuestSession } from "@/lib/auth-client";

type Mode =
  "guest" | "login" | "signup" | "forgot" | "check-email" | "reset-sent";

interface AuthDialogProps {
  open: boolean;
  /** Leave undefined to force the visitor to pick a name or log in before continuing. */
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  initialMode?: Mode;
}

const TITLES: Record<Mode, string> = {
  guest: "Pick a name to play",
  login: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
  "check-email": "Check your email",
  "reset-sent": "Check your email",
};

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function messageFor(error: {
  code?: string | undefined;
  message?: string | undefined;
}): string {
  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email first. We just sent you a new verification link.";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Incorrect email or password. Please try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try logging in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 8 characters long.";
    case "INVALID_EMAIL":
      return "Please enter a valid email address.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

export function AuthDialog({
  open,
  onOpenChange,
  onSuccess,
  initialMode = "guest",
}: AuthDialogProps) {
  const { googleEnabled } = usePublicConfig();
  const { data: rawSession } = authClient.useSession();
  const isGuest = Boolean(rawSession?.user?.isAnonymous);

  const [mode, setMode] = useState<Mode>(() => {
    if (initialMode === "guest" && isGuest) return "signup";
    return initialMode;
  });

  const [name, setName] = useState(rawSession?.user?.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "email" | "password", string>>
  >({});

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode);

  if (open !== prevOpen || initialMode !== prevInitialMode) {
    setPrevOpen(open);
    setPrevInitialMode(initialMode);
    if (open) {
      setMode(initialMode === "guest" && isGuest ? "signup" : initialMode);
      if (rawSession?.user?.name && !name) {
        setName(rawSession.user.name);
      }
      setError(undefined);
      setFieldErrors({});
    }
  }

  function go(next: Mode) {
    setMode(next);
    setError(undefined);
    setFieldErrors({});
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function validate(fields: {
    name?: string;
    email?: string;
    password?: string;
  }) {
    const errors: typeof fieldErrors = {};
    if (fields.name !== undefined) {
      const r = displayNameSchema.safeParse(fields.name);
      if (!r.success) errors.name = r.error.issues[0]?.message;
    }
    if (fields.email !== undefined) {
      const r = emailSchema.safeParse(fields.email);
      if (!r.success) errors.email = r.error.issues[0]?.message;
    }
    if (fields.password !== undefined) {
      const r = passwordSchema.safeParse(fields.password);
      if (!r.success) errors.password = r.error.issues[0]?.message;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || googleBusy) return;

    if (mode === "guest") {
      if (!validate({ name })) return;
      void run(async () => {
        await startGuestSession(displayNameSchema.parse(name));
        onOpenChange?.(false);
        onSuccess?.();
      });
    } else if (mode === "login") {
      if (!validate({ email, password })) return;
      void run(async () => {
        const res = await authClient.signIn.email({
          email: emailSchema.parse(email),
          password,
        });
        if (res.error) throw new Error(messageFor(res.error));
        onOpenChange?.(false);
        onSuccess?.();
      });
    } else if (mode === "signup") {
      if (!validate({ name, email, password })) return;
      void run(async () => {
        const res = await authClient.signUp.email({
          name: displayNameSchema.parse(name),
          email: emailSchema.parse(email),
          password,
          callbackURL: `${window.location.origin}/`,
        });
        if (res.error) throw new Error(messageFor(res.error));
        go("check-email");
      });
    } else if (mode === "forgot") {
      if (!validate({ email })) return;
      void run(async () => {
        // Always show the same result so nobody can probe which emails have accounts.
        await authClient.requestPasswordReset({
          email: emailSchema.parse(email),
          redirectTo: `${window.location.origin}/reset-password`,
        });
        go("reset-sent");
      });
    }
  }

  async function continueWithGoogle() {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    setError(undefined);
    try {
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.href,
      });
      if (res.error) throw new Error(messageFor(res.error));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again.",
      );
      setGoogleBusy(false);
    }
  }

  const showForm = mode !== "check-email" && mode !== "reset-sent";

  const dialogTitle =
    mode === "signup" && isGuest ? "Create Account & Keep Stats" : TITLES[mode];

  return (
    <Dialog open={open} {...(onOpenChange ? { onOpenChange } : {})}>
      <DialogContent className="max-w-md p-6 sm:p-7">
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

        <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
          {dialogTitle}
        </DialogTitle>

        {mode === "guest" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Choose a nickname to start playing right away. You can upgrade to a
            permanent account anytime to keep your stats.
          </DialogDescription>
        )}
        {mode === "signup" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {isGuest
              ? "Create an account with email & password or Google to permanently keep your stats, victories, and rings."
              : "Sign up with email or Google to track your stats, earn rings, and play with friends."}
          </DialogDescription>
        )}
        {mode === "login" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Sign in with your email or Google to access your stats, rings, and
            game history.
          </DialogDescription>
        )}
        {mode === "check-email" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            We sent a verification link to <strong>{email}</strong>. Open it,
            then come back and log in.
            {import.meta.env.DEV &&
              " (Dev: the link is printed in the API console.)"}
          </DialogDescription>
        )}
        {mode === "reset-sent" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            If an account exists for <strong>{email}</strong>, we sent a link to
            choose a new password.
            {import.meta.env.DEV &&
              " (Dev: the link is printed in the API console.)"}
          </DialogDescription>
        )}
        {mode === "forgot" && (
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Enter your email and we will send you a reset link.
          </DialogDescription>
        )}

        {showForm && (
          <div className="mt-5 space-y-4">
            {/* Google Authentication Option */}
            {googleEnabled && (mode === "login" || mode === "signup") && (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full h-11 gap-3 rounded-2xl border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10 font-medium text-foreground transition-all active:scale-[0.99] shadow-sm"
                  disabled={busy || googleBusy}
                  onClick={() => void continueWithGoogle()}
                >
                  {googleBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <GoogleIcon className="size-4 shrink-0" />
                  )}
                  <span>
                    {googleBusy
                      ? "Connecting to Google..."
                      : mode === "login"
                        ? "Continue with Google"
                        : "Sign up with Google"}
                  </span>
                </Button>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <span className="relative bg-card px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              {(mode === "guest" || mode === "signup") && (
                <Field label="Display name" error={fieldErrors.name}>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name)
                        setFieldErrors((p) => ({ ...p, name: undefined }));
                    }}
                    placeholder={
                      mode === "signup" && isGuest
                        ? "Your player name"
                        : "What should players call you?"
                    }
                    maxLength={20}
                    autoComplete="nickname"
                    autoFocus={mode === "guest" || (mode === "signup" && !name)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    disabled={busy || googleBusy}
                  />
                </Field>
              )}

              {mode !== "guest" && (
                <Field label="Email" error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email)
                        setFieldErrors((p) => ({ ...p, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoFocus={
                      mode === "login" ||
                      mode === "forgot" ||
                      (mode === "signup" && Boolean(name))
                    }
                    aria-invalid={Boolean(fieldErrors.email)}
                    disabled={busy || googleBusy}
                  />
                </Field>
              )}

              {(mode === "login" || mode === "signup") && (
                <Field label="Password" error={fieldErrors.password}>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password)
                        setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Enter your password"
                    }
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    aria-invalid={Boolean(fieldErrors.password)}
                    disabled={busy || googleBusy}
                  />
                </Field>
              )}

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full h-11 rounded-2xl font-semibold gap-2 transition-all active:scale-[0.99]"
                disabled={busy || googleBusy}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : mode === "guest" ? (
                  "Play as guest"
                ) : mode === "login" ? (
                  "Log in"
                ) : mode === "signup" ? (
                  isGuest ? (
                    "Create account & keep stats"
                  ) : (
                    "Create account"
                  )
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          </div>
        )}

        <div className="mt-5 space-y-1.5 text-center text-sm text-muted-foreground">
          {mode === "guest" && (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => go("login")}
              >
                Log in
              </button>
            </p>
          )}

          {mode === "login" && (
            <>
              <p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  onClick={() => go("forgot")}
                >
                  Forgot your password?
                </button>
              </p>
              <p>
                New here?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => go("signup")}
                >
                  Create an account
                </button>
                {!isGuest && (
                  <>
                    {" "}
                    or{" "}
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => go("guest")}
                    >
                      play as a guest
                    </button>
                  </>
                )}
              </p>
            </>
          )}

          {mode === "signup" && (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => go("login")}
              >
                Log in
              </button>
              {!isGuest && (
                <>
                  {" "}
                  or{" "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => go("guest")}
                  >
                    play as a guest
                  </button>
                </>
              )}
            </p>
          )}

          {(mode === "forgot" ||
            mode === "check-email" ||
            mode === "reset-sent") && (
            <p>
              <button
                type="button"
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => go("login")}
              >
                Back to log in
              </button>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
