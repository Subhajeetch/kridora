import type { RoomSnapshot } from "@kridora/shared"

/**
 * Props every game component receives once the owner presses Start.
 * The component owns everything on screen from then on.
 */
export interface GameComponentProps {
  room: RoomSnapshot
  /** The signed-in player's id (compare with room.players[].userId). */
  userId: string
}
