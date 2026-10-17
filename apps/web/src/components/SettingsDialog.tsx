import { LogOut } from "lucide-react"
import { useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { authClient } from "@/lib/auth-client"
import { updateAudioSettings, useAudioSettings } from "@/lib/audio-settings"
import { request } from "@/lib/socket"
import { useRealtime } from "@/providers/realtime-context"

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-sm font-medium">
        {label}
        <span className="tabular-nums text-muted-foreground">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-violet-400"
      />
    </label>
  )
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const audio = useAudioSettings()
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const { activeRoom, setActiveRoom } = useRealtime()

  async function logOut() {
    try {
      // Free the player's seat right away instead of waiting for the disconnect timers.
      if (activeRoom) await request("room:leave", {}).catch(() => undefined)
      setActiveRoom(null)
      await authClient.signOut()
    } finally {
      onOpenChange(false)
      void navigate("/")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Audio settings are saved on this device.</DialogDescription>

        <div className="mt-5 space-y-5">
          <Slider label="Music volume" value={audio.musicVolume} onChange={(musicVolume) => updateAudioSettings({ musicVolume })} />
          <Slider label="Sound effects" value={audio.sfxVolume} onChange={(sfxVolume) => updateAudioSettings({ sfxVolume })} />
          <label className="flex items-center justify-between text-sm font-medium">
            Mute everything
            <input
              type="checkbox"
              checked={audio.muted}
              onChange={(e) => updateAudioSettings({ muted: e.target.checked })}
              className="size-4 accent-violet-400"
            />
          </label>
        </div>

        {session && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/40 p-3">
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{session.user.name}</p>
              <p className="text-muted-foreground">{session.user.isAnonymous ? "Guest session" : session.user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void logOut()}>
              <LogOut /> {session.user.isAnonymous ? "End session" : "Log out"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
