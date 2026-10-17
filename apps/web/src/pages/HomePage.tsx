import { DoorOpen, Gamepad2 } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { AuthDialog } from "@/components/AuthDialog"
import { JoinRoomDialog } from "@/components/JoinRoomDialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useRealtime } from "@/providers/realtime-context"
import { GAME_DEFINITIONS } from "@kridora/shared"

export default function HomePage() {
  const { data: session } = authClient.useSession()
  const { activeRoom } = useRealtime()
  const [joinOpen, setJoinOpen] = useState(false)

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center py-16 text-center sm:py-24">
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">Games to play with friends</h1>
      <p className="mt-5 max-w-md text-lg text-muted-foreground text-balance">
        Create a room, share the code and start playing in seconds. No download needed.
      </p>

      {session ? (
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/games" className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
            <Gamepad2 /> Browse games
          </Link>
          <Button variant="outline" size="lg" className="h-12 px-6 text-base" onClick={() => setJoinOpen(true)}>
            <DoorOpen /> Join a room
          </Button>
        </div>
      ) : null}

      {activeRoom && (
        <Link
          to={`/${activeRoom.gameSlug}/room/${activeRoom.code}`}
          className="mt-8 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-3 text-sm transition-colors hover:bg-violet-400/15"
        >
          You are in room <strong className="tracking-widest">{activeRoom.code}</strong> for{" "}
          {GAME_DEFINITIONS[activeRoom.gameSlug].name}. Return to it
        </Link>
      )}

      {/* Visitors without a session must pick a name (or log in) before doing anything else. */}
      <AuthDialog open={!session} />
      <JoinRoomDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </section>
  )
}
