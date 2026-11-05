<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

---

# Kridora AI Agent Instructions

Welcome, AI Agent! Before reading, writing, or modifying any code in this repository, **you MUST thoroughly read the documentation in the [`docs/`](docs/) directory**. The `docs/` folder contains the authoritative ground truth for our architecture, game boundaries, coding conventions, and CI/CD rules:

1. **[`docs/USAGE.md`](docs/USAGE.md)**: Local development setup, environment variables (`.env`, `apps/api/.dev.vars`), Cloudflare D1 database migrations, monorepo scripts, and production deployment notes.
2. **[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)**: Contribution workflow, Conventional Commits, branch naming conventions, code style standards, and CI/CD pipeline rules.
3. **[`docs/ADDING_A_GAME.md`](docs/ADDING_A_GAME.md)**: **Mandatory reading** whenever creating, editing, or debugging any game module:
   - **Never touch platform UI or room pages**: Do NOT modify `GameLobbyPage.tsx` or `RoomPage.tsx`. Platform lobby, matchmaking, and roster controls are standardized across all games.
   - **Pre-game settings live inside the game after launch**: Game configurations (map, difficulty, rules) happen inside the game component once `room.status === "in_progress"`.
   - **Self-contained game packages**: All game components, board assets, audio, and state machines live strictly inside `apps/web/src/games/<slug>/` and `apps/api/src/games/<slug>.ts`.
   - **Rings Economy Invariant**: Never write raw SQL `UPDATE` statements for player balances; use `@kridora/db` transaction helpers (`grantRings`, `spendRings`, `applyRingTransaction`) with cryptographic idempotency keys.

## CI/CD Pipeline & Quality Gates

Kridora enforces strict automated gating via GitHub Actions on every pull request and push to `main`. Every change you make must pass all local checks before committing:

1. **Code Formatting**: `pnpm format:check` (or `pnpm format` to auto-format files with Prettier).
2. **TypeScript Compilation**: `pnpm check-types` (100% strict TypeScript across all workspaces; no `any`).
3. **ESLint**: `pnpm lint` (React 19 hook rules are strictly enforced: no synchronous `setState` in effect bodies to prevent cascading renders, no mutating or accessing refs during render, full exhaustive dependency arrays).
4. **Production Build**: `pnpm build` (Vite web bundle and Wrangler dry-run bundle must build cleanly).
5. **Dependency Security Audit**: `pnpm audit --prod --audit-level=high` (Zero high or critical vulnerabilities in production dependencies; CLI and build tools belong strictly in `devDependencies`).

Pull requests are gated by the single required status check **`CI passed`**.
Deployment is handled automatically by Cloudflare's Git integration from `main` once CI passes.
