# Kridora Usage & Local Development Guide

This guide walks you through setting up, running, debugging, and deploying Kridora on your local machine and to production.

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Local Development Setup](#local-development-setup)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Apply Local Database Migrations](#4-apply-local-database-migrations)
  - [5. Run Development Servers](#5-run-development-servers)
- [Monorepo Workspace Structure](#monorepo-workspace-structure)
- [Real-Time Engine & Local Durable Objects](#real-time-engine--local-durable-objects)
- [Database Management with Drizzle & D1](#database-management-with-drizzle--d1)
- [Available Monorepo Scripts](#available-monorepo-scripts)
- [Running Individual Applications](#running-individual-applications)
- [Production Deployment](#production-deployment)
  - [1. Database Provisioning & Remote Migrations](#1-database-provisioning--remote-migrations)
  - [2. Deploy the API Worker & Durable Objects](#2-deploy-the-api-worker--durable-objects)
  - [3. Deploy the Web Frontend](#3-deploy-the-web-frontend)
- [Troubleshooting & Common Questions](#troubleshooting--common-questions)

---

## System Requirements

Before you begin, ensure you have the following installed on your machine:

- **Node.js**: `v24.0.0` or later
- **pnpm**: `v11.0.0` or later
- **Git**: Modern version installed
- **Cloudflare Wrangler CLI**: Bundled inside workspace `devDependencies`, accessible via `pnpm` or `npx`

---

## Local Development Setup

### 1. Clone the Repository

Clone your fork or the main repository and navigate to the project root:

```bash
git clone https://github.com/Subhajeetch/kridora.git
cd kridora
```

### 2. Install Dependencies

Install all dependencies across all monorepo packages using `pnpm`:

```bash
pnpm install
```

### 3. Configure Environment Variables

Kridora requires configuration for both the root workspace and the Cloudflare Worker API.

1. **Root environment configuration**:

   ```bash
   cp .env.example .env
   ```

2. **API Worker local secrets (`apps/api/.dev.vars`)**:

   ```bash
   cp apps/api/.dev.vars.example apps/api/.dev.vars
   ```

3. **Generate a secure `BETTER_AUTH_SECRET`**:
   Generate a cryptographic 32-byte secret:

   ```bash
   openssl rand -base64 32
   ```

4. Open both `.env` and `apps/api/.dev.vars` in your editor and paste the generated string into `BETTER_AUTH_SECRET`:
   ```env
   BETTER_AUTH_SECRET=your_generated_32_byte_secret_here
   ```

> [!NOTE]
> Google OAuth sign-in is optional. For local testing, guest login and email/password authentication work out-of-the-box without configuring OAuth credentials. If you wish to enable Google OAuth, provide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` and register `http://localhost:5173/api/auth/callback/google, http://localhost:2020/api/auth/callback/google` in Google Cloud Console.

### 4. Apply Local Database Migrations

Kridora uses Cloudflare D1 (SQLite) managed via Drizzle ORM. Apply pending migrations to your local Cloudflare D1 environment:

```bash
pnpm db:migrate
```

This runs `wrangler d1 migrations apply kridora --local` and creates the local SQLite schema under `.wrangler/state/`.

### 5. Run Development Servers

Start both the Web frontend and Cloudflare Worker API concurrently via Turborepo:

```bash
pnpm dev
```

Once running, access the services:

- **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
- **API Worker & WebSockets**: [http://localhost:2020](http://localhost:2020)

> [!TIP]
> **Vite Proxy in Development**: The Vite development server automatically proxies all `/api` and `/ws` traffic to `http://localhost:2020`. You can test authentication, guest accounts, and multiplayer WebSockets directly from `http://localhost:5173` without encountering CORS or cookie isolation hurdles.

---

## Monorepo Workspace Structure

```text
kridora/
├── apps/
│   ├── api/                 # Cloudflare Worker API (Hono, Better Auth, Durable Objects)
│   └── web/                 # React 19 + Vite frontend (Tailwind CSS v4, Lucide, Framer Motion)
├── docs/                    # Architecture and developer documentation
│   ├── ADDING_A_GAME.md     # Comprehensive guide for building new game modules
│   ├── CONTRIBUTING.md      # Contribution workflow and coding standards
│   └── USAGE.md             # Local setup and deployment instructions
├── packages/
│   ├── db/                  # Drizzle ORM schemas, D1 migrations, atomic Rings ledger
│   ├── shared/              # Shared TypeScript types, Zod schemas, game definitions
│   └── typescript-config/   # Centralized tsconfig configurations
├── package.json             # Root monorepo configuration and Turbo scripts
├── pnpm-workspace.yaml      # Monorepo workspace definitions
└── turbo.json               # Turborepo task pipeline configuration
```

---

## Real-Time Engine & Local Durable Objects

Kridora's multiplayer features rely on Cloudflare Durable Objects using the **WebSocket Hibernation API**:

1. **Authentication & Ticket Generation**: When a client requests a WebSocket upgrade, it first sends a `POST /api/ws-ticket` request carrying its session cookie.
2. **HMAC Signing**: The API generates an HMAC-SHA256 signed ticket with a 30-second TTL and a single-use cryptographic nonce.
3. **Upgrading**: The client connects to `/ws?ticket=<token>`. The Durable Object (`RealtimeHub`) verifies the signature, marks the nonce as used, and upgrades the connection to a raw WebSocket. Sockets hibernate when idle to conserve system resources.
4. **Local Testing**: Wrangler simulates Durable Objects locally in memory and persists SQLite state within `.wrangler/`. You can open multiple browser windows (or incognito sessions) to test multiplayer matches simultaneously.

---

## Database Management with Drizzle & D1

Database schemas live in `packages/db/src/schema/`.

### Generating New Migrations

After modifying table definitions or relationships in `packages/db/src/schema/`:

```bash
pnpm db:generate
```

This updates SQL migration files inside `packages/db/drizzle/`.

### Applying Migrations Locally

```bash
pnpm db:migrate
```

### Visualizing Database Records (Drizzle Studio)

To inspect local database rows, user accounts, and balance ledgers:

```bash
pnpm db:studio
```

---

## Available Monorepo Scripts

| Command                  | Description                                                                   |
| :----------------------- | :---------------------------------------------------------------------------- |
| `pnpm dev`               | Starts the Vite web client and Wrangler API worker concurrently in watch mode |
| `pnpm build`             | Builds production bundles for the web app and runs dry-run API build          |
| `pnpm check-types`       | Runs TypeScript type-checks across all apps and packages in the workspace     |
| `pnpm lint`              | Runs ESLint across all workspace packages                                     |
| `pnpm format`            | Formats all code and markdown files with Prettier                             |
| `pnpm db:generate`       | Generates new SQL migration files from Drizzle schema alterations             |
| `pnpm db:migrate`        | Applies pending migrations to the local Cloudflare D1 database                |
| `pnpm db:migrate:remote` | Applies pending migrations to the production Cloudflare D1 database           |
| `pnpm db:studio`         | Launches Drizzle Studio browser visualizer for D1 schema/data                 |

---

## Running Individual Applications

If you only want to run or test a single service:

### Web Frontend Only

```bash
pnpm --filter web dev
```

### API Worker Only

```bash
pnpm --filter @kridora/api dev
```

### Database Package Only

```bash
pnpm --filter @kridora/db check-types
```

---

## Production Deployment

### 1. Database Provisioning & Remote Migrations

1. Ensure your Cloudflare account is authenticated:

   ```bash
   npx wrangler login
   ```

2. Create a Cloudflare D1 database:

   ```bash
   npx wrangler d1 create kridora
   ```

3. Update the `database_id` in `apps/api/wrangler.jsonc` with the ID returned by the creation command.

4. Apply migrations to the production D1 database:
   ```bash
   pnpm db:migrate:remote
   ```

### 2. Deploy the API Worker & Durable Objects

1. Set your production `BETTER_AUTH_SECRET`:

   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET --name kridora-api
   ```

2. If using Google OAuth, set client credentials:

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID --name kridora-api
   npx wrangler secret put GOOGLE_CLIENT_SECRET --name kridora-api
   ```

3. Deploy the worker and Durable Object bindings:
   ```bash
   pnpm --filter @kridora/api deploy
   ```

### 3. Deploy the Web Frontend

The React frontend compiles to static assets in `apps/web/dist`:

```bash
pnpm --filter web build
```

You can deploy `apps/web/dist` directly to **Cloudflare Pages**, **Vercel**, or **Netlify**:

- **Build command**: `pnpm --filter web build`
- **Output directory**: `apps/web/dist`
- **Environment variables**:
  - `VITE_API_URL`: Your deployed API Worker domain (e.g., `https://api.kridora.org`)

---

## Troubleshooting & Common Questions

### `BETTER_AUTH_SECRET` is missing or invalid

- Make sure `BETTER_AUTH_SECRET` is set in both `.env` and `apps/api/.dev.vars`.
- The secret must be at least 32 characters long. Generate one with `openssl rand -base64 32`.

### Port 2020 or 5173 is already in use

- Stop existing background Node processes or configure custom ports in `.env` and `apps/api/package.json`.

### Local D1 database state corruption

If your local dev state becomes corrupt or desynchronized:

1. Stop any running dev servers.
2. Remove `.wrangler/` state directories:
   ```bash
   rm -rf apps/api/.wrangler
   ```
3. Re-apply migrations:
   ```bash
   pnpm db:migrate
   ```

### Rings Economy Invariants

Remember that all ring adjustments must pass through `@kridora/db` transaction functions (`grantRings`, `spendRings`, `applyRingTransaction`) with unique idempotency keys. Direct database `UPDATE` queries on `rings_balance` bypass ledger validation and will cause balance discrepancies.
