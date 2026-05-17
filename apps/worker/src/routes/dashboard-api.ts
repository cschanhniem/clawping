import type { CheckConfig } from '@clawping/shared';
import type { Env } from '../index';
import { createDevice, ensureDefaultAccount, nowIso } from '../lib/d1';
import { appBaseUrl, formatInstallCommand, hashToken, json, readJson, requireSession, unauthorized, newToken } from '../util';

export async function handleDashboardRequest(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) {
    return unauthorized();
  }

  await ensureDefaultAccount(env.DB);
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/api/dashboard/overview') {
    const devicesOnline = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM devices
       WHERE last_heartbeat_at IS NOT NULL
         AND datetime(last_heartbeat_at) >= datetime('now', '-' || missed_heartbeat_threshold_seconds || ' seconds')`,
    ).first<{ count: number }>();
    const devicesTotal = await env.DB.prepare('SELECT COUNT(*) AS count FROM devices').first<{ count: number }>();
    const activeIncidents = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM incidents WHERE recovered_at IS NULL`,
    ).first<{ count: number }>();
    const critical = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM check_results WHERE status = 'critical' AND observed_at >= datetime('now', '-10 minutes')`,
    ).first<{ count: number }>();
    const warnings = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM check_results WHERE status = 'warning' AND observed_at >= datetime('now', '-10 minutes')`,
    ).first<{ count: number }>();

    return json({
      ok: true,
      overview: {
        devicesOnline: devicesOnline!.count,
        devicesOffline: Math.max(0, devicesTotal!.count - devicesOnline!.count),
        warnings: warnings!.count,
        critical: critical!.count,
        activeIncidents: activeIncidents!.count,
        lastSweepAt: await env.KV.get('meta:lastSweepAt'),
      },
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/dashboard/devices') {
    const devices = await env.DB.prepare('SELECT * FROM devices ORDER BY created_at DESC').all();
    return json({ ok: true, devices: devices.results });
  }

  if (request.method === 'GET' && url.pathname === '/api/dashboard/incidents') {
    const incidents = await env.DB.prepare('SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 100').all();
    return json({ ok: true, incidents: incidents.results });
  }

  if (request.method === 'GET' && url.pathname === '/api/dashboard/checks') {
    const checks = await env.DB.prepare('SELECT * FROM checks ORDER BY updated_at DESC').all<CheckConfig>();
    return json({ ok: true, checks: checks.results });
  }

  if (request.method === 'POST' && url.pathname === '/api/dashboard/devices') {
    const body = await readJson<{ name: string; heartbeatIntervalSeconds?: number; missedHeartbeatThresholdSeconds?: number }>(request);
    const registrationToken = newToken('cp_reg');
    const device = await createDevice(
      env.DB,
      body.name,
      await hashToken(registrationToken),
      body.heartbeatIntervalSeconds ?? 60,
      body.missedHeartbeatThresholdSeconds ?? 300,
    );
    return json({
      ok: true,
      device,
      registrationToken,
      installCommand: formatInstallCommand(appBaseUrl(env, request), registrationToken, body.name),
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/dashboard/checks') {
    const body = await readJson<Partial<CheckConfig>>(request);
    const now = nowIso();
    const check: CheckConfig = {
      id: crypto.randomUUID(),
      accountId: session.accountId,
      deviceId: body.deviceId ?? null,
      source: body.source ?? 'cloud',
      type: body.type ?? 'http',
      name: body.name ?? 'Unnamed Check',
      target: body.target ?? null,
      configJson: body.configJson ?? '{}',
      warningThreshold: body.warningThreshold ?? null,
      criticalThreshold: body.criticalThreshold ?? null,
      expectedStatus: body.expectedStatus ?? null,
      intervalSeconds: body.intervalSeconds ?? 60,
      enabled: body.enabled ?? 1,
      createdAt: now,
      updatedAt: now,
    };
    await env.DB
      .prepare(
        `INSERT INTO checks (
          id, account_id, device_id, source, type, name, target, config_json,
          warning_threshold, critical_threshold, expected_status, interval_seconds,
          enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        check.id,
        check.accountId,
        check.deviceId,
        check.source,
        check.type,
        check.name,
        check.target,
        check.configJson,
        check.warningThreshold,
        check.criticalThreshold,
        check.expectedStatus,
        check.intervalSeconds,
        check.enabled,
        check.createdAt,
        check.updatedAt,
      )
      .run();
    return json({ ok: true, check });
  }

  const rotateMatch = url.pathname.match(/^\/api\/dashboard\/devices\/([^/]+)\/rotate-token$/);
  if (request.method === 'POST' && rotateMatch) {
    const deviceId = rotateMatch[1];
    const deviceToken = newToken('cp_device');
    await env.DB
      .prepare('UPDATE devices SET token_hash = ?, updated_at = ? WHERE id = ?')
      .bind(await hashToken(deviceToken), nowIso(), deviceId)
      .run();
    return json({ ok: true, deviceId, deviceToken });
  }

  const revokeMatch = url.pathname.match(/^\/api\/dashboard\/devices\/([^/]+)\/revoke-token$/);
  if (request.method === 'POST' && revokeMatch) {
    const deviceId = revokeMatch[1];
    await env.DB
      .prepare('UPDATE devices SET token_hash = NULL, updated_at = ? WHERE id = ?')
      .bind(nowIso(), deviceId)
      .run();
    return json({ ok: true, deviceId, revoked: true });
  }

  return json({ ok: false, error: 'Not found' }, 404);
}
