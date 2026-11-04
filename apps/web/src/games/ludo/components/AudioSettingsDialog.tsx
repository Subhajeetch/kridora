import { Volume, Volume1, Volume2, VolumeX, Play, Check } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AudioSettings } from "@/lib/audio-settings";
import { ludoAudio } from "../audio";

interface AudioSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioSettings: AudioSettings;
  isMuted: boolean;
  toggleMute: () => void;
  setSfxVolume: (volume: number) => void;
}

export function AudioSettingsDialog({
  open,
  onOpenChange,
  audioSettings,
  isMuted,
  toggleMute,
  setSfxVolume,
}: AudioSettingsDialogProps) {
  const [tested, setTested] = useState(false);

  const currentPercent = isMuted
    ? 0
    : Math.round(audioSettings.sfxVolume * 100);

  const handleSliderChange = useCallback(
    (val: number) => {
      const normalized = Math.max(0, Math.min(1, val / 100));
      setSfxVolume(normalized);
      if (isMuted && normalized > 0) {
        toggleMute();
      }
    },
    [isMuted, setSfxVolume, toggleMute],
  );

  const handleStepVolume = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(100, currentPercent + delta));
      handleSliderChange(next);
    },
    [currentPercent, handleSliderChange],
  );

  const handleTestSound = useCallback(() => {
    ludoAudio.diceLand(6, audioSettings);
    setTested(true);
    window.setTimeout(() => setTested(false), 900);
  }, [audioSettings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-amber-400/25 bg-[#121422] p-5 sm:p-6 text-white shadow-2xl backdrop-blur-xl">
        <DialogCloseButton onClick={() => onOpenChange(false)} />

        {/* Header */}
        <div className="flex items-center gap-3 pr-7">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-300 shadow-md">
            {isMuted || currentPercent === 0 ? (
              <VolumeX className="size-5 text-rose-400" />
            ) : currentPercent < 50 ? (
              <Volume1 className="size-5 text-amber-300" />
            ) : (
              <Volume2 className="size-5 text-amber-300" />
            )}
          </div>
          <div>
            <DialogTitle className="text-lg font-black text-white tracking-tight">
              Sound Settings
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-slate-400">
              Adjust volume and sound effects for your Ludo match
            </DialogDescription>
          </div>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-5">
          {/* Volume Control Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-200">
                Volume Level
              </span>
              <span className="tabular-nums font-mono text-sm font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                {currentPercent}%
              </span>
            </div>

            {/* Slider with - / + Stepper Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleStepVolume(-10)}
                disabled={currentPercent <= 0}
                aria-label="Decrease volume"
                className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Volume1 className="size-4" />
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={currentPercent}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  aria-label="Sound effects volume slider"
                  className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400 transition-all"
                />
              </div>

              <button
                type="button"
                onClick={() => handleStepVolume(10)}
                disabled={currentPercent >= 100}
                aria-label="Increase volume"
                className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Volume2 className="size-4" />
              </button>
            </div>

            {/* Preset Volume Quick Buttons */}
            <div className="mt-4 grid grid-cols-5 gap-1.5 pt-2 border-t border-white/5">
              {[
                { label: "0%", val: 0 },
                { label: "25%", val: 25 },
                { label: "50%", val: 50 },
                { label: "75%", val: 75 },
                { label: "100%", val: 100 },
              ].map((p) => {
                const isActive = !isMuted && currentPercent === p.val;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (p.val === 0) {
                        if (!isMuted) toggleMute();
                      } else {
                        handleSliderChange(p.val);
                      }
                    }}
                    className={`rounded-xl py-1 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-amber-400 text-slate-950 shadow-sm"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mute All Sounds Toggle Card */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div
                className={`grid size-9 place-items-center rounded-xl border ${
                  isMuted
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {isMuted ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume className="size-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Mute all sounds
                </p>
                <p className="text-xs text-slate-400">
                  {isMuted
                    ? "Sound is currently muted"
                    : "Audio playback enabled"}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isMuted}
              onClick={toggleMute}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isMuted ? "bg-amber-400" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isMuted ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Audio Preview & Done Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestSound}
              disabled={isMuted || currentPercent === 0}
              className="gap-2 rounded-xl border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 active:scale-95 disabled:opacity-40"
            >
              {tested ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span>Playing!</span>
                </>
              ) : (
                <>
                  <Play className="size-3.5 fill-current" />
                  <span>Test Sound</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 px-5"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
