import type { Env } from '../index';
import { getOpenIncident, insertCheckResult, openIncident, upsertCheck } from '../lib/d1';
import { runCloudCheck } from '../monitor';
import { setKvJson } from '../store';

async function queueIncident(env: Env, deviceOrCheckId: string, text: string, recover = false): Promise<void> {
  const stub = env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(deviceOrCheckId));
  const decision = (await (await stub.fetch(`https://device-state/should-alert${recover ? '?recover=1' : ''}`)).json()) as { send: boolean };
  if (!decision.send) {
    return;
  }
  const chats = await env.DB.prepare('SELECT chat_id FROM telegram_channels WHERE enabled = 1').all<{ chat_id: string }>();
  for (const chat of chats.results) {
    await env.ALERT_QUEUE.send({ chatId: chat.chat_id, text });
  }
  await stub.fetch(`https://device-state/${recover ? 'recover' : 'mark-open'}`);
}

export async function runScheduledChecks(env: Env): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT * FROM checks WHERE source = 'cloud' AND enabled = 1 ORDER BY updated_at DESC`,
  ).all();
  for (const row of rows.results) {
    const result = await runCloudCheck(row as never);
    const check = await upsertCheck(env.DB, null, result);
    const observedAt = result.observedAt ?? new Date().toISOString();
    await insertCheckResult(env.DB, check.id, null, result, observedAt);
    const existing = await getOpenIncident(env.DB, null, check.id);
    if (result.status === 'ok' && existing) {
      await env.DB.prepare('UPDATE incidents SET recovered_at = ? WHERE id = ?').bind(new Date().toISOString(), existing.id).run();
      await queueIncident(env, check.id, `✅ ${result.name} recovered`, true);
      continue;
    }
    if (result.status !== 'ok' && !existing) {
      await openIncident(env.DB, null, check.id, `${result.name} failed`, result.message, result.status);
      await queueIncident(env, check.id, `${result.status === 'critical' ? '❌' : '⚠️'} ${result.name}\n\n${result.message}`);
    }
  }

  await env.KV.put('meta:lastSweepAt', new Date().toISOString());
  await setKvJson(env, 'meta:lastScheduledCheckRun', { at: new Date().toISOString(), count: rows.results.length });
}

export async function sweepMissedHeartbeats(env: Env): Promise<void> {
  const devices = await env.DB.prepare(
    `SELECT * FROM devices WHERE last_heartbeat_at IS NOT NULL`,
  ).all<{
    id: string;
    name: string;
    last_heartbeat_at: string;
    missed_heartbeat_threshold_seconds: number;
  }>();

  for (const device of devices.results) {
    const stale =
      Date.now() - new Date(device.last_heartbeat_at).getTime() >
      device.missed_heartbeat_threshold_seconds * 1000;
    const existing = await getOpenIncident(env.DB, device.id, null);

    if (stale && !existing) {
      await openIncident(
        env.DB,
        device.id,
        null,
        `${device.name} stopped checking in`,
        `Last heartbeat: ${device.last_heartbeat_at}`,
        'critical',
      );
      await queueIncident(
        env,
        device.id,
        `❌ ${device.name} stopped checking in\n\nLast heartbeat:\n${device.last_heartbeat_at}`,
      );
      continue;
    }

    if (!stale && existing) {
      await env.DB.prepare('UPDATE incidents SET recovered_at = ? WHERE id = ?').bind(new Date().toISOString(), existing.id).run();
      await queueIncident(env, device.id, `✅ ${device.name} is back online`, true);
    }
  }

  await env.KV.put('meta:lastSweepAt', new Date().toISOString());
}
