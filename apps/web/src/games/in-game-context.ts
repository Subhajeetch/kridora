import type { GameDefinition, RoomPlayer, RoomSnapshot } from "@kridora/shared";
import { createContext, useContext } from "react";
import {
  updateAudioSettings,
  useAudioSettings,
  type AudioSettings,
} from "@/lib/audio-settings";

export interface InGameRoomContextValue {
  /** The full active RoomSnapshot */
  room: RoomSnapshot;
  /** Current user id */
  userId: string;
  /** Game definition from registry (name, slug, accent, etc.) */
  game: GameDefinition;
  /** Room code (e.g. "ABCD") */
  roomCode: string;
  /** Current number of players in the room */
  playerCount: number;
  /** Maximum number of players allowed in the room */
  maxPlayers: number;
  /** Switch view back to room lobby / player roster screen */
  onBackToRoom: () => void;
  /** Leave room handler (disconnects and returns to game lobby) */
  onLeaveRoom: () => void;
  /** Whether leave operation is currently in progress */
  isLeaving: boolean;
  /** Host countdown seconds left if the room owner is offline (null if host is online) */
  secondsLeft: number | null;
  /** The room owner (host) player */
  owner: RoomPlayer | undefined;
  /** The designated successor host if owner stays offline */
  successor: RoomPlayer | undefined;
}

export const InGameRoomContext = createContext<InGameRoomContextValue | null>(
  null,
);

/**
 * Access the complete in-game room context.
 * Throws if called outside an active InGameRoomProvider.
 */
export function useInGameRoom(): InGameRoomContextValue {
  const ctx = useContext(InGameRoomContext);
  if (!ctx) {
    throw new Error(
      "useInGameRoom must be used within an active InGameRoomProvider.",
    );
  }
  return ctx;
}

/**
 * Hook to navigate back to the room roster & settings screen mid-game.
 */
export function useBackToRoom(): () => void {
  const { onBackToRoom } = useInGameRoom();
  return onBackToRoom;
}

/**
 * Hook to access current room code.
 */
export function useRoomCode(): string {
  const { roomCode } = useInGameRoom();
  return roomCode;
}

/**
 * Hook to access room player counts and player list.
 */
export function useRoomPlayers(): {
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayer[];
} {
  const { playerCount, maxPlayers, room } = useInGameRoom();
  return { playerCount, maxPlayers, players: room.players };
}

/**
 * Hook to access the selected game definition.
 */
export function useCurrentGame(): GameDefinition {
  const { game } = useInGameRoom();
  return game;
}

/**
 * Hook to trigger room leave and check leave pending state.
 */
export function useLeaveRoom(): {
  onLeaveRoom: () => void;
  isLeaving: boolean;
} {
  const { onLeaveRoom, isLeaving } = useInGameRoom();
  return { onLeaveRoom, isLeaving };
}

/**
 * Hook to monitor host transfer countdown if the room owner goes offline.
 */
export function useHostCountdown(): {
  secondsLeft: number | null;
  owner: RoomPlayer | undefined;
  successor: RoomPlayer | undefined;
} {
  const { secondsLeft, owner, successor } = useInGameRoom();
  return { secondsLeft, owner, successor };
}

/**
 * Hook for in-game audio control (mute/unmute, volume control).
 */
export function useGameAudio(): {
  audio: AudioSettings;
  isMuted: boolean;
  toggleMute: () => void;
  setSfxVolume: (sfxVolume: number) => void;
  setMusicVolume: (musicVolume: number) => void;
} {
  const audio = useAudioSettings();
  const toggleMute = () => updateAudioSettings({ muted: !audio.muted });
  const setSfxVolume = (sfxVolume: number) =>
    updateAudioSettings({ sfxVolume });
  const setMusicVolume = (musicVolume: number) =>
    updateAudioSettings({ musicVolume });

  return {
    audio,
    isMuted: audio.muted,
    toggleMute,
    setSfxVolume,
    setMusicVolume,
  };
}
