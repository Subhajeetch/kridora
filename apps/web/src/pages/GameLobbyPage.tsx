import { getGameDefinition, type GameSlug, type RoomSnapshot } from "@kridora/shared"
import { DoorOpen, Plus, Users } from "lucide-react"
import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { RequireIdentity } from "@/components/RequireIdentity"
import { Button } from "@/components/ui/button"
import { findEnabledGame } from "@/config/games"
import { describeError, request, RequestError } from "@/lib/socket"
import { useRealtime } from "@/providers/realtime-context"
import NotFoundPage from "./NotFoundPage"

/** yourdomain.com/<game>: the game's front door with "Join a public room" and "Create room". */
export default function GameLobbyPage() {
  const { slug } = useParams()
  const gameSlug = findEnabledGame(slug)
  if (!gameSlug) return <NotFoundPage />
  return (
    <RequireIdentity>
      <GameEntrance slug={gameSlug} />
    </RequireIdentity>
  )
}

function GameEntrance({ slug }: { slug: GameSlug }) {
  const game = getGameDefinition(slug)
  const navigate = useNavigate()
  const { connection, activeRoom, setActiveRoom } = useRealtime()
  const [busy, setBusy] = useState<"create" | "public" | null>(null)
  const [error, setError] = useState<RequestError | Error | null>(null)

  const connected = connection === "connected"
  const existingRoom = error instanceof RequestError && error.code === "ALREADY_IN_ROOM" ? error : null
  const existingCode = typeof existingRoom?.details?.roomCode === "string" ? existingRoom.details.roomCode : null
  const existingSlug = typeof existingRoom?.details?.gameSlug === "string" ? existingRoom.details.gameSlug : slug

  async function enter(kind: "create" | "public", action: () => Promise<RoomSnapshot>) {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      const room = await action()
      setActiveRoom(room)
      void navigate(`/${room.gameSlug}/room/${room.code}`)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(describeError(err)))
    } finally {
      setBusy(null)
    }
  }

  async function leaveCurrentRoom() {
    try {
      await request("room:leave", {})
      setActiveRoom(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(describeError(err)))
    }
  }

  return (
    <section className="mx-auto max-w-xl py-10">
      <div className="rounded-3xl border border-white/10 bg-card/70 p-8" style={{ borderTop: `4px solid ${game.accent}` }}>
        <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
        <p className="mt-2 text-muted-foreground">{game.description}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" /> {game.minPlayers} to {game.maxPlayers} players
        </p>

        {activeRoom && activeRoom.gameSlug === slug && (
          <button
            type="button"
            onClick={() => void navigate(`/${slug}/room/${activeRoom.code}`)}
            className="mt-6 w-full rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-left text-sm transition-colors hover:bg-violet-400/15"
          >
            You are already in room <strong className="tracking-widest">{activeRoom.code}</strong>. Return to it
          </button>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12 text-base"
            disabled={!connected || busy !== null}
            onClick={() => void enter("public", () => request("room:join-public", { gameSlug: slug }))}
          >
            <DoorOpen /> {busy === "public" ? "Looking..." : "Join a public room"}
          </Button>
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={!connected || busy !== null}
            onClick={() => void enter("create", () => request("room:create", { gameSlug: slug, visibility: "private" }))}
          >
            <Plus /> {busy === "create" ? "Creating..." : "Create room"}
          </Button>
        </div>

        {!connected && <p className="mt-4 text-sm text-muted-foreground">Connecting to the game server...</p>}

        {error && !existingRoom && (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error.message}
            {error instanceof RequestError && error.code === "NO_PUBLIC_ROOM" && " Create a room and make it public to start one."}
          </p>
        )}

        {existingRoom && existingCode && (
          <div role="alert" className="mt-4 space-y-3 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            <p>
              You are already in room <strong className="tracking-widest">{existingCode}</strong>. Leave it before joining another.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void navigate(`/${existingSlug}/room/${existingCode}`)}>
                Go to that room
              </Button>
              <Button size="sm" variant="outline" onClick={() => void leaveCurrentRoom()}>
                Leave it
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
