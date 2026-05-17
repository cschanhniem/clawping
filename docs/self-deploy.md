# Self-Deploy ClawPing

This guide explains how to run the full ClawPing stack in your own Cloudflare account.

## What you are deploying

ClawPing is a Cloudflare Workers-first control plane with a lightweight local agent.

The self-deployed stack includes:

- Worker API
- dashboard
- D1 database
- Durable Objects for alert coordination
- Cron Triggers for missed heartbeat detection and cloud checks
- Queues for asynchronous alert delivery
- KV for light config and caching
- Telegram bot webhook

This is the recommended mode for privacy-conscious or open-source users.

## 1. Clone the repository

```bash
git clone https://github.com/clawping/clawping.git
cd clawping
pnpm install
```

## 2. Create Cloudflare resources

Create the required resources in your Cloudflare account.

### D1 database

```bash
wrangler d1 create clawping
```

### KV namespace

```bash
wrangler kv:namespace create KV
```

### Queue

```bash
wrangler queues create clawping-alerts
```

### Durable Objects

Configured in `apps/worker/wrangler.toml` using a binding like:

```toml
[[durable_objects.bindings]]
name = "DEVICE_STATE"
class_name = "DeviceState"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DeviceState"]
```

## 3. Configure Wrangler

Edit `apps/worker/wrangler.toml` with your IDs:

```toml
name = "clawping"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[triggers]
crons = ["* * * * *", "*/5 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "clawping"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"

[[queues.producers]]
binding = "ALERT_QUEUE"
queue = "clawping-alerts"

[[queues.consumers]]
queue = "clawping-alerts"
```

## 4. Set secrets

The Worker requires several secrets:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put ADMIN_PASSWORD
```

For production, generate a strong password for `ADMIN_PASSWORD`.

## 5. Apply database migrations

```bash
wrangler d1 migrations apply clawping --local
wrangler d1 migrations apply clawping --remote
```

## 6. Build and deploy

```bash
pnpm --filter @clawping/worker deploy
```

After deployment, Wrangler prints your Worker URL.

## 7. Set the Telegram webhook

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_WORKER.workers.dev/api/telegram/webhook",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

## 8. Verify the control plane

Open `https://YOUR_WORKER.workers.dev/` in your browser. The dashboard should load.

Test the Worker health route:

```bash
curl https://YOUR_WORKER.workers.dev/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Send `/start` to the Telegram bot. It should reply with setup instructions.

## 9. Register your first device

Open the dashboard and add a device.

The dashboard should generate an install command like:

```bash
curl -fsSL https://YOUR_WORKER.workers.dev/install.sh | sh -s -- \
  --token cp_self_xxxxx \
  --device home-mini-pc
```

Run this on the machine you want to monitor. See:
- [Agent on Linux](./agent-linux.md)
- [Agent in Docker](./agent-docker.md)

## 10. Test the core product moment

ClawPing's most important validation is simple:

1. The agent checks in every 60 seconds.
2. If the Worker does not receive a heartbeat for 5 minutes, the cron sweep opens an incident.
3. The Worker enqueues a Telegram alert.
4. Telegram says your device stopped checking in.

Stop the agent temporarily:

```bash
sudo systemctl stop clawping-agent
```

Wait 5 minutes and confirm Telegram delivery.

Restart the agent and confirm the recovery alert.

## Hardening recommendations

- Put the dashboard behind Cloudflare Access if this is an internal-only deployment.
- Use a dedicated Telegram bot token for each environment.
- Keep D1 history retention short to reduce storage cost.
- Rotate device tokens if a machine is decommissioned or repurposed.
- Restrict Docker socket access to only the devices that need container checks.
