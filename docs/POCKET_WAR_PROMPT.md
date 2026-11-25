# Pocket War — Master Implementation Prompt & Architectural Context

> **Instructions for the AI Game Engineer**:
> You are tasked with implementing the full, production-ready game engine and client/server experience for **"Pocket War"** (an adrenaline-pumping 2D multiplayer shooter inspired by _Doodle Army 2: Mini Militia_) inside the **Kridora** platform.
>
> All scaffolding, folders, socket contracts, type definitions, and game registries have already been created and verified. Read this entire document carefully, respect the platform invariants, and deliver the complete game engine files as specified below.

---

## 1. Project Overview & Architectural Boundaries

Kridora is a high-performance real-time multiplayer web gaming platform built as a Turborepo monorepo:

```text
kridora/
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono, Better Auth, Durable Objects RealtimeHub)
│   └── web/                 # React 19 + Vite frontend (Tailwind CSS v4, Lucide, Framer Motion)
├── docs/                    # Platform documentation (ADDING_A_GAME.md, CONTRIBUTING.md, USAGE.md)
├── packages/
│   ├── db/                  # Drizzle ORM schemas, D1 migrations, atomic Rings ledger
│   ├── shared/              # Shared TypeScript types, Zod schemas, socket contracts, game definitions
│   └── typescript-config/   # Shared tsconfig bases
```

### Strict Platform Invariants (NEVER VIOLATE)

1. **Never touch platform UI or room pages**:
   - **Do NOT** modify `apps/web/src/pages/GameLobbyPage.tsx` or `apps/web/src/pages/RoomPage.tsx`. Room matchmaking, roster lists, invite links, and start validations are managed uniformly for all games.
   - All game visuals, canvas renderers, HUDs, audio, controls, and menus must live **strictly inside**: `apps/web/src/games/pocket-war/`.
2. **Pre-game settings live inside the game after launch**:
   - Room owner configures map, kill target, and game mode **inside the game screen AFTER entering the game** (`room.status === "in_progress"`).
   - When the host clicks "Start Match", the game transitions from `phase: "setup"` to `phase: "playing"`. Non-host players see a waiting screen with live preview.
3. **Edge-native backend**:
   - Backend runs on Cloudflare Workers and Durable Objects (`RealtimeHub`) with the WebSocket Hibernation API.
   - Modular game events (`pocket-war:*`) are dispatched directly to `apps/api/src/games/pocket-war.ts` (`ServerGameModule<PocketWarState>`).
4. **Rings Economy Invariant**:
   - Never update user balances with raw SQL. End-of-match economy rewards (Rings & XP) are dispatched via `ctx.completeMatch({ winnerUserId, placements })`.
5. **React 19 Hook Rules**:
   - **No synchronous `setState` in effect bodies** (`react-hooks/set-state-in-effect`): Never call `setState()` directly inside an effect body. Synchronize state in event callbacks, promise resolutions, or deferred microtasks.
   - **No ref mutation or access during render** (`react-hooks/refs`).
   - **Complete dependency arrays** for all `useEffect`, `useCallback`, and `useMemo` hooks.
6. **Zero `any` TypeScript Rule**:
   - 100% strict TypeScript typing across shared contracts, API state machines, and web components.

---

## 2. Pocket War Game Specifications (Mini Militia 2D Combat)

### Core Gameplay Loop

Players control airborne soldiers equipped with jetpacks. Flying, dodging, picking up weapons, throwing grenades, and shooting opponents in intense 2D platform arenas.

1. **Jetpack Flight & 2D Physics**:
   - Gravity pulls soldiers downward continuously.
   - Holding the booster key (`W` / `Space` / Left Joystick Up) engages jetpack thrusters, providing upward acceleration with animated flame and smoke particle exhaust.
   - Boost meter (0–100%): Depletes while thrusters fire (~4 seconds of continuous flight). Regenerates automatically when grounded or resting.
   - Smooth horizontal movement (`A` / `D` or Left Joystick Horizontal) with inertia and ground/air friction.
   - Solid platform collisions (walkable platforms, floating ledges, solid cave ceilings, boundary walls, and bottom hazard pits).

2. **Weapons & Arsenal**:
   - Every player spawns with a sidearm (Desert Eagle) and 2 Frag Grenades.
   - Weapon spawn pads across the arena periodically spawn Tier-2 and explosive weapons:
     - **Desert Eagle (Pistol)**: Semi-auto, 7 rounds/mag, fast reload (1.2s), high accuracy, 25 damage per shot.
     - **M4A1 (Assault Rifle)**: Fully automatic (600 RPM), 30 rounds/mag, moderate spread, 18 damage per bullet.
     - **Spas-12 (Combat Shotgun)**: Pump-action, 8 pellets per blast, high spread, 12 damage per pellet (up to 96 point-blank damage).
     - **Barrett .50 (Sniper Rifle)**: Pinpoint laser-straight high-speed bullet, 5 rounds/mag, slow bolt cycle (1.0s between shots), 90 body damage (120 headshot kill).
     - **RPG-7 (Rocket Launcher)**: Fires a propelled rocket with particle smoke trail. Explodes on contact with walls or players, dealing 110 AoE damage at epicenter with strong physics knockback.
     - **Frag Grenades**: Bounces off platforms, 3-second fuse or direct impact, high explosive AoE damage with camera shake.
     - **Melee Bash**: Quick rifle butt / knife slash (50 damage) when close to an enemy.

3. **Health, Damage, and Respawning**:
   - 100 HP max.
   - Slow health regeneration (+5 HP/sec) begins if the player takes no damage for 5 seconds.
   - On death: player emits ragdoll velocity / death animation, killer receives +1 kill & +100 score, death notification appears in kill feed (`"PlayerA [RPG-7] PlayerB"`).
   - Victim enters a 3-second respawn timer, then respawns at a random map spawn point with a 2-second glowing invulnerability shield.

4. **Multiplayer Match Modes**:
   - **Free For All (FFA)**: Every soldier for themselves. First to reach the kill target (e.g. 15 kills) or player with the most kills when the timer expires wins.
   - **Team Deathmatch (TDM)**: Alpha (Blue) vs Bravo (Red). Combined team kills race to target score.

5. **Maps**:
   - **Outpost Zero**: High-altitude military installation with open skies, floating metallic platforms, and vertical sniper towers.
   - **Catacombs**: Dark underground cavern with tight tunnels, jagged rock ceilings, choke points, and tactical ambush pockets.
   - **Military Bunker**: Reinforced concrete underground complex with blast doors, multi-level ladders/stairs, and a central courtyard.

6. **Dual Controls (Desktop & Mobile)**:
   - **Desktop**:
     - `A` / `D` (or `Left` / `Right`): Move left/right
     - `W` / `Space` (or `Up`): Fire jetpack boost
     - `S` / `Down`: Drop through semi-solid one-way platforms
     - `Mouse Movement`: Aim weapon crosshair 360 degrees
     - `Left Click`: Shoot weapon
     - `Right Click` / `G`: Throw grenade
     - `Q` / `Number Keys (1, 2)`: Swap weapon
     - `E` / `F`: Melee bash / Pick up weapon
     - `R`: Manual reload
   - **Mobile / Touch**:
     - Left Virtual Floating Joystick: Directional movement & jetpack thrust
     - Right Virtual Floating Joystick: 360-degree aiming; dragging outward fires the weapon continuously; tap center for grenade; dedicated weapon swap button

7. **Zero-Asset Web Audio Synthesizer**:
   - To guarantee zero broken asset requests or 404s, implement all audio using the HTML5 **Web Audio API**:
     - Jetpack whoosh: White noise buffer passed through a resonant bandpass filter modulated by booster activity.
     - Gunfire: High-frequency transient click + filtered exponential noise burst + punchy low-frequency oscillator pitch drop.
     - Rocket launch & explosion: Deep low-frequency sine boom with distorted low-pass noise rumble.
     - Hitmarker sound: High-pitch 1200Hz sine blip.
     - Announcer / pickup chimes: Gentle dual-sine arpeggio.

---

## 3. Existing Project Scaffolding (Already Implemented)

The following files are already registered, typed, and building cleanly:

1. **`packages/shared/src/games/pocket-war.ts`**:
   - Exports: `PocketWarPhase`, `PocketWarGameMode`, `PocketWarMapId`, `PocketWarSettings`, `PocketWarWeaponState`, `PocketWarPlayer`, `PocketWarState`, `DEFAULT_POCKET_WAR_SETTINGS`.
2. **`packages/shared/src/games/registry.ts`**:
   - `GAME_DEFINITIONS["pocket-war"]` registered with metadata, difficulty, playTime (5-10 min), minPlayers (2), maxPlayers (8), controls, and howToPlay.
3. **`packages/shared/src/games/config.development.ts`**:
   - `"pocket-war"` added to `developmentGames`.
4. **`packages/shared/src/socket-events.ts`**:
   - `pocketWarActionSchema`, `pocketWarUpdateSettingsSchema`
   - Client events: `"pocket-war:get-state"`, `"pocket-war:update-settings"`, `"pocket-war:start-match"`, `"pocket-war:action"`
   - Server events: `"pocket-war:state"`
5. **`apps/api/src/games/pocket-war.ts`**:
   - `pocketWarGameModule: ServerGameModule<PocketWarState>` with `createInitialState`, `handleAction`, `onPlayerLeft`, `onPlayerRenamed`.
6. **`apps/api/src/games/registry.ts`**:
   - Registered in `SERVER_GAME_MODULES["pocket-war"]`.
7. **`apps/web/src/games/pocket-war/`**:
   - `main.tsx`: Entry point handling setup phase (`HostSetupView` / `PlayerWaitingView`), active HUD (`GameHud`), and game over screen.
   - Registered in `apps/web/src/games/registry.ts` (`gameLoaders` and `gameComponents`).

---

## 4. File-by-File Blueprint for Full Implementation

You must provide the code for the following modules:

### A. Shared Types & Map Geometries (`packages/shared/src/games/pocket-war.ts`)

Expand with:

- `MapGeometry`: Array of platform rectangles `{ x, y, width, height, isOneWay?: boolean }`.
- `WeaponDefinition`: Attributes (damage, fireRateMs, magSize, reloadTimeMs, bulletSpeed, spread, recoil, projectileType: `"bullet" | "pellet" | "rocket" | "grenade"`).
- `WEAPON_CATALOG`: Record of all weapon configs.
- Map data for `"outpost"`, `"catacombs"`, and `"bunker"` with platform boundaries, spawn points, and pickup locations.
- `PocketWarActionPayload`: Discriminated union of player actions:
  - `{ type: "player_input", x, y, vx, vy, aimAngle, isBoosting, isShooting }`
  - `{ type: "fire_weapon", weaponId, originX, originY, angle }`
  - `{ type: "throw_grenade", originX, originY, velocityX, velocityY }`
  - `{ type: "switch_weapon", weaponId }`
  - `{ type: "reload" }`
  - `{ type: "pickup_weapon", pickupId }`

### B. Server Authoritative State Machine (`apps/api/src/games/pocket-war.ts`)

Implement robust authoritative logic in `handleAction`:

- Tick / simulation or action validation:
  - Validate player positions and prevent teleportation/out-of-bounds cheating.
  - Bullet/rocket hits: When a client reports a hit, verify distance and line-of-sight on the server, subtract victim HP, trigger damage broadcast.
  - If victim HP <= 0:
    - Set `victim.isAlive = false`, increment `victim.deaths`.
    - Increment `killer.kills` and `killer.score += 100`.
    - Broadcast kill feed event.
    - Start 3-second respawn timer on the victim; upon respawn, reset HP to 100, boost to 100, set random spawn coordinates.
  - Check win condition: If any player reaches `settings.killLimit` or match timer reaches 0:
    - Set `state.phase = "game_over"`.
    - Sort player rankings and invoke `await ctx.completeMatch({ winnerUserId, placements })` to award Rings & XP atomically.

### C. Client 2D Game Engine (`apps/web/src/games/pocket-war/engine/`)

Create modular engine files:

1. **`engine/Physics.ts`**:
   - Gravity, horizontal acceleration, friction, air resistance.
   - Platform collision resolution (AABB vs map platforms, one-way platform drop-through logic).
2. **`engine/ParticleSystem.ts`**:
   - Jetpack flame sparks (orange/yellow particles fading to smoke).
   - Bullet impact sparks and blood splashes.
   - Rocket smoke trail and explosive fireball burst with expanding shockwave ring.
3. **`engine/SoundFX.ts`**:
   - Web Audio API synthesizer synthesizing gunshots, jetpack hiss, explosions, reloads, and hitmarkers with zero external asset dependencies.
4. **`engine/Renderer.ts`**:
   - HTML5 Canvas 2D rendering pipeline:
     - Dynamic 2D camera following the local player with aim-offset lookahead.
     - Parallax background layers (mountains, stars, or bunker walls).
     - Map platforms, hazard zones, and weapon pickup stations with hovering weapon icons.
     - Soldier rendering: Animated 2D soldier with directional torso rotation, weapon sprite aligned to `aimAngle`, muzzle flash on firing, jetpack thruster flame.
     - Health & player name floating badge above soldier head.
     - Projectiles (bullet tracers, smoking rockets, bouncing grenades).
     - Floating combat damage numbers (`-25`, `-110!`).
     - Tactical crosshair.
5. **`engine/InputManager.ts`**:
   - Keyboard & mouse event listeners (`WASD`, Mouse Aim, Left/Right Click, `R`, `Q`, `E`).
   - Mobile touch event listeners with dual on-screen virtual joysticks.
6. **`components/PocketWarArena.tsx`**:
   - React component hosting the full-screen `<canvas>`.
   - Manages the `requestAnimationFrame` loop, updates physics at 60 FPS, interpolates remote player positions, transmits network updates over the socket via `request("pocket-war:action", ...)`, and renders the frame.

### D. Main UI & HUD Integration (`apps/web/src/games/pocket-war/main.tsx`)

- Mount `<PocketWarArena>` during `state.phase === "playing"`.
- Seamless overlay HUD (`GameHud`):
  - Room Code, Back to Room button, Audio Mute toggle.
  - Player Health Bar (animated green-to-red).
  - Jetpack Fuel Gauge (blue/orange gradient).
  - Current Weapon badge with ammo counter (`7 / 35`, `30 / 120`).
  - Real-time Kill Feed in top-right corner.
  - Floating Leaderboard / Scoreboard overlay on pressing `Tab` or tapping score badge.

---

## 5. Quality Checklist for Generated Code

Before submitting your implementation, ensure:

1. **Code compiles without errors**: Run `pnpm check-types` across all packages.
2. **ESLint & React 19 rules**:
   - No synchronous `setState` in effect bodies.
   - No ref mutation during render.
   - Exhaustive dependencies in hooks.
3. **Prettier formatting**: Clean indentation and styling compliant with repository formatting rules.
4. **Self-contained**: All code strictly lives within `packages/shared/src/games/pocket-war.ts`, `apps/api/src/games/pocket-war.ts`, and `apps/web/src/games/pocket-war/`.
