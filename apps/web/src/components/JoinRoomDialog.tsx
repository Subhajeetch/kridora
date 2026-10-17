import { roomCodeSchema, ROOM_CODE_LENGTH } from "@kridora/shared"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRealtime } from "@/providers/realtime-context"
import { describeError, request, RequestError } from "@/lib/socket"

export function JoinRoomDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { setActiveRoom } = useRealtime()
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const parsed = roomCodeSchema.safeParse(code)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const room = await request("room:join", { code: parsed.data })
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Join a room</DialogTitle>
        <DialogDescription>Enter the {ROOM_CODE_LENGTH}-character code your friend shared.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={ROOM_CODE_LENGTH}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Room code"
            aria-invalid={Boolean(error)}
            className="h-12 text-center text-xl font-semibold tracking-[0.35em] uppercase"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length === 0}>
            {busy ? "Joining..." : "Join room"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
