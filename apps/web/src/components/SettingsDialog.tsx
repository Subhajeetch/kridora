import { LogOut, Volume2 } from "lucide-react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { updateAudioSettings, useAudioSettings } from "@/lib/audio-settings";
import { request } from "@/lib/socket";
import { useRealtime } from "@/providers/realtime-context";

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-sm font-medium">
        {label}
        <span className="tabular-nums text-[#facc15] font-semibold">
          {Math.round(value * 100)}%
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-[#facc15] h-2 bg-white/10 pixel-corners-sm cursor-pointer"
      />
    </label>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const audio = useAudioSettings();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { activeRoom, setActiveRoom } = useRealtime();

  async function logOut() {
    try {
      // Free the player's seat right away instead of waiting for the disconnect timers.
      if (activeRoom) await request("room:leave", {}).catch(() => undefined);
      setActiveRoom(null);
      await authClient.signOut();
    } finally {
      onOpenChange(false);
      void navigate("/");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogCloseButton onClick={() => onOpenChange(false)} />

        <div className="flex items-center gap-3 pr-6">
          <div className="pixel-corners-sm bg-[#facc15] p-[2px] shrink-0 filter drop-shadow-[0_2px_0_#78350f]">
            <div className="grid size-10 place-items-center pixel-corners-sm bg-[#12131a] text-[#facc15]">
              <Volume2 className="size-5" />
            </div>
          </div>
          <div>
            <DialogTitle className="font-retro text-base sm:text-lg font-bold uppercase tracking-wide text-white">
              Settings
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              Audio settings are saved on this device.
            </DialogDescription>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <Slider
            label="Music volume"
            value={audio.musicVolume}
            onChange={(musicVolume) => updateAudioSettings({ musicVolume })}
          />
          <Slider
            label="Sound effects"
            value={audio.sfxVolume}
            onChange={(sfxVolume) => updateAudioSettings({ sfxVolume })}
          />
          <label className="flex items-center justify-between text-sm font-medium">
            Mute everything
            <input
              type="checkbox"
              checked={audio.muted}
              onChange={(e) => updateAudioSettings({ muted: e.target.checked })}
              className="size-4 accent-[#facc15] cursor-pointer"
            />
          </label>
        </div>

        {session && (
          <div className="mt-6 pixel-corners-sm bg-white/20 p-[2px] filter drop-shadow-[0_2px_0_#000000]">
            <div className="flex items-center justify-between gap-3 pixel-corners-sm bg-[#12131a] p-3.5">
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-white">
                  {session.user.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {session.user.isAnonymous
                    ? "Guest session"
                    : session.user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logOut()}
                className="filter drop-shadow-[0_2px_0_#000000] active:translate-y-0.5 active:drop-shadow-none transition-all cursor-pointer"
              >
                <div className="pixel-corners-sm bg-white/20 hover:bg-rose-500 p-[1.5px] transition-colors">
                  <div className="pixel-corners-sm bg-[#12131a] hover:bg-rose-950/40 text-gray-300 hover:text-white font-retro text-[10px] font-bold uppercase tracking-wider h-7 px-2.5 flex items-center gap-1.5 transition-colors">
                    <LogOut className="size-3" />
                    <span>
                      {session.user.isAnonymous ? "End session" : "Log out"}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
