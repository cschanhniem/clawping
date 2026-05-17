import { parseTelegramUpdate } from '@clawping/shared';
import type { Env } from '../index';
import { enforceRateLimit, json, parseDurationToMs, telegramApi } from '../util';

async function upsertChat(env: Env, chatId: string, chatType: string, title: string | null): Promise<void> {
  const now = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO telegram_channels (id, account_id, chat_id, chat_type, title, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(account_id, chat_id) DO UPDATE SET updated_at = excluded.updated_at, enabled = 1`,
    )
    .bind(crypto.randomUUID(), 'acct_default', chatId, chatType, title, now, now)
    .run();
}

async function reply(env: Env, chatId: string, text: string): Promise<void> {
  await telegramApi(env, 'sendMessage', { chat_id: chatId, text });
}

export async function telegramWebhook(request: Request, env: Env): Promise<Response> {
  const allowed = await enforceRateLimit(env, 'telegram:webhook', 120, 60);
  if (!allowed) {
    return json({ ok: false, error: 'Rate limit exceeded' }, 429);
  }
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'Invalid Telegram webhook secret' }, 401);
  }

  const update = parseTelegramUpdate(await request.json());
  const message = update.message;
  if (!message?.text) {
    return json({ ok: true, ignored: true });
  }

  const chatId = String(message.chat.id);
  await upsertChat(env, chatId, message.chat.type, message.chat.title ?? null);

  const [command, ...args] = message.text.trim().split(/\s+/);

  if (command === '/start') {
    await reply(env, chatId, 'ClawPing can send alerts to this chat.\n\nOpen ClawPing dashboard and connect Telegram to finish setup.');
  } else if (command === '/status') {
    const devices = await env.DB.prepare('SELECT name, last_heartbeat_at, missed_heartbeat_threshold_seconds FROM devices').all<{
      name: string;
      last_heartbeat_at: string | null;
      missed_heartbeat_threshold_seconds: number;
    }>();
    const lines = ['ClawPing status', ''];
    let online = 0;
    let offline = 0;
    for (const device of devices.results) {
      const isOnline =
        device.last_heartbeat_at &&
        Date.now() - new Date(device.last_heartbeat_at).getTime() <= device.missed_heartbeat_threshold_seconds * 1000;
      if (isOnline) {
        online += 1;
      } else {
        offline += 1;
      }
    }
    const incidents = await env.DB.prepare('SELECT title, status FROM incidents WHERE recovered_at IS NULL').all<{ title: string; status: string }>();
    lines.push(`✅ ${online} devices online`);
    lines.push(`❌ ${offline} devices offline`);
    lines.push(`⚠️ ${incidents.results.length} active incidents`);
    if (incidents.results.length > 0) {
      lines.push('', 'Active incidents:');
      for (const incident of incidents.results) {
        lines.push(`• ${incident.title} (${incident.status})`);
      }
    }
    await reply(env, chatId, lines.join('\n'));
  } else if (command === '/checks') {
    const checks = await env.DB.prepare(
      `SELECT c.name, d.name AS device_name, cr.status, cr.message
       FROM checks c
       LEFT JOIN devices d ON d.id = c.device_id
       LEFT JOIN check_results cr ON cr.check_id = c.id
       WHERE cr.observed_at = (
         SELECT MAX(cr2.observed_at) FROM check_results cr2 WHERE cr2.check_id = c.id
       )
       ORDER BY d.name, c.name`,
    ).all<{ name: string; device_name: string | null; status: string; message: string }>();
    const lines = ['Checks', ''];
    for (const check of checks.results) {
      const icon = check.status === 'ok' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      lines.push(`${icon} ${check.device_name ?? 'Cloud'}: ${check.name} — ${check.message}`);
    }
    await reply(env, chatId, lines.join('\n'));
  } else if (command === '/mute') {
    if (args.length === 1) {
      const duration = parseDurationToMs(args[0]);
      if (!duration) {
        await reply(env, chatId, 'Usage: /mute 1h or /mute device-name 30m');
      } else {
        const mutedUntil = new Date(Date.now() + duration).toISOString();
        await env.KV.put('mute:account', mutedUntil);
        await reply(env, chatId, `Muted all alerts until ${mutedUntil}.`);
      }
    } else if (args.length >= 2) {
      const duration = parseDurationToMs(args[args.length - 1]);
      const deviceName = args.slice(0, -1).join(' ');
      if (!duration) {
        await reply(env, chatId, 'Usage: /mute device-name 30m');
      } else {
        const device = await env.DB.prepare('SELECT id FROM devices WHERE name = ?').bind(deviceName).first<{ id: string }>();
        if (!device) {
          await reply(env, chatId, `Device not found: ${deviceName}`);
        } else {
          const mutedUntil = new Date(Date.now() + duration).toISOString();
          const stub = env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(device.id));
          await stub.fetch('https://device-state/mute', {
            method: 'POST',
            body: JSON.stringify({ mutedUntil }),
          });
          await reply(env, chatId, `Muted ${deviceName} until ${mutedUntil}.`);
        }
      }
    } else {
      await reply(env, chatId, 'Usage: /mute 1h or /mute device-name 30m');
    }
  } else if (command === '/test') {
    await reply(env, chatId, 'Test alert from ClawPing. Telegram is connected.');
  } else {
    await reply(env, chatId, 'Unknown command. Try /status, /checks, /mute, or /test.');
  }

  return json({ ok: true });
}
