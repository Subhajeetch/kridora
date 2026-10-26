import type { RoomSnapshot } from "@kridora/shared"
import { motion, useReducedMotion } from "framer-motion"
import { AlertCircle, ArrowLeft, Gamepad2, Users, Wifi } from "lucide-react"
import { useEffect, useState } from "react"
import { GameThumbnail } from "@/components/games/GameThumbnail"
import { Button } from "@/components/ui/button"

interface GameLaunchScreenProps {
  room: RoomSnapshot
  gameName: string
  onBackToRoom?: () => void
  statusMessage?: string
}

const STAGES = [
  "Connecting to game match...",
  "Loading game assets & scripts...",
  "Synchronizing player states...",
  "Preparing the game arena...",
]

export function GameLaunchScreen({
  room,
  gameName,
  onBackToRoom,
  statusMessage,
}: GameLaunchScreenProps) {
  const reduce = useReducedMotion()
  const [stageIndex, setStageIndex] = useState(0)
  const [slowLoading, setSlowLoading] = useState(false)

  // Cycle through loading steps to give the player real feedback
  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev))
    }, 450)

    // In case loading takes unusually long (e.g., poor connection)
    const slowTimer = setTimeout(() => {
      setSlowLoading(true)
    }, 7000)

    return () => {
      clearInterval(stageTimer)
      clearTimeout(slowTimer)
    }
  }, [])

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col items-center justify-center py-10 px-4 text-center">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-radial from-neon-cyan/15 via-transparent to-transparent blur-2xl"
        aria-hidden="true"
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full rounded-3xl border border-white/15 bg-panel/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/60"
      >
        {/* Game Icon & Name Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative size-20 sm:size-24 overflow-hidden rounded-2xl border-2 border-neon-cyan/40 shadow-[0_0_24px_rgba(34,228,255,0.25)]">
            <GameThumbnail slug={room.gameSlug} name={gameName} className="size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-panel/70 via-transparent to-transparent" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-neon-cyan">
              <Gamepad2 className="size-3.5" />
              <span>Match In Progress</span>
            </div>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl uppercase tracking-wider text-foreground">
              {gameName}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono tracking-widest text-muted-foreground">
              ROOM: <strong className="text-foreground">{room.code}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground">
              <Users className="size-3 text-neon-pink" />
              <span>{room.players.length} Players</span>
            </span>
          </div>
        </div>

        {/* Player Roster Preview */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Synchronized Players
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {room.players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-panel-2/70 px-2.5 py-1 text-xs"
              >
                <span className="grid size-5 place-items-center rounded-full bg-neon-cyan/20 text-[10px] font-bold text-neon-cyan">
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[100px] truncate text-foreground font-medium">
                  {player.name}
                </span>
                <span
                  className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"
                  title="Connected"
                />
              </div>
            ))}
          </div>
        </div>

        {/* High-tech Loading Progress */}
        <div className="mt-7 flex flex-col items-center gap-2.5">
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10 p-0.5">
            <div className="load-bar h-full w-full rounded-full bg-linear-to-r from-neon-cyan via-neon-pink to-neon-violet shadow-[0_0_12px_rgba(34,228,255,0.5)]" />
          </div>

          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-foreground/80">
            <Wifi className="size-3 animate-pulse text-neon-cyan" />
            <span>{statusMessage ?? STAGES[stageIndex]}</span>
          </div>
        </div>

        {/* Slow Network / Error Recovery option */}
        {slowLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-4 shrink-0 text-amber-300" />
              <span>Loading is taking longer than expected. Connection may be slow.</span>
            </div>
            {onBackToRoom && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBackToRoom}
                className="h-8 gap-1.5 rounded-xl border-amber-400/30 text-amber-200 hover:bg-amber-400/10"
              >
                <ArrowLeft className="size-3.5" /> Back to Room Lobby
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
