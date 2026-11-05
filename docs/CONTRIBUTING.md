# Contributing to Kridora

Thank you for your interest in contributing to Kridora! Community contributions help make Kridora a better, faster, and more engaging real-time multiplayer gaming platform for everyone.

---

## Before You Start

To keep development organized and smooth:

1. **Search existing issues and pull requests**: Check if someone else has already reported the issue or is actively working on the same feature.
2. **Read the usage guide**: Familiarize yourself with how to run Kridora locally by reading the [Usage Guide](USAGE.md).
3. **Adding a game? Read the Game Developer Guide first**:
   > [!IMPORTANT]
   > If you plan to add a new game or modify existing game mechanics, you **must** read the **[Game Developer Guide (docs/ADDING_A_GAME.md)](ADDING_A_GAME.md)** before writing any code.
   >
   > Kridora enforces strict architectural boundaries:
   >
   > - **Never touch platform UI or room pages**: Do NOT modify `GameLobbyPage.tsx`, `RoomPage.tsx`, or global layout components (`AppShell.tsx`, `PlayerHud.tsx`). Room matchmaking, roster lists, invite links, and start validations are standardized across the entire platform.
   > - **Pre-game settings live inside the game after launch**: Custom game modes, rule configurations, or map selections are handled **inside the game screen AFTER entering the game** (`room.status === "in_progress"`), never on the room lobby page.
   > - **Self-contained game packages**: All game logic, client components, and audio assets must live strictly inside `apps/web/src/games/<slug>/` and `apps/api/src/games/<slug>.ts`.
4. **Be kind and respectful**: We are committed to providing a friendly, welcoming, and inclusive environment for everyone.
5. **Open an issue first for big changes**: If you plan to introduce a major architectural change or build a large game module, please open an issue first so we can align on design decisions.

---

## Development Setup

### System Requirements

Make sure you have installed:

- **Node.js 24 or newer**
- **pnpm 11 or newer**
- **Git**
- **Cloudflare Wrangler CLI** (bundled in workspace devDependencies)

### 1. Fork and Clone

Fork the repository on GitHub, then clone your fork to your computer:

```bash
git clone https://github.com/YOUR_USERNAME/kridora.git
```

Move into the project directory:

```bash
cd kridora
```

### 2. Install Dependencies

Install all dependencies across all workspace packages:

```bash
pnpm install
```

### 3. Create a Branch

Create a new branch for your work. Use a descriptive prefix to show what kind of change you are making:

- `feature/` for new platform features (example: `feature/avatar-selector`)
- `game/` for new game modules (example: `game/connect-four`)
- `fix/` for bug fixes (example: `fix/websocket-reconnect-race`)
- `docs/` for documentation updates (example: `docs/clarify-d1-setup`)
- `refactor/` for code restructuring without changing behavior (example: `refactor/auth-middleware`)
- `chore/` for tool configurations or dependency updates (example: `chore/update-wrangler`)

Create and switch to your new branch:

```bash
git checkout -b feature/your-feature-name
```

### 4. Set Up the Environment

Copy the example environment files:

```bash
# Root workspace environment
cp .env.example .env

# Cloudflare Worker API local secrets
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Generate a secure 32-byte secret for `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

Paste this secret into both `.env` and `apps/api/.dev.vars`.

Apply database migrations to create your local Cloudflare D1 tables:

```bash
pnpm db:migrate
```

---

## Project Structure

Kridora is organized as a Turborepo monorepo:

```text
kridora/
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono, Better Auth, Durable Objects RealtimeHub)
│   └── web/                 # React 19 + Vite frontend (Tailwind CSS v4, Lucide, Framer Motion)
├── docs/                    # Platform documentation
│   ├── ADDING_A_GAME.md     # Architectural guide for building game modules
│   ├── CONTRIBUTING.md      # Contribution guidelines and coding rules
│   └── USAGE.md             # Local setup and deployment instructions
├── packages/
│   ├── db/                  # Drizzle ORM schemas, D1 migrations, atomic Rings ledger
│   ├── shared/              # Shared TypeScript types, Zod schemas, socket contracts, game definitions
│   └── typescript-config/   # Shared tsconfig bases for Node, DOM, and Workers
├── package.json             # Root monorepo configuration and Turbo scripts
├── pnpm-workspace.yaml      # Monorepo workspace definitions
└── turbo.json               # Turborepo task pipeline configuration
```

---

## Adding a Game

If you are contributing a new game, please read the complete **[Adding a Game Guide (docs/ADDING_A_GAME.md)](ADDING_A_GAME.md)**.

A complete game module requires three steps:

1. **Define Game Metadata & Rules** (`packages/shared/src/games/`):
   - Create game definition conforming to `GameDefinition` (player counts, genres, descriptions, how-to-play).
   - Register the game slug in `packages/shared/src/games/registry.ts`.
2. **Implement Server-Side State Machine** (`apps/api/src/games/`):
   - Implement `ServerGameModule<TState, TAction, TOutcome>` with `createInitialState`, `handleAction`, and optional state masking via `serializeStateForPlayer`.
   - Register your module in `apps/api/src/games/registry.ts`.
3. **Implement Client-Side Game Component** (`apps/web/src/games/`):
   - Build the interactive game board utilizing `<InGameRoomProvider>`, custom game hooks, and real-time socket events.
   - Register your game screen in `apps/web/src/games/registry.ts`.

---

## Making Changes

### Running the Apps

Start all apps at the same time:

```bash
pnpm dev
```

To run a single app:

```bash
# Frontend only
pnpm --filter web dev

# Worker API only
pnpm --filter @kridora/api dev
```

### Required Quality Checks

Before committing and opening a pull request, run all checks locally to make sure everything passes:

1. **Verify code formatting**:

   ```bash
   pnpm format:check
   ```

   Verifies that all TypeScript, CSS, and Markdown files comply with Prettier code style without modifying them. Run `pnpm format` to automatically apply formatting.

2. **Verify TypeScript types**:

   ```bash
   pnpm check-types
   ```

   Ensures there are no type errors across the entire monorepo. Type safety is strictly enforced across all client events, server actions, and database schemas.

3. **Check for lint errors**:

   ```bash
   pnpm lint
   ```

   Runs ESLint across frontend and backend packages. We enforce strict React 19 hook guidelines:
   - **No synchronous state updates in effect bodies** (`react-hooks/set-state-in-effect`): Do not call `setState()` directly inside an effect body. Reset state in event handlers or defer to asynchronous microtasks (`queueMicrotask`).
   - **No ref access or mutation during render** (`react-hooks/refs`): Never read or update ref values during rendering. Synchronize refs within `useEffect` or event handlers.
   - **Complete dependency arrays** (`react-hooks/exhaustive-deps`): Always declare all referenced variables and callback handlers.

4. **Test the production build**:

   ```bash
   pnpm build
   ```

   Verifies that the React web app compiles cleanly and the Cloudflare Worker bundle builds without dry-run errors.

5. **Run dependency security audit**:

   ```bash
   pnpm audit --prod --audit-level=high
   ```

   Verifies that production dependencies contain zero high or critical security advisories. (Always put CLI and build tools like `shadcn` in `devDependencies`).

---

## CI/CD Pipeline & Quality Gates

Every pull request and push to the `main` branch triggers automated GitHub Actions workflows:

1. **Continuous Integration (`.github/workflows/ci.yml`)**:
   - **`quality`**: Runs `pnpm format:check`, `pnpm check-types`, and `pnpm lint`.
   - **`build`**: Runs `pnpm build` after the quality job passes.
   - **`security-audit`**: Runs `pnpm audit --prod --audit-level=high`.
   - **`dependency-review`**: Scans pull request dependency changes for new vulnerabilities.
   - **`ci-passed`**: An aggregate status check that evaluates all jobs. **`CI passed` is the required status check in repository branch protection rules**.
2. **CodeQL Analysis (`.github/workflows/codeql.yml`)**:
   - Performs deep static analysis for JavaScript and TypeScript security vulnerabilities on all PRs and weekly schedules.
3. **Automated Dependabot Updates (`.github/dependabot.yml`)**:
   - Scans weekly for dependency security advisories and version updates for npm packages and GitHub Actions.
4. **Automated Deployment**:
   - Deployment is handled automatically by Cloudflare's native Git integration, which builds and deploys from `main` once all CI checks pass. Pull requests cannot be merged until `CI passed` succeeds.

---

## Commit Messages

We follow the **Conventional Commits** specification for clear, readable git logs.

### Format

```text
<type>(<scope>): <short description>
```

Common types:

- `feat`: A new feature or game addition
- `fix`: A bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring without bug fixes or new features
- `perf`: Performance improvement
- `chore`: Maintenance, config changes, or dependency upgrades

Use workspace package names or game scopes: `web`, `api`, `db`, `shared`, `docs`, `game-monopoly`, `game-ludo`, `game-fatebyai`, or `game-truth-and-dare`.

### Examples

```text
feat(game-ludo): add dice rolling animation and sound effects
fix(api): correct grace period timer for disconnected room host
fix(web): prevent duplicate room ticket request on fast reconnect
perf(db): optimize player profile query in authentication middleware
docs(usage): clarify Cloudflare D1 local migration steps
chore(deps): update Hono to latest version
```

---

## Code Style & Platform Invariants

- **Strict TypeScript**: Write fully typed code without using `any`. Ensure all socket events and game actions are typed using Zod schemas and TypeScript interfaces in `@kridora/shared`.
- **Rings Economy Invariant**: **Never** execute raw SQL `UPDATE` statements on `rings_balance` or player currency. All currency operations must use `@kridora/db` transaction functions (`grantRings`, `spendRings`, `applyRingTransaction`) with cryptographic idempotency keys.
- **Edge Compatibility**: Cloudflare Workers and Durable Objects run on V8 isolates rather than traditional Node.js servers. Use standard Web APIs (`Request`, `Response`, `crypto.subtle`, `WebSocket`) and avoid Node-native binary dependencies.
- **Consistent UI**: Frontend components use React 19, Tailwind CSS v4, Lucide React icons, and Base UI / Framer Motion where appropriate. Keep game interfaces responsive across both desktop and mobile screens.

---

## Submitting a Pull Request

When you are ready to submit your work:

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Navigate to [https://github.com/Subhajeetch/kridora](https://github.com/Subhajeetch/kridora) in your browser.
3. Click **Compare & pull request**.
4. Fill in the pull request description:
   - Provide a clear, descriptive title following Conventional Commits.
   - Describe what changed, why the change was made, and any architectural considerations.
   - List the steps required to verify and test your changes locally.
   - Include screenshots or screen recordings for any UI or game view changes.
5. Submit the pull request. Maintainers will review your code promptly!

---

Thank you again for contributing to Kridora! For complete setup and configuration details, refer to the [Usage Guide](USAGE.md). For game development specifications, refer to [Adding a Game](ADDING_A_GAME.md).
