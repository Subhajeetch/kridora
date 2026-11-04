# Adding a game

A game is three small pieces. Everything else (accounts, room codes, public matchmaking, ready-up, owner transfer,
start validation, reconnects) is already handled by the platform.

## 1. Describe it - `packages/shared/src/games/registry.ts`

```ts
export const GAME_DEFINITIONS = {
  monopoly: {
    slug: "monopoly", // URL: yourdomain.com/monopoly
    name: "Monopoly",
    tagline: "Buy, trade and bankrupt your friends.",
    description: "...",
    accent: "#f43f5e",
    playTime: "60-120 min",
    minPlayers: 2,
    maxPlayers: 6,
    requirements: {
      allPlayersReady: true, // every non-owner must press "I am ready"
      allPlayersConnected: true, // nobody may be offline when the owner presses Start
    },
    // optional game-specific rules; each unmet rule disables Start and is shown to the owner
    extraRequirements: ({ players }) =>
      players.length % 2 === 0
        ? []
        : [
            {
              code: "GAME_SPECIFIC",
              message: "Needs an even number of players",
            },
          ],
  },
} satisfies Record<string, GameDefinition>;
```

The same `evaluateStartRequirements` runs in the browser (to disable the Start button and list the reasons)
and on the server (to refuse a start request that skips the UI).

## 2. Turn it on - `packages/shared/src/games/config.development.ts` / `config.production.ts`

Add the slug to the development list to test it, and to the production list when it is ready to ship.
These two files decide what appears on `/games` and whether rooms for that game can be created.

## 3. Give it a screen - `apps/web/src/games/<slug>/main.tsx`

Default-export a component that takes `GameComponentProps`:

```tsx
import type { GameComponentProps } from "../types";
import { useInGameRoom, useGameAudio } from "@/games/hooks";

const Monopoly = ({ room, userId }: GameComponentProps) => {
  // Use in-game room hooks to build your custom HUD & controls
  const { onBackToRoom, playerCount, maxPlayers, roomCode, game } = useInGameRoom();
  const { isMuted, toggleMute } = useGameAudio();

  return (
    <div className="flex h-full w-full flex-col items-center justify-between overflow-hidden">
      {/* Custom Game HUD */}
      <header className="flex w-full items-center justify-between p-3">
        <button onClick={onBackToRoom} className="text-xs font-bold">
          ← Room ({playerCount}/{maxPlayers})
        </button>
        <span className="font-mono text-xs font-bold">Code: {roomCode}</span>
        <button onClick={toggleMute} className="text-xs">
          {isMuted ? "Unmute" : "Mute"}
        </button>
      </header>

      {/* Game Board */}
      <main className="flex-1">
        {/* Your game board goes here */}
      </main>
    </div>
  );
};

export default Monopoly;
```

Register it in `apps/web/src/games/registry.ts`. The registry is typed as `Record<GameSlug, ...>`, so forgetting
this step is a compile error.

## In-Game Room Hooks (`@/games/hooks`)

Games have 100% full viewport ownership without an external platform header forced over the screen.
To build your in-game navigation, player badges, audio controls, or pause menu, import hooks from `@/games/hooks`:

| Hook | Returns | Description |
| --- | --- | --- |
| `useInGameRoom()` | `InGameRoomContextValue` | Full in-game context: `{ room, userId, game, roomCode, playerCount, maxPlayers, onBackToRoom, onLeaveRoom, isLeaving, secondsLeft, owner, successor }` |
| `useBackToRoom()` | `() => void` | Switches the view mode from the active game back to the room roster/settings lobby |
| `useRoomCode()` | `string` | The 4-letter room join code (e.g. `"ABCD"`) |
| `useRoomPlayers()` | `{ playerCount, maxPlayers, players }` | Room player counts and the array of `RoomPlayer` objects |
| `useCurrentGame()` | `GameDefinition` | Selected game definition (`name`, `slug`, `accent`, etc.) |
| `useLeaveRoom()` | `{ onLeaveRoom, isLeaving }` | Handler to leave the room and return to the game lobby |
| `useHostCountdown()` | `{ secondsLeft, owner, successor }` | Host disconnect countdown: seconds left until host migration if owner goes offline |
| `useGameAudio()` | `{ audio, isMuted, toggleMute, setSfxVolume, setMusicVolume }` | Game audio controller: mute/unmute and volume adjustment |

## What the platform does for you

| Step                                                                             | Where it lives                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `/monopoly` front door: "Join a public room" and "Create room"                   | `apps/web/src/pages/GameLobbyPage.tsx`              |
| Room code, private/public toggle, player list, ready-up, kick, make owner, Start | `apps/web/src/pages/RoomPage.tsx`                   |
| Start button disabled until requirements are met, reasons listed                 | `evaluateStartRequirements`                         |
| Owner offline 40s -> ownership goes to the earliest-joined online player         | `apps/api/src/rooms/service.ts` (`processDeadline`) |
| Game screen is shown once `room.status === "in_progress"`                        | `RoomPage.tsx` -> your component with `InGameRoomProvider` |
| A `matches` row + `match_players` rows are created on start (`room.matchId`)     | `createMatch` in `@kridora/db`                      |

## Building the actual gameplay (next step)

The room only gets players to the start line. For in-game traffic, add events beside the room events:

1. Add event names + payload schemas in `packages/shared/src/socket-events.ts`.
2. Add handlers in `apps/api/src/realtime/handlers.ts` (each payload is validated with zod before it runs).
3. Keep the authoritative game state on the server (Redis or memory keyed by `room.matchId`). Never trust the
   client for dice rolls, money, turns, etc.
4. Broadcast to `roomChannel(code)` (see `realtime/types.ts`) and read it in your component through `useRealtime().socket`.
5. When the game ends, set `matches.status = "completed"`, fill `match_players.placement / xpEarned / ringsEarned`,
   and pay rings with `grantRings({ type: "game_reward", referenceType: "match", referenceId: matchId,
idempotencyKey: `match:${matchId}:${userId}` })`.

Players who leave mid-game are removed from the room; decide in your game logic how to treat their seat
(bot, bankrupt, forfeit). Players who only lose connection stay in the room and are marked offline.
