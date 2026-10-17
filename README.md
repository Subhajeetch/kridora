# Kridora

Multiplayer game platform. pnpm + Turborepo monorepo.

```
apps/web                 React + Vite + Tailwind (home, browse games, game lobby, room lobby)
apps/api                 Fastify + Better Auth + Socket.IO (auth, rooms, realtime)
packages/db              Drizzle ORM schema, migrations, Rings ledger service
packages/shared          Types, validation, game registry + dev/prod game configs, socket contracts
packages/typescript-config
```

## First-time setup

```bash
# 1. dependencies
pnpm install

# 2. environment
cp .env.example .env
#    then put a real secret in BETTER_AUTH_SECRET:   openssl rand -base64 32

# 3. PostgreSQL + Redis
pnpm infra:up

# 4. create the tables
pnpm db:migrate

# 5. run everything (API on :2020, web on :5173)
pnpm dev
```

Open http://localhost:5173.

Make sure `.env` is in your `.gitignore`.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | API + web with hot reload |
| `pnpm check-types` | Type-check every package |
| `pnpm lint` | ESLint (web) |
| `pnpm db:generate` | After editing `packages/db/src/schema/*`, create a new SQL migration |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Browse the database |
| `pnpm --filter @kridora/api test:e2e` | Realtime room test (needs the API running; takes ~70s because it waits out the 40s owner-transfer timer) |

## How requests flow

The browser only talks to ONE origin. In development Vite proxies `/api` and `/socket.io` to the API
(`apps/web/vite.config.ts`); in production put a reverse proxy (Caddy / nginx / your platform's router) in front
that serves the built web app and forwards the same two paths to the API. That keeps session cookies first-party
and removes the need for CORS.

Set `APP_URL` to the public web origin (for example `https://kridora.com`) and `TRUST_PROXY=true` when the API runs
behind your proxy.

## Accounts

* **Guest**: name only, created with Better Auth's anonymous plugin. Not tied to an email. If the guest later logs in
  to a real account, the guest user is deleted. Guests with no live session (and no Rings history) are purged after 24h
  by an hourly job (`apps/api/src/jobs/cleanup.ts`).
* **Email + password**: email verification is required before login. Password reset is built in.
* **Google**: enabled automatically when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Authorised redirect
  URI: `<APP_URL>/api/auth/callback/google`.
* **Emails** are printed to the API console for now (`apps/api/src/lib/mailer.ts`). Implement the `Mailer` interface
  with Resend / Postmark / SES later; nothing else changes.

## Rings (game currency)

* `player_profiles.rings_balance` is the fast-read balance; `ring_transactions` is the append-only ledger.
* Only change balances through `grantRings` / `spendRings` / `applyRingTransaction` from `@kridora/db`
  (row-locked, atomic, idempotent via `idempotencyKey`). Never `UPDATE` the balance directly.
* Ad rewards, XP payouts and payment webhooks should pass an `idempotencyKey` so retries cannot double-credit.

## Rooms

Live room state is stored in Redis (`apps/api/src/rooms`). Every change is made under a per-room lock, and timers
(owner transfer after 40s, removal of players who stay offline in a lobby, closing rooms nobody is connected to) are
stored in Redis too, so they survive API restarts and work with several API instances.

See `docs/ADDING_A_GAME.md` for how games plug in.

## Production checklist

* Real `BETTER_AUTH_SECRET`, `NODE_ENV=production`, `TRUST_PROXY=true` behind a proxy, HTTPS everywhere.
* Replace the console mailer.
* Run `pnpm db:migrate` as a deploy step.
* Use managed Postgres and Redis (Redis persistence on; the compose file uses AOF).
* Only slugs listed in `packages/shared/src/games/config.production.ts` are visible/playable in production.
