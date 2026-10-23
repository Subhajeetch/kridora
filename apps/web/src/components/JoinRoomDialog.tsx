import { displayNameSchema, roomCodeSchema, ROOM_CODE_LENGTH } from "@kridora/shared"
import { X } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { AuthDialog } from "@/components/AuthDialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, Input } from "@/components/ui/input"
import { authClient, startGuestSession } from "@/lib/auth-client"
import { describeError, request, RequestError, waitForSocketConnected } from "@/lib/socket"
import { useRealtime } from "@/providers/realtime-context"

export function JoinRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { setActiveRoom } = useRealtime()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [nameError, setNameError] = useState<string | undefined>()
  const [authOpen, setAuthOpen] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return

    const parsedCode = roomCodeSchema.safeParse(code)
    if (!parsedCode.success) {
      setError(parsedCode.error.issues[0]?.message)
      return
    }

    if (!session) {
      const parsedName = displayNameSchema.safeParse(name)
      if (!parsedName.success) {
        setNameError(parsedName.error.issues[0]?.message)
        return
      }
    }

    setBusy(true)
    setError(undefined)
    setNameError(undefined)

    try {
      if (!session) {
        await startGuestSession(displayNameSchema.parse(name))
      }
      await waitForSocketConnected()
      const room = await request("room:join", { code: parsedCode.data })
      setActiveRoom(room)
      onOpenChange(false)
      void navigate(`/${room.gameSlug}/room/${room.code}`)
    } catch (err) {
      if (err instanceof RequestError && err.code === "ALREADY_IN_ROOM" && typeof err.details?.roomCode === "string") {
        onOpenChange(false)
        void navigate(`/${String(err.details.gameSlug)}/room/${err.details.roomCode}`)
        return
      }
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(undefined)
      setNameError(undefined)
    }
    onOpenChange(next)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            className="absolute top-4 right-4 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenChange(false)}
          >
            <X className="size-4" />
          </Button>

          <DialogTitle>Join a room</DialogTitle>
          <DialogDescription>Enter the {ROOM_CODE_LENGTH}-character code your friend shared.</DialogDescription>

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            <Field label="Room code" error={error}>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setError(undefined)
                }}
                placeholder="ABCD"
                maxLength={ROOM_CODE_LENGTH}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Room code"
                aria-invalid={Boolean(error)}
                className="h-12 text-center text-xl font-semibold tracking-[0.35em] uppercase"
              />
            </Field>

            {!session && (
              <Field label="Your name" error={nameError}>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameError(undefined)
                  }}
                  placeholder="What should players call you?"
                  maxLength={20}
                  autoComplete="nickname"
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy || code.length === 0 || (!session && name.trim().length === 0)}
            >
              {busy ? "Joining..." : "Join room"}
            </Button>

            {!session && (
              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => setAuthOpen(true)}
                >
                  Log in
                </button>
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="login" />
    </>
  )
}
