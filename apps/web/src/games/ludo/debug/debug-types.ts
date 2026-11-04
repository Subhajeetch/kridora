import type { LudoGameState, RoomSnapshot } from "@kridora/shared";
import type { AudioSettings } from "@/lib/audio-settings";

export type DebugTab =
  "dice" | "pieces" | "cut" | "soundboard" | "presets" | "state";

export interface DebugPanelProps {
  state: LudoGameState;
  room: RoomSnapshot;
  userId: string;
  isRoomOwner: boolean;
  audioSettings: AudioSettings;
  onClose: () => void;
  onDisableDebug: () => void;
  onApplyStateOverride: (next: LudoGameState) => void;
}

export interface SoundEffectItem {
  id: string;
  name: string;
  category: "dice" | "movement" | "combat" | "game" | "room";
  description: string;
  action: (settings?: AudioSettings) => void;
}

export interface PresetScenario {
  id: string;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  action: () => Promise<void> | void;
}

export interface BoardCoordinateInfo {
  step: number;
  label: string;
  isSafe: boolean;
  isStar: boolean;
  isHomeLane: boolean;
  isGoal: boolean;
}
