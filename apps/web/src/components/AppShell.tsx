import { Settings, Volume2, VolumeX, X } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router"
import { AuthDialog } from "@/components/AuthDialog"
import { Background } from "@/components/Background"
import { Logo } from "@/components/Logo"
import { MusicController } from "@/components/MusicController"
import { PageTransition } from "@/components/PageTransition"
import { PlayerHud } from "@/components/PlayerHud"
import { RingsBadge } from "@/components/RingsBadge"
import { SettingsDialog } from "@/components/SettingsDialog"
import { SplashScreen } from "@/components/SplashScreen"
import { Button } from "@/components/ui/button"
import { useProfile } from "@/hooks/useProfile"
import { authClient } from "@/lib/auth-client"
import { updateAudioSettings, useAudioSettings } from "@/lib/audio-settings"
import { useGameLayout } from "@/providers/game-layout-context"
import { useRealtime } from "@/providers/realtime-context"

/** Layout shared by every page: background, top bar (HUD, Rings, music, settings), toast area. */
export function AppShell() {
  const { data: rawSession, isPending } = authClient.useSession()
  const session =
    rawSession && typeof rawSession === "object" && "user" in rawSession && rawSession.user
      ? rawSession
      : null
  const { me } = useProfile()
  const audio = useAudioSettings()
  const { notice, dismissNotice, connection } = useRealtime()
  const { inGameMode } = useGameLayout()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  if (isPending) return <SplashScreen />

  return (
    <div className="min-h-dvh">
      <Background />
      <MusicController />

      {!inGameMode && (
        <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link to="/" aria-label="Kridora home" className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <Logo />
          </Link>

          {session?.user ? (
            <div className="flex items-center gap-2">
              <PlayerHud
                name={session.user.name}
                level={me?.profile.level}
                xp={me?.profile.xp}
                isGuest={Boolean(session.user.isAnonymous ?? me?.user.isAnonymous)}
                isVerified={Boolean(!(session.user.isAnonymous ?? me?.user.isAnonymous) && (me?.user.emailVerified ?? session.user.emailVerified))}
              />
              <RingsBadge rings={me?.profile.rings} />
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-white/10 bg-panel/70 hover:border-primary/60 hover:text-primary"
                aria-label={audio.muted ? "Unmute music" : "Mute music"}
                onClick={() => updateAudioSettings({ muted: !audio.muted })}
              >
                {audio.muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-white/10 bg-panel/70 hover:border-primary/60 hover:text-primary"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl border-white/10 bg-panel/70 hover:border-primary/60 hover:text-primary"
                aria-label={audio.muted ? "Unmute music" : "Mute music"}
                onClick={() => updateAudioSettings({ muted: !audio.muted })}
              >
                {audio.muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-white/10 bg-panel/70 hover:border-primary/60 hover:text-primary"
                onClick={() => setAuthOpen(true)}
              >
                Sign In
              </Button>
            </div>
          )}
        </header>
      )}

      {session && connection === "disconnected" && (
        <p role="status" className="mx-auto mb-2 w-fit rounded-full bg-coin/10 px-4 py-1.5 text-sm text-coin">
          Connection lost. Reconnecting...
        </p>
      )}

      <main className="w-full">
        <PageTransition />
      </main>

      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 overflow-hidden rounded-2xl border border-primary/30 bg-panel py-3 pr-3 pl-5 text-sm shadow-xl"
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
          <span>{notice}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismissNotice}>
            <X />
          </Button>
        </div>
      )}

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
