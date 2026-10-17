import { Settings, Volume2, VolumeX, X } from "lucide-react"
import { useState } from "react"
import { Link, Outlet } from "react-router"
import { Background } from "@/components/Background"
import { Logo } from "@/components/Logo"
import { MusicController } from "@/components/MusicController"
import { RingsBadge } from "@/components/RingsBadge"
import { SettingsDialog } from "@/components/SettingsDialog"
import { SplashScreen } from "@/components/SplashScreen"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/useProfile"
import { authClient } from "@/lib/auth-client"
import { updateAudioSettings, useAudioSettings } from "@/lib/audio-settings"
import { useRealtime } from "@/providers/realtime-context"

/** Layout shared by every page: background, top bar (Rings, music, settings), toast area. */
export function AppShell() {
  const { data: session, isPending } = authClient.useSession()
  const { me } = useProfile()
  const audio = useAudioSettings()
  const { notice, dismissNotice, connection } = useRealtime()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (isPending) return <SplashScreen />

  return (
    <div className="min-h-dvh">
      <Background />
      <MusicController />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" aria-label="Kridora home" className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          <Logo />
        </Link>

        {session && (
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden max-w-40 truncate text-sm text-muted-foreground sm:block">{session.user.name}</span>
            <RingsBadge rings={me?.profile.rings} />
            <Button
              variant="outline"
              size="icon"
              aria-label={audio.muted ? "Unmute music" : "Mute music"}
              onClick={() => updateAudioSettings({ muted: !audio.muted })}
            >
              {audio.muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button variant="outline" size="icon" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
              <Settings />
            </Button>
          </div>
        )}
      </header>

      {session && connection === "disconnected" && (
        <p role="status" className="mx-auto mb-2 w-fit rounded-full bg-amber-400/10 px-4 py-1.5 text-sm text-amber-300">
          Connection lost. Reconnecting...
        </p>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 pb-16">
        <Outlet />
      </main>

      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm shadow-xl"
        >
          <span>{notice}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
