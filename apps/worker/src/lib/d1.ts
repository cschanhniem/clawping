import type { AgentCheckResult, CheckConfig, DeviceRecord, IncidentRecord } from '@clawping/shared';

const DEFAULT_ACCOUNT_ID = 'acct_default';

export function nowIso(): string {
  return new Date().toISOString();
}

export async function ensureDefaultAccount(db: D1Database): Promise<string> {
  const existing = await db.prepare('SELECT id FROM accounts WHERE id = ?').bind(DEFAULT_ACCOUNT_ID).first<{ id: string }>();
  if (existing?.id) {
    return existing.id;
  }

  const now = nowIso();
  await db
    .prepare(
      'INSERT INTO accounts (id, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(DEFAULT_ACCOUNT_ID, 'ClawPing Admin', 'admin', now, now)
    .run();

  return DEFAULT_ACCOUNT_ID;
}

export async function getDeviceByTokenHash(db: D1Database, tokenHash: string): Promise<DeviceRecord | null> {
  return (
    (await db
      .prepare('SELECT * FROM devices WHERE token_hash = ?')
      .bind(tokenHash)
      .first<DeviceRecord>()) ?? null
  );
}

export async function getDeviceByRegistrationTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<DeviceRecord | null> {
  return (
    (await db
      .prepare('SELECT * FROM devices WHERE registration_token_hash = ?')
      .bind(tokenHash)
      .first<DeviceRecord>()) ?? null
  );
}

export async function createDevice(
  db: D1Database,
  name: string,
  registrationTokenHash: string,
  heartbeatIntervalSeconds: number,
  missedHeartbeatThresholdSeconds: number,
): Promise<DeviceRecord> {
  const id = crypto.randomUUID();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO devices (
        id, account_id, name, registration_token_hash, heartbeat_interval_seconds,
        missed_heartbeat_threshold_seconds, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      DEFAULT_ACCOUNT_ID,
      name,
      registrationTokenHash,
      heartbeatIntervalSeconds,
      missedHeartbeatThresholdSeconds,
      now,
      now,
    )
    .run();

  return (await db.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first<DeviceRecord>()) as DeviceRecord;
}

export async function upsertCheck(
  db: D1Database,
  deviceId: string | null,
  result: AgentCheckResult,
): Promise<CheckConfig> {
  const key = deviceId ? `${deviceId}:${result.key}` : `cloud:${result.key}`;
  const existing = await db
    .prepare(
      `SELECT checks.* FROM checks
       WHERE account_id = ? AND device_id IS ? AND source = ? AND name = ? AND target IS ?`,
    )
    .bind(DEFAULT_ACCOUNT_ID, deviceId, result.source, result.name, result.metadata?.target ?? null)
    .first<CheckConfig>();

  const now = nowIso();
  if (existing) {
    await db
      .prepare(
        `UPDATE checks
         SET type = ?, config_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(result.type, JSON.stringify({ key, metadata: result.metadata ?? {} }), now, existing.id)
      .run();
    return { ...existing, type: result.type, configJson: JSON.stringify({ key, metadata: result.metadata ?? {} }), updatedAt: now };
  }

  const created: CheckConfig = {
    id: crypto.randomUUID(),
    accountId: DEFAULT_ACCOUNT_ID,
    deviceId,
    source: result.source,
    type: result.type,
    name: result.name,
    target: typeof result.metadata?.target === 'string' ? result.metadata.target : null,
    configJson: JSON.stringify({ key, metadata: result.metadata ?? {} }),
    warningThreshold: null,
    criticalThreshold: null,
    expectedStatus: null,
    intervalSeconds: 60,
    enabled: 1,
    createdAt: now,
    updatedAt: now,
  };

  await db
    .prepare(
      `INSERT INTO checks (
        id, account_id, device_id, source, type, name, target, config_json,
        warning_threshold, critical_threshold, expected_status, interval_seconds,
        enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      created.id,
      created.accountId,
      created.deviceId,
      created.source,
      created.type,
      created.name,
      created.target,
      created.configJson,
      created.warningThreshold,
      created.criticalThreshold,
      created.expectedStatus,
      created.intervalSeconds,
      created.enabled,
      created.createdAt,
      created.updatedAt,
    )
    .run();

  return created;
}

export async function insertCheckResult(
  db: D1Database,
  checkId: string,
  deviceId: string | null,
  result: AgentCheckResult,
  observedAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO check_results (
        id, check_id, device_id, status, message, value_text, value_number,
        unit, metadata_json, observed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      checkId,
      deviceId,
      result.status,
      result.message,
      typeof result.value === 'string' ? result.value : null,
      typeof result.value === 'number' ? result.value : null,
      result.unit ?? null,
      JSON.stringify(result.metadata ?? {}),
      observedAt,
      nowIso(),
    )
    .run();
}

export async function getOpenIncident(
  db: D1Database,
  deviceId: string | null,
  checkId: string | null,
): Promise<IncidentRecord | null> {
  return (
    (await db
      .prepare(
        `SELECT * FROM incidents
         WHERE account_id = ? AND device_id IS ? AND check_id IS ? AND recovered_at IS NULL
         ORDER BY opened_at DESC
         LIMIT 1`,
      )
      .bind(DEFAULT_ACCOUNT_ID, deviceId, checkId)
      .first<IncidentRecord>()) ?? null
  );
}

export async function openIncident(
  db: D1Database,
  deviceId: string | null,
  checkId: string | null,
  title: string,
  message: string,
  status: IncidentRecord['status'],
): Promise<IncidentRecord> {
  const incident: IncidentRecord = {
    id: crypto.randomUUID(),
    accountId: DEFAULT_ACCOUNT_ID,
    deviceId,
    checkId,
    status,
    title,
    message,
    openedAt: nowIso(),
    recoveredAt: null,
    mutedUntil: null,
    lastNotificationAt: null,
    notificationCount: 0,
  };

  await db
    .prepare(
      `INSERT INTO incidents (
        id, account_id, device_id, check_id, status, title, message, opened_at,
        recovered_at, muted_until, last_notification_at, notification_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      incident.id,
      incident.accountId,
      incident.deviceId,
      incident.checkId,
      incident.status,
      incident.title,
      incident.message,
      incident.openedAt,
      incident.recoveredAt,
      incident.mutedUntil,
      incident.lastNotificationAt,
      incident.notificationCount,
    )
    .run();

  return incident;
}

export async function recoverIncident(db: D1Database, incidentId: string): Promise<void> {
  await db
    .prepare('UPDATE incidents SET recovered_at = ?, updated_at = ? WHERE id = ?')
    .bind(nowIso(), nowIso(), incidentId)
    .run()
    .catch(async () => {
      await db.prepare('UPDATE incidents SET recovered_at = ? WHERE id = ?').bind(nowIso(), incidentId).run();
    });
}
