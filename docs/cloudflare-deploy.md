# Deploy ClawPing to Cloudflare

This guide walks through deploying the ClawPing control plane into your own Cloudflare account using Wrangler.

## Prerequisites

- Node.js 18+
- pnpm
- A Cloudflare account with Workers Paid plan (required for Durable Objects)
- `wrangler` CLI installed (`npm install -g wrangler`)

## 1. Clone and install

```bash
git clone https://github.com/clawping/clawping.git
cd clawping
pnpm install
```

## 2. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window to authorize Wrangler with your Cloudflare account.

## 3. Create D1 database

```bash
wrangler d1 create clawping
```

Copy the `database_id` from the output. Paste it into `apps/worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "clawping"
database_id = "PASTE_YOUR_DATABASE_ID"
```

## 4. Create KV namespace

```bash
wrangler kv:namespace create KV
```

Copy the `id` into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV"
id = "PASTE_YOUR_KV_ID"
```

## 5. Create Queue

```bash
wrangler queues create clawping-alerts
```

Add to `wrangler.toml`:

```toml
[[queues.producers]]
binding = "ALERT_QUEUE"
queue = "clawping-alerts"

[[queues.consumers]]
queue = "clawping-alerts"
```

## 6. Add Durable Object binding

Add to `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "DEVICE_STATE"
class_name = "DeviceState"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DeviceState"]
```

## 7. Set secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put ADMIN_PASSWORD
```

Enter each value when prompted.

## 8. Run D1 migrations

```bash
wrangler d1 migrations apply clawping --local
wrangler d1 migrations apply clawping --remote
```

## 9. Deploy

```bash
pnpm --filter @clawping/worker deploy
```

Wrangler prints your Worker URL:

```
Published clawping (1.23 sec)
  https://clawping.YOUR_SUBDOMAIN.workers.dev
```

## 10. Set up Telegram webhook

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://clawping.YOUR_SUBDOMAIN.workers.dev/api/telegram/webhook",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

## 11. Verify

Open your Worker URL in a browser. You should see the ClawPing dashboard.

Send `/start` to your Telegram bot. The bot should reply with the ClawPing welcome message.

## Wrangler configuration reference

Full `wrangler.toml` example:

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

[[durable_objects.bindings]]
name = "DEVICE_STATE"
class_name = "DeviceState"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DeviceState"]
```

## Updating

After code changes:

```bash
pnpm --filter @clawping/worker deploy
```

D1 schema changes require a new migration file in `apps/worker/migrations/` and:

```bash
wrangler d1 migrations apply clawping --remote
```

## Cost notes

| Resource | Free tier | Paid |
|---|---|---|
| Workers requests | 100,000/day | $5/month + $0.50/million |
| D1 rows read | 5 million/day | included in Workers Paid |
| D1 rows written | 100,000/day | included in Workers Paid |
| KV reads | 100,000/day | $0.50/million |
| Durable Objects | not available | included in Workers Paid |
| Queues messages | 1 million/month | $0.40/million |

For a typical home setup (1–3 devices, 60-second heartbeats), the free tier is sufficient. Durable Objects require the Workers Paid plan ($5/month minimum).

## Troubleshooting

**`wrangler deploy` fails with "no such Durable Object class"**

Run migrations first:

```bash
wrangler d1 migrations apply clawping --remote
```

**Telegram webhook returns 404**

Verify the Worker route `/api/telegram/webhook` exists and the secret matches:

```bash
wrangler secret list
```

**D1 "too many requests" errors**

Reduce cron frequency in `wrangler.toml` from `* * * * *` to `*/2 * * * *`.
