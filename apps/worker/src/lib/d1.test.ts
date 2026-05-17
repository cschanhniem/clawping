import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentCheckResult, CheckConfig, DeviceRecord, IncidentRecord } from '@clawping/shared';
import {
  createDevice,
  ensureDefaultAccount,
  getDeviceByRegistrationTokenHash,
  getDeviceByTokenHash,
  getOpenIncident,
  insertCheckResult,
  openIncident,
  recoverIncident,
  upsertCheck,
} from './d1';

interface D1State {
  accountExists: boolean;
  devices: Map<string, DeviceRecord>;
  checks: Map<string, CheckConfig>;
  checkResults: Array<Record<string, unknown>>;
  incidents: Map<string, IncidentRecord & { updatedAt?: string | null }>;
  failRecoverWithUpdatedAtOnce: boolean;
}

function createState(): D1State {
  return {
    accountExists: false,
    devices: new Map(),
    checks: new Map(),
    checkResults: [],
    incidents: new Map(),
    failRecoverWithUpdatedAtOnce: false,
  };
}

function createDb(state: D1State): D1Database {
  return {
    prepare(sql: string) {
      const first = async (args: unknown[]) => {
        if (sql.includes('SELECT id FROM accounts')) {
          return state.accountExists ? { id: 'acct_default' } : null;
        }

        if (sql.includes('SELECT * FROM devices WHERE token_hash = ?')) {
          return [...state.devices.values()].find((device) => device.tokenHash === args[0]) ?? null;
        }

        if (sql.includes('SELECT * FROM devices WHERE registration_token_hash = ?')) {
          return [...state.devices.values()].find((device) => device.registrationTokenHash === args[0]) ?? null;
        }

        if (sql.includes('SELECT * FROM devices WHERE id = ?')) {
          return state.devices.get(String(args[0])) ?? null;
        }

        if (sql.includes('SELECT checks.* FROM checks')) {
          const [accountId, deviceId, source, name, target] = args;
          return (
            [...state.checks.values()].find(
              (check) =>
                check.accountId === accountId &&
                check.deviceId === deviceId &&
                check.source === source &&
                check.name === name &&
                check.target === target,
            ) ?? null
          );
        }

        if (sql.includes('SELECT * FROM incidents')) {
          const [accountId, deviceId, checkId] = args;
          return (
            [...state.incidents.values()].find(
              (incident) =>
                incident.accountId === accountId &&
                incident.deviceId === deviceId &&
                incident.checkId === checkId &&
                incident.recoveredAt === null,
            ) ?? null
          );
        }

        throw new Error(`Unhandled first() SQL in test: ${sql}`);
      };

      const run = async (args: unknown[]) => {
        if (sql.includes('INSERT INTO accounts')) {
          state.accountExists = true;
          return {};
        }

        if (sql.includes('INSERT INTO devices')) {
          const device: DeviceRecord = {
            id: String(args[0]),
            accountId: String(args[1]),
            name: String(args[2]),
            registrationTokenHash: String(args[3]),
            mutedUntil: null,
            tokenHash: null,
            hostname: null,
            platform: null,
            agentVersion: null,
            heartbeatIntervalSeconds: Number(args[4]),
            missedHeartbeatThresholdSeconds: Number(args[5]),
            lastHeartbeatAt: null,
            lastSeenAt: null,
            createdAt: String(args[6]),
            updatedAt: String(args[7]),
          };
          state.devices.set(device.id, device);
          return {};
        }

        if (sql.includes('INSERT INTO checks')) {
          const check: CheckConfig = {
            id: String(args[0]),
            accountId: String(args[1]),
            deviceId: args[2] === null ? null : String(args[2]),
            source: String(args[3]) as CheckConfig['source'],
            type: String(args[4]) as CheckConfig['type'],
            name: String(args[5]),
            target: args[6] === null ? null : String(args[6]),
            configJson: String(args[7]),
            warningThreshold: args[8] === null ? null : Number(args[8]),
            criticalThreshold: args[9] === null ? null : Number(args[9]),
            expectedStatus: args[10] === null ? null : Number(args[10]),
            intervalSeconds: Number(args[11]),
            enabled: Number(args[12]),
            createdAt: String(args[13]),
            updatedAt: String(args[14]),
          };
          state.checks.set(check.id, check);
          return {};
        }

        if (sql.includes('UPDATE checks')) {
          const existing = state.checks.get(String(args[3]));
          if (!existing) {
            throw new Error('Missing check for update');
          }
          state.checks.set(existing.id, {
            ...existing,
            type: String(args[0]) as CheckConfig['type'],
            configJson: String(args[1]),
            updatedAt: String(args[2]),
          });
          return {};
        }

        if (sql.includes('INSERT INTO check_results')) {
          state.checkResults.push({
            id: String(args[0]),
            checkId: String(args[1]),
            deviceId: args[2],
            status: String(args[3]),
            message: String(args[4]),
            valueText: args[5],
            valueNumber: args[6],
            unit: args[7],
            metadataJson: String(args[8]),
            observedAt: String(args[9]),
            createdAt: String(args[10]),
          });
          return {};
        }

        if (sql.includes('INSERT INTO incidents')) {
          const incident: IncidentRecord & { updatedAt?: string | null } = {
            id: String(args[0]),
            accountId: String(args[1]),
            deviceId: args[2] === null ? null : String(args[2]),
            checkId: args[3] === null ? null : String(args[3]),
            status: String(args[4]) as IncidentRecord['status'],
            title: String(args[5]),
            message: String(args[6]),
            openedAt: String(args[7]),
            recoveredAt: args[8] === null ? null : String(args[8]),
            mutedUntil: args[9] === null ? null : String(args[9]),
            lastNotificationAt: args[10] === null ? null : String(args[10]),
            notificationCount: Number(args[11]),
            updatedAt: null,
          };
          state.incidents.set(incident.id, incident);
          return {};
        }

        if (sql.includes('UPDATE incidents SET recovered_at = ?, updated_at = ?')) {
          if (state.failRecoverWithUpdatedAtOnce) {
            state.failRecoverWithUpdatedAtOnce = false;
            throw new Error('Simulated D1 update failure');
          }
          const incident = state.incidents.get(String(args[2]));
          if (incident) {
            incident.recoveredAt = String(args[0]);
            incident.updatedAt = String(args[1]);
          }
          return {};
        }

        if (sql.includes('UPDATE incidents SET recovered_at = ? WHERE id = ?')) {
          const incident = state.incidents.get(String(args[1]));
          if (incident) {
            incident.recoveredAt = String(args[0]);
          }
          return {};
        }

        throw new Error(`Unhandled run() SQL in test: ${sql}`);
      };

      return {
        bind(...args: unknown[]) {
          return {
            first: async <T>() => (await first(args)) as T | null,
            all: async <T>() => ({ results: [] as T[] }),
            run: async () => run(args),
          };
        },
        first: async <T>() => (await first([])) as T | null,
        all: async <T>() => ({ results: [] as T[] }),
        run: async () => run([]),
      };
    },
  } as D1Database;
}

describe('d1 helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the default account once and persists devices', async () => {
    const state = createState();
    const db = createDb(state);

    expect(await ensureDefaultAccount(db)).toBe('acct_default');
    expect(state.accountExists).toBe(true);
    expect(await ensureDefaultAccount(db)).toBe('acct_default');

    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('00000000-0000-0000-0000-000000000001');
    const device = await createDevice(db, 'home-mini-pc', 'reg_hash', 60, 300);
    expect(device).toMatchObject({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'home-mini-pc',
      registrationTokenHash: 'reg_hash',
      heartbeatIntervalSeconds: 60,
      missedHeartbeatThresholdSeconds: 300,
    });

    state.devices.get('00000000-0000-0000-0000-000000000001')!.tokenHash = 'device_hash';
    expect(await getDeviceByRegistrationTokenHash(db, 'reg_hash')).toMatchObject({ id: '00000000-0000-0000-0000-000000000001' });
    expect(await getDeviceByRegistrationTokenHash(db, 'missing')).toBeNull();
    expect(await getDeviceByTokenHash(db, 'device_hash')).toMatchObject({ id: '00000000-0000-0000-0000-000000000001' });
    expect(await getDeviceByTokenHash(db, 'missing')).toBeNull();
  });

  it('inserts and updates checks, then records check results', async () => {
    const state = createState();
    const db = createDb(state);

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000011')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000012')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000013')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000014');

    const inserted = await upsertCheck(db, 'dev_1', {
      key: 'disk.root',
      name: 'Root Disk',
      type: 'disk',
      source: 'agent',
      status: 'warning',
      message: '/ is 82% full',
      value: 82,
      unit: 'percent',
      metadata: { target: '/' },
    });

    expect(inserted).toMatchObject({
      id: '00000000-0000-0000-0000-000000000011',
      deviceId: 'dev_1',
      source: 'agent',
      type: 'disk',
      target: '/',
    });

    const updated = await upsertCheck(db, 'dev_1', {
      key: 'disk.root',
      name: 'Root Disk',
      type: 'http',
      source: 'agent',
      status: 'critical',
      message: 'Now failing',
      metadata: { target: '/' },
    });

    expect(updated.id).toBe('00000000-0000-0000-0000-000000000011');
    expect(updated.type).toBe('http');
    expect(JSON.parse(updated.configJson)).toEqual({
      key: 'dev_1:disk.root',
      metadata: { target: '/' },
    });

    const cloudCheck = await upsertCheck(db, null, {
      key: 'dns.cloudflare',
      name: 'DNS Resolve',
      type: 'dns',
      source: 'cloud',
      status: 'ok',
      message: 'Resolved 1.1.1.1',
    });

    expect(cloudCheck).toMatchObject({
      id: '00000000-0000-0000-0000-000000000012',
      deviceId: null,
      source: 'cloud',
      target: null,
    });
    expect(JSON.parse(cloudCheck.configJson)).toEqual({
      key: 'cloud:dns.cloudflare',
      metadata: {},
    });

    const updatedCloudCheck = await upsertCheck(db, null, {
      key: 'dns.cloudflare',
      name: 'DNS Resolve',
      type: 'dns',
      source: 'cloud',
      status: 'warning',
      message: 'Using default metadata',
    });
    expect(updatedCloudCheck.id).toBe('00000000-0000-0000-0000-000000000012');
    expect(JSON.parse(updatedCloudCheck.configJson)).toEqual({
      key: 'cloud:dns.cloudflare',
      metadata: {},
    });

    await insertCheckResult(
      db,
      inserted.id,
      'dev_1',
      {
        key: 'disk.root',
        name: 'Root Disk',
        type: 'disk',
        source: 'agent',
        status: 'warning',
        message: '/ is 82% full',
        value: 82,
        unit: 'percent',
        metadata: { path: '/' },
      },
      '2026-05-17T10:00:00Z',
    );
    await insertCheckResult(
      db,
      cloudCheck.id,
      null,
      {
        key: 'dns.cloudflare',
        name: 'DNS Resolve',
        type: 'dns',
        source: 'cloud',
        status: 'critical',
        message: 'No answer returned',
        value: 'missing',
      },
      '2026-05-17T11:00:00Z',
    );

    expect(state.checkResults).toHaveLength(2);
    expect(state.checkResults[0]).toMatchObject({
      deviceId: 'dev_1',
      valueText: null,
      valueNumber: 82,
      unit: 'percent',
    });
    expect(state.checkResults[1]).toMatchObject({
      deviceId: null,
      valueText: 'missing',
      valueNumber: null,
    });
  });

  it('opens, looks up, and recovers incidents, including the fallback update path', async () => {
    const state = createState();
    const db = createDb(state);

    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000021')
      .mockReturnValueOnce('00000000-0000-0000-0000-000000000022');

    const incident = await openIncident(
      db,
      'dev_1',
      'chk_1',
      'Root Disk failed',
      '/ is 99% full',
      'critical',
    );
    expect(incident.id).toBe('00000000-0000-0000-0000-000000000021');
    expect(await getOpenIncident(db, 'dev_1', 'chk_1')).toMatchObject({ id: '00000000-0000-0000-0000-000000000021' });
    expect(await getOpenIncident(db, 'dev_2', 'chk_9')).toBeNull();

    await recoverIncident(db, '00000000-0000-0000-0000-000000000021');
    expect(await getOpenIncident(db, 'dev_1', 'chk_1')).toBeNull();

    state.failRecoverWithUpdatedAtOnce = true;
    await openIncident(
      db,
      'dev_1',
      'chk_2',
      'TLS check failed',
      'Certificate expired',
      'warning',
    );
    await recoverIncident(db, '00000000-0000-0000-0000-000000000022');
    expect(state.incidents.get('00000000-0000-0000-0000-000000000022')?.recoveredAt).toBeTruthy();
  });
});
