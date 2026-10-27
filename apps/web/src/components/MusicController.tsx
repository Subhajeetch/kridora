import { useEffect, useRef } from "react";
import { useAudioSettings } from "@/lib/audio-settings";

/** Drop an audio file at apps/web/public/audio/lobby-theme.mp3 to enable background music. */
const MUSIC_SRC = "/audio/lobby-theme.mp3";

/**
 * Plays looping background music. Browsers block autoplay, so playback starts on the first click/tap.
 * Renders nothing. If the file is missing it silently does nothing.
 */
export function MusicController() {
  const { muted, musicVolume } = useAudioSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const failedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.preload = "none";
    audio.addEventListener("error", () => {
      failedRef.current = true;
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    audio.muted = muted;
  }, [muted, musicVolume]);

  useEffect(() => {
    const start = () => {
      const audio = audioRef.current;
      if (!audio || failedRef.current || !audio.paused) return;
      audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);

  return null;
}
