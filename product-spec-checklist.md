# ClawPing Product Spec Checklist

Tracks completion against [product-spec.md](./product-spec.md).

## Phase 1 — Cloudflare control plane skeleton

- [x] Worker app scaffolded (`apps/worker/`)
- [x] D1 schema / migrations (`apps/worker/migrations/0001_init.sql`)
- [x] Basic auth (login endpoint, session JWT)
- [x] Dashboard shell (React SPA in `apps/dashboard/`)
- [x] Telegram webhook route (`POST /api/telegram/webhook`)
- [x] `/api/health` endpoint
- [x] Wrangler deploy config (`wrangler.toml`)

## Phase 2 — Device registration + heartbeat

- [x] Create device endpoint
- [x] Generate registration token
- [x] Register agent (`POST /api/agent/register`)
- [x] Receive heartbeat (`POST /api/agent/heartbeat`)
- [x] Store last heartbeat in D1
- [x] Display online/offline status in dashboard

## Phase 3 — Missed heartbeat alerting

- [x] Cron sweep for missed heartbeats
- [x] Incident creation logic
- [x] Telegram alert on device offline
- [x] Recovery alert on device reconnect
- [x] Alert deduplication (Durable Objects)
- [x] Mute support (`/mute` command)

## Phase 4 — Agent MVP

- [x] Go agent binary (`agent/`)
- [x] Config file loader (`agent.yaml`)
- [x] Heartbeat loop
- [x] HTTP local check
- [x] Disk check
- [x] Backup freshness check
- [x] Linux systemd install docs

## Phase 5 — Docker checks

- [x] Docker container status check
- [x] Health status check
- [x] Restart count detection
- [x] Optional Docker socket config
- [x] Security warning in docs

## Phase 6 — Public beta polish

- [x] Install docs (`docs/`)
- [x] Self-deploy docs
- [x] Hosted quickstart
- [x] Dashboard UI polish
- [x] Example configs (`examples/`)
- [x] GitHub README
- [x] Security page
- [x] Attribution/LICENSE

## Repository structure

- [x] Monorepo structure matches spec §20
- [x] `pnpm-workspace.yaml`
- [x] `packages/shared/` (types, schema, crypto)
- [x] `apps/worker/` (Cloudflare Worker)
- [x] `apps/dashboard/` (React SPA)
- [x] `agent/` (Go agent)
- [x] `docs/`
- [x] `examples/`

## Cloud checks

- [x] HTTPS URL check
- [x] DNS resolve check
- [x] TLS expiry check

## Telegram bot commands

- [x] `/start`
- [x] `/status`
- [x] `/checks`
- [x] `/mute`
- [x] `/test`

## API security

- [x] Device bearer token auth
- [x] Token hashing (store hash only)
- [x] Token rotation/revocation support
- [x] Telegram webhook secret verification
- [x] Rate limiting stubs

## Queue-based alerts

- [x] Alert queue producer
- [x] Alert queue consumer
- [x] Retry with backoff

## Verification Evidence

- [x] `pnpm coverage:ts` shows 100% lines, branches, functions, and statements
- [x] `./scripts/check-go-coverage.sh` shows `Go coverage: 100.0%`
- [x] `pnpm coverage` passes end to end
- [x] `pnpm lint` passes after dashboard test types were added to tsconfig
- [x] `pnpm typecheck` passes
- [x] `pnpm build` passes
- [x] Architect review approved the repo with watch-only follow-ups
