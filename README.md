# ClawPing

ClawPing is a Cloudflare Workers-first Telegram watchdog for home servers, mini PCs, NAS boxes, and self-hosted apps.

A tiny local agent checks your machine from the inside, then sends outbound heartbeats to your ClawPing Worker. If your server stops checking in, a backup goes stale, a disk fills up, or a Docker container dies, ClawPing alerts you through Telegram.

No public IP required.
No open inbound ports.
Open-source agent.
Cloudflare-native control plane.

## Monorepo layout

```text
apps/
  worker/      Cloudflare Worker control plane
  dashboard/   React dashboard for onboarding and ops
packages/
  shared/      shared types, schema helpers, crypto helpers
agent/         Go agent
docs/          setup and operational docs
examples/      example configs
```

## Quick start

```bash
pnpm install
pnpm --filter @clawping/worker dev
pnpm --filter @clawping/dashboard dev
```

See [docs/self-deploy.md](./docs/self-deploy.md) for the Cloudflare path and [docs/agent-linux.md](./docs/agent-linux.md) for the agent install path.
