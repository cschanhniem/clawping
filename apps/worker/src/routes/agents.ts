import { parseHeartbeatPayload, type AgentCheckResult } from '@clawping/shared';
import type { Env } from '../index';
import {
  createDevice,
  getDeviceByRegistrationTokenHash,
  getDeviceByTokenHash,
  getOpenIncident,
  insertCheckResult,
  openIncident,
  upsertCheck,
} from '../lib/d1';
import { enforceRateLimit, hashToken, json, newToken, parseBearerToken, readJson } from '../util';

async function notifyIncident(env: Env, deviceId: string, text: string, recover = false): Promise<void> {
  const stub = env.DEVICE_STATE.get(env.DEVICE_STATE.idFromName(deviceId));
  const decision = (await (await stub.fetch(`https://device-state/should-alert${recover ? '?recover=1' : ''}`)).json()) as {
    send: boolean;
  };
  if (!decision.send) {
    return;
  }

  const chats = await env.DB.prepare('SELECT chat_id FROM telegram_channels WHERE enabled = 1').all<{ chat_id: string }>();
  for (const row of chats.results) {
    await env.ALERT_QUEUE.send({ chatId: row.chat_id, text });
  }
  await stub.fetch(`https://device-state/${recover ? 'recover' : 'mark-open'}`);
}

async function persistCheckAndIncident(
  env: Env,
  deviceId: string,
  result: AgentCheckResult,
  observedAt: string,
  deviceName: string,
): Promise<void> {
  const check = await upsertCheck(env.DB, deviceId, result);
  await insertCheckResult(env.DB, check.id, deviceId, result, observedAt);

  const existing = await getOpenIncident(env.DB, deviceId, check.id);
  if (result.status === 'ok') {
    if (existing) {
      await env.DB
        .prepare('UPDATE incidents SET recovered_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), existing.id)
        .run();
      await notifyIncident(env, deviceId, `✅ ${result.name} recovered on ${deviceName}`, true);
    }
    return;
  }

  if (!existing) {
    await openIncident(env.DB, deviceId, check.id, `${result.name} failed`, result.message, result.status);
  }
  await notifyIncident(
    env,
    deviceId,
    `${result.status === 'critical' ? '❌' : '⚠️'} ${result.name} on ${deviceName}\n\n${result.message}`,
  );
}

export async function registerAgent(request: Request, env: Env): Promise<Response> {
  const allowed = await enforceRateLimit(env, `agent:register:${request.headers.get('cf-connecting-ip') ?? 'local'}`, 20, 60);
  if (!allowed) {
    return json({ ok: false, error: 'Rate limit exceeded' }, 429);
  }
  const body = await readJson<{
    registrationToken: string;
    deviceName: string;
    hostname?: string;
    platform?: string;
  }>(request);

  const tokenHash = await hashToken(body.registrationToken);
  const device = await getDeviceByRegistrationTokenHash(env.DB, tokenHash);
  if (!device) {
    return json({ ok: false, error: 'Invalid registration token' }, 401);
  }

  const deviceToken = newToken('cp_device');
  await env.DB
    .prepare(
      `UPDATE devices
       SET token_hash = ?, registration_token_hash = NULL, hostname = ?, platform = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(await hashToken(deviceToken), body.hostname ?? body.deviceName, body.platform ?? null, new Date().toISOString(), device.id)
    .run();

  return json({
    ok: true,
    deviceId: device.id,
    deviceToken,
    heartbeatIntervalSeconds: device.heartbeatIntervalSeconds,
  });
}

export async function receiveHeartbeat(request: Request, env: Env): Promise<Response> {
  const allowed = await enforceRateLimit(env, `agent:heartbeat:${request.headers.get('cf-connecting-ip') ?? 'local'}`, 240, 60);
  if (!allowed) {
    return json({ ok: false, error: 'Rate limit exceeded' }, 429);
  }
  const bearer = parseBearerToken(request);
  if (!bearer) {
    return json({ ok: false, error: 'Missing bearer token' }, 401);
  }

  const device = await getDeviceByTokenHash(env.DB, await hashToken(bearer));
  if (!device) {
    return json({ ok: false, error: 'Invalid device token' }, 401);
  }

  const payload = parseHeartbeatPayload(await request.json());
  const observedAt = payload.timestamp;
  await env.DB
    .prepare(
      `UPDATE devices
       SET hostname = ?, agent_version = ?, last_heartbeat_at = ?, last_seen_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(payload.hostname, payload.agentVersion, observedAt, new Date().toISOString(), new Date().toISOString(), device.id)
    .run();

  for (const result of payload.checks) {
    await persistCheckAndIncident(env, device.id, result, observedAt, device.name);
  }

  return json({
    ok: true,
    serverTime: new Date().toISOString(),
    nextIntervalSeconds: device.heartbeatIntervalSeconds,
    configVersion: 1,
  });
}
