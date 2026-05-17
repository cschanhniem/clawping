# Telegram Setup

ClawPing uses Telegram as its primary alert channel. This guide covers creating a bot and connecting it to ClawPing.

## Create a Telegram bot

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`.
3. Choose a display name (e.g., "ClawPing").
4. Choose a username ending in `bot` (e.g., `myclawping_bot`).
5. BotFather sends you a bot token like `7123456789:AAF...`.

Keep this token private. Anyone with it can control your bot.

## Hosted ClawPing

If you are using [ClawPing Cloud](https://clawping.app), the bot is already configured. Skip to [Connecting Telegram](#connecting-telegram).

## Self-deployed: configure the bot token

Set the token as a Worker secret:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
```

Set the webhook secret (any random string, 1–256 chars):

```bash
wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

Register the webhook with Telegram:

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_WORKER.workers.dev/api/telegram/webhook",
    "secret_token": "YOUR_WEBHOOK_SECRET"
  }'
```

Verify the webhook:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

The response should show `"url"` pointing to your Worker and `"pending_update_count": 0`.

## Connecting Telegram

1. Open the ClawPing dashboard.
2. Go to **Settings** → **Telegram**.
3. Click **Connect Telegram**.
4. Open the bot link shown and click **Start**.
5. Return to the dashboard. The status should change to **Connected**.
6. Click **Send test alert** to confirm delivery.

## Bot commands

The bot supports these commands at any time:

| Command | Description |
|---|---|
| `/start` | Show setup instructions |
| `/status` | Overview of all devices and active warnings |
| `/checks` | Check-by-check status for all devices |
| `/mute 1h` | Mute all alerts for 1 hour |
| `/mute home-mini-pc 30m` | Mute alerts for a specific device |
| `/test` | Send a test alert |

## Connecting multiple Telegram chats

ClawPing can deliver alerts to more than one chat (personal DM, group, or channel):

1. Add the bot to any Telegram group.
2. In the dashboard, go to **Notification Channels**.
3. Add the second chat by sending `/start` from that chat.

## Troubleshooting

**Bot does not respond to `/start`**

Verify the webhook is registered correctly:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

Check the Worker is deployed and healthy at `/api/health`.

**Alerts arrive but `/status` shows wrong data**

The bot reads from D1. Confirm migrations are applied:

```bash
wrangler d1 migrations apply clawping --remote
```

**"Webhook was deleted" from getWebhookInfo**

Re-register the webhook. Telegram occasionally removes webhooks that return consistent errors.

## Privacy

ClawPing stores your Telegram `chat_id` and optional `chat_type` in D1. Device names and check labels may appear in alert messages sent via the Telegram API. ClawPing does not store Telegram message content beyond what is needed to process bot commands.
