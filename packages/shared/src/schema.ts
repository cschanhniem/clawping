import type { AgentHeartbeatPayload, AgentCheckResult, TelegramUpdate } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${field}`);
  }

  return value;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${field}`);
  }

  return value;
}

export function parseHeartbeatPayload(value: unknown): AgentHeartbeatPayload {
  if (!isRecord(value)) {
    throw new Error('Heartbeat payload must be an object');
  }

  const checksRaw = value.checks;
  if (!Array.isArray(checksRaw)) {
    throw new Error('Heartbeat payload must include checks');
  }

  const checks = checksRaw.map(parseCheckResult);

  return {
    deviceId: assertString(value.deviceId, 'deviceId'),
    agentVersion: assertString(value.agentVersion, 'agentVersion'),
    hostname: assertString(value.hostname, 'hostname'),
    timestamp: assertString(value.timestamp, 'timestamp'),
    uptimeSeconds: assertNumber(value.uptimeSeconds, 'uptimeSeconds'),
    checks,
  };
}

export function parseCheckResult(value: unknown): AgentCheckResult {
  if (!isRecord(value)) {
    throw new Error('Check result must be an object');
  }

  return {
    key: assertString(value.key, 'check key'),
    name: assertString(value.name, 'check name'),
    type: assertString(value.type, 'check type') as AgentCheckResult['type'],
    source: assertString(value.source ?? 'agent', 'check source') as AgentCheckResult['source'],
    status: assertString(value.status, 'check status') as AgentCheckResult['status'],
    message: assertString(value.message, 'check message'),
    value: value.value as AgentCheckResult['value'],
    unit: typeof value.unit === 'string' ? value.unit : undefined,
    observedAt: typeof value.observedAt === 'string' ? value.observedAt : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  };
}

export function parseTelegramUpdate(value: unknown): TelegramUpdate {
  if (!isRecord(value)) {
    throw new Error('Telegram payload must be an object');
  }

  if (typeof value.update_id !== 'number') {
    throw new Error('Telegram payload missing update_id');
  }

  return value as unknown as TelegramUpdate;
}
