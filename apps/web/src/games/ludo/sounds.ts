import type { AudioSettings } from "@/lib/audio-settings";
import { ludoAudio } from "./audio";

export type LudoSoundEvent =
  | "turn"
  | "roll"
  | "step"
  | "unlock"
  | "capture"
  | "home"
  | "win"
  | "invalid"
  | "safe";

export function playLudoSound(sound: LudoSoundEvent, settings: AudioSettings) {
  switch (sound) {
    case "roll":
      ludoAudio.diceRoll(settings);
      break;
    case "step":
      ludoAudio.hop(0, settings);
      break;
    case "unlock":
      ludoAudio.unlockBase(settings);
      break;
    case "capture":
      ludoAudio.captureHit(settings);
      break;
    case "home":
      ludoAudio.homeFinish(settings);
      break;
    case "win":
      ludoAudio.victory(settings);
      break;
    case "invalid":
      ludoAudio.invalid(settings);
      break;
    case "safe":
      ludoAudio.safeZone(settings);
      break;
    case "turn":
      ludoAudio.unlockBase(settings);
      break;
  }
}
