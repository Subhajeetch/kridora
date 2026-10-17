import {
  getGameDefinition,
  roomCodeSchema,
  type GameSlug,
  type RoomPlayer,
  type RoomSnapshot,
  type RoomVisibility,
} from "@kridora/shared"
import { Check, Copy, Crown, Globe, Link as LinkIcon, Lock, LogOut, Play, UserX, WifiOff } from "lucide-react"
import { Suspense, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { RequireIdentity } from "@/components/RequireIdentity"
import { Button, buttonVariants } from "@/components/ui/button"
import { findEnabledGame } from "@/config/games"
import { gameComponents } from "@/games/registry"
import { useCountdown } from "@/hooks/useCountdown"
import { authClient } from "@/lib/auth-client"
import { describeError, request, RequestError } from "@/lib/socket"
import { cn } from "@/lib/utils"
import { useRealtime } from "@/providers/realtime-context"
import NotFoundPage from "./NotFoundPage"

/** yourdomain.com/<game>/room/<CODE> */
export default function RoomPage() {
  const { slug, code } = useParams()
  const gameSlug = findEnabledGame(slug)
  const parsedCode = roomCodeSchema.safeParse(code ?? "")
  if (!gameSlug || !parsedCode.success) return <NotFoundPage />
  return (
    <RequireIdentity>
      <RoomLoader gameSlug={gameSlug} code={parsedCode.data} />
    </RequireIdentity>
  )
}

/** Joins (or re-joins) the room named in the URL, then hands the live state to <RoomView>. */
function RoomLoader({ gameSlug, code }: { gameSlug: GameSlug; code: string }) {
  const navigate = useNavigate()
  const { connection, activeRoom, setActiveRoom } = useRealtime()
  const { data: session } = authClient.useSession()
  const [phase, setPhase] = useState<"joining" | "ready" | "error">("joining")
  const [error, setError] = useState<RequestError | null>(null)

  // Joining is idempotent on the server, so this also handles refreshes, reconnects and invite links.
  useEffect(() => {
    if (connection !== "connected") return
    let cancelled = false
    request("room:join", { code })
      .then((room) => {
        if (cancelled) return
        setActiveRoom(room)
        setPhase("ready")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof RequestError ? err : new RequestError("INTERNAL_ERROR", describeError(err)))
        setPhase("error")
      })
    return () => {
      cancelled = true
    }
  }, [connection, code, setActiveRoom])

  // Kicked, or the room was closed: the provider cleared activeRoom, so go back to the game's front door.
  useEffect(() => {
    if (phase === "ready" && !activeRoom) void navigate(`/${gameSlug}`, { replace: true })
  }, [phase, activeRoom, gameSlug, navigate])

  // The URL said one game but the room belongs to another: fix the URL.
  useEffect(() => {
    if (activeRoom && activeRoom.code === code && activeRoom.gameSlug !== gameSlug) {
      void navigate(`/${activeRoom.gameSlug}/room/${code}`, { replace: true })
    }
  }, [activeRoom, code, gameSlug, navigate])

  if (phase === "error" && error) {
    const roomCode = typeof error.details?.roomCode === "string" ? error.details.roomCode : null
    const roomGame = typeof error.details?.gameSlug === "string" ? error.details.gameSlug : gameSlug
    return (
      <section className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold">Could not join this room</h1>
        <p className="mt-3 text-muted-foreground">{error.message}</p>
        <div className="mt-8 flex justify-center gap-3">
          {error.code === "ALREADY_IN_ROOM" && roomCode && (
            <Link to={`/${roomGame}/room/${roomCode}`} className={buttonVariants({ size: "lg" })}>
              Go to your room
            </Link>
          )}
          <Link to={`/${gameSlug}`} className={buttonVariants({ size: "lg", variant: "outline" })}>
            Back to {getGameDefinition(gameSlug).name}
          </Link>
        </div>
      </section>
    )
  }

  const room = activeRoom && activeRoom.code === code ? activeRoom : null
  if (!room || !session) {
    return <p className="py-24 text-center text-muted-foreground">Joining room {code}...</p>
  }
  return <RoomView room={room} userId={session.user.id} />
}

function PlayerRow({
  player,
  room,
  isMe,
  canManage,
  onMakeOwner,
  onKick,
  disabled,
}: {
  player: RoomPlayer
  room: RoomSnapshot
  isMe: boolean
  canManage: boolean
  onMakeOwner: () => void
  onKick: () => void
  disabled: boolean
}) {
  const isOwner = player.userId === room.ownerId
  const inLobby = room.status === "lobby"
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-background/40 px-3 py-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-violet-500/20 text-sm font-semibold",
          !player.connected && "opacity-50",
        )}
        aria-hidden="true"
      >
        {player.name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          <span className="truncate">{player.name}</span>
          {isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
          {isOwner && <Crown className="size-4 shrink-0 text-amber-300" aria-label="Room owner" />}
        </p>
        <p className="text-xs text-muted-foreground">
          {!player.connected ? (
            <span className="inline-flex items-center gap-1 text-amber-300">
              <WifiOff className="size-3" /> Offline
            </span>
          ) : isOwner ? (
            "Owner"
          ) : inLobby ? (
            player.isReady ? <span className="text-emerald-300">Ready</span> : "Not ready"
          ) : (
            "Playing"
          )}
          {player.isAnonymous ? " (guest)" : ""}
        </p>
      </div>
      {canManage && !isMe && (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" title="Make owner" aria-label={`Make ${player.name} the owner`} disabled={disabled} onClick={onMakeOwner}>
            <Crown />
          </Button>
          {inLobby && (
            <Button variant="ghost" size="icon-sm" title="Remove from room" aria-label={`Remove ${player.name}`} disabled={disabled} onClick={onKick}>
              <UserX />
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function RoomView({ room, userId }: { room: RoomSnapshot; userId: string }) {
  const navigate = useNavigate()
  const { setActiveRoom, clockOffset } = useRealtime()
  const game = getGameDefinition(room.gameSlug)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)

  const me = room.players.find((p) => p.userId === userId)
  const owner = room.players.find((p) => p.userId === room.ownerId)
  const isOwner = room.ownerId === userId

  // Who becomes owner if the current owner stays offline (first joined player who is online).
  const successor = room.players.find((p) => p.userId !== room.ownerId && p.connected)
  const secondsLeft = useCountdown(room.ownerTransferAt, clockOffset)

  async function act(action: () => Promise<RoomSnapshot>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setActiveRoom(await action())
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    if (busy) return
    setBusy(true)
    try {
      await request("room:leave", {})
      setActiveRoom(null)
      void navigate(`/${room.gameSlug}`)
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
    }
  }

  async function copy(kind: "code" | "link") {
    const text = kind === "code" ? room.code : `${window.location.origin}/${room.gameSlug}/room/${room.code}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError("Could not copy. Select the code and copy it manually.")
    }
  }

  const header = (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{game.name}</h1>
        <p className="text-sm text-muted-foreground">
          Room {room.code} ({room.visibility})
        </p>
      </div>
      <Button variant="outline" onClick={() => void leave()} disabled={busy}>
        <LogOut /> Leave room
      </Button>
    </div>
  )

  if (room.status === "in_progress") {
    const GameComponent = gameComponents[room.gameSlug]
    return (
      <section className="py-6">
        {header}
        {secondsLeft !== null && owner && (
          <p role="status" className="mb-4 rounded-2xl bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
            The owner ({owner.name}) is offline.
            {successor ? ` ${successor.name} becomes owner in ${secondsLeft}s.` : ""}
          </p>
        )}
        <Suspense fallback={<p className="py-12 text-center text-muted-foreground">Loading game...</p>}>
          <GameComponent room={room} userId={userId} />
        </Suspense>
      </section>
    )
  }

  const emptySeats = Math.max(0, room.maxPlayers - room.players.length)

  return (
    <section className="py-6">
      {header}

      {secondsLeft !== null && owner && (
        <p role="status" className="mb-4 rounded-2xl bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          The owner ({owner.name}) is offline.
          {successor ? ` ${successor.name} becomes owner in ${secondsLeft}s.` : " Waiting for them to come back."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
          <h2 className="mb-3 font-semibold">
            Players ({room.players.length}/{room.maxPlayers})
          </h2>
          <ul className="space-y-2">
            {room.players.map((p) => (
              <PlayerRow
                key={p.userId}
                player={p}
                room={room}
                isMe={p.userId === userId}
                canManage={isOwner}
                disabled={busy}
                onMakeOwner={() => void act(() => request("room:transfer-owner", { userId: p.userId }))}
                onKick={() => void act(() => request("room:kick", { userId: p.userId }))}
              />
            ))}
            {Array.from({ length: emptySeats }, (_, i) => (
              <li key={`empty-${i}`} className="rounded-2xl border border-dashed border-white/10 px-3 py-3 text-sm text-muted-foreground">
                Waiting for a player...
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
            <p className="text-sm text-muted-foreground">Room code</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-3xl font-bold tracking-[0.25em]">{room.code}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  room.visibility === "public" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/5 text-muted-foreground",
                )}
              >
                {room.visibility === "public" ? <Globe className="size-3" /> : <Lock className="size-3" />}
                {room.visibility === "public" ? "Public" : "Private"}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void copy("code")}>
                {copied === "code" ? <Check /> : <Copy />} {copied === "code" ? "Copied" : "Copy code"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copy("link")}>
                {copied === "link" ? <Check /> : <LinkIcon />} {copied === "link" ? "Copied" : "Copy invite link"}
              </Button>
            </div>
            {isOwner && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                disabled={busy}
                onClick={() => {
                  const next: RoomVisibility = room.visibility === "public" ? "private" : "public"
                  void act(() => request("room:set-visibility", { visibility: next }))
                }}
              >
                {room.visibility === "public" ? "Make private" : "Make public"}
              </Button>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-card/70 p-5">
            {isOwner ? (
              <>
                <Button
                  size="lg"
                  className="h-12 w-full text-base"
                  disabled={busy || !room.start.canStart}
                  onClick={() => void act(() => request("room:start", {}))}
                >
                  <Play /> Start game
                </Button>
                {!room.start.canStart && (
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {room.start.unmet.map((u) => (
                      <li key={u.code + u.message}>{u.message}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  variant={me?.isReady ? "secondary" : "default"}
                  className="h-12 w-full text-base"
                  disabled={busy}
                  onClick={() => void act(() => request("room:set-ready", { ready: !me?.isReady }))}
                >
                  {me?.isReady ? "Not ready" : "I am ready"}
                </Button>
                <p className="mt-3 text-sm text-muted-foreground">
                  Waiting for {owner?.name ?? "the owner"} to start the game.
                </p>
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
