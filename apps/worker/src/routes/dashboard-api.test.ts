import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDB, createMockEnv, createMockStatement } from '../__tests__/helpers';

vi.mock('../util', async () => {
  const actual = await vi.importActual<typeof import('../util')>('../util');
  return {
    ...actual,
    requireSession: vi.fn(async () => ({ accountId: 'acct_default', role: 'admin', exp: 9999999999 })),
    unauthorized: vi.fn(() => new Response('unauthorized', { status: 401 })),
    newToken: vi.fn(() => 'cp_device_new'),
    hashToken: vi.fn(async () => 'hashed'),
  };
});

vi.mock('../lib/d1', () => ({
  ensureDefaultAccount: vi.fn(async () => 'acct_default'),
  createDevice: vi.fn(async () => ({ id: 'dev_1', name: 'home-mini-pc', heartbeatIntervalSeconds: 60 })),
  nowIso: vi.fn(() => '2026-05-17T00:00:00Z'),
}));

describe('dashboard api route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns overview and lists resources', async () => {
    const env = createMockEnv({
      DB: createMockDB((sql) => {
        if (sql.includes('COUNT(*) AS count FROM devices') && sql.includes('last_heartbeat_at')) {
          return createMockStatement({ first: { count: 1 } });
        }
        if (sql.includes('COUNT(*) AS count FROM devices')) {
          return createMockStatement({ first: { count: 2 } });
        }
        if (sql.includes('COUNT(*) AS count FROM incidents')) {
          return createMockStatement({ first: { count: 3 } });
        }
        if (sql.includes("status = 'critical'")) {
          return createMockStatement({ first: { count: 1 } });
        }
        if (sql.includes("status = 'warning'")) {
          return createMockStatement({ first: { count: 2 } });
        }
        if (sql.includes('SELECT * FROM devices')) {
          return createMockStatement({ all: [{ id: 'dev_1' }] });
        }
        if (sql.includes('SELECT * FROM incidents')) {
          return createMockStatement({ all: [{ id: 'inc_1' }] });
        }
        if (sql.includes('SELECT * FROM checks')) {
          return createMockStatement({ all: [{ id: 'chk_1' }] });
        }
        return createMockStatement({});
      }),
    });
    env.KV.store.set('meta:lastSweepAt', '2026-05-17T10:00:00Z');

    const { handleDashboardRequest } = await import('./dashboard-api');
    const overview = await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/overview'), env as never);
    const overviewBody = (await overview.json()) as { overview: { devicesOffline: number } };
    expect(overviewBody.overview.devicesOffline).toBe(1);

    const devices = await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/devices'), env as never);
    const devicesBody = (await devices.json()) as { devices: Array<{ id: string }> };
    expect(devicesBody.devices).toEqual([{ id: 'dev_1' }]);

    const incidents = await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/incidents'), env as never);
    expect(((await incidents.json()) as { incidents: Array<{ id: string }> }).incidents).toEqual([{ id: 'inc_1' }]);

    const checks = await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/checks'), env as never);
    expect(((await checks.json()) as { checks: Array<{ id: string }> }).checks).toEqual([{ id: 'chk_1' }]);
  });

  it('creates device/check and rotates/revokes tokens', async () => {
    const env = createMockEnv({
      DB: createMockDB((sql) => {
        if (sql.includes('INSERT INTO checks')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('UPDATE devices SET token_hash')) {
          return createMockStatement({ run: {} });
        }
        return createMockStatement({});
      }),
    });
    const { handleDashboardRequest } = await import('./dashboard-api');

    const createDeviceResponse = await handleDashboardRequest(
      new Request('https://clawping.test/api/dashboard/devices', {
        method: 'POST',
        body: JSON.stringify({ name: 'home-mini-pc' }),
      }),
      env as never,
    );
    const createDeviceBody = (await createDeviceResponse.json()) as { registrationToken: string };
    expect(createDeviceBody.registrationToken).toBeDefined();

    const createCheckResponse = await handleDashboardRequest(
      new Request('https://clawping.test/api/dashboard/checks', {
        method: 'POST',
        body: JSON.stringify({ name: 'Homepage', type: 'http', source: 'cloud', target: 'https://example.com' }),
      }),
      env as never,
    );
    const createCheckBody = (await createCheckResponse.json()) as { check: { name: string } };
    expect(createCheckBody.check.name).toBe('Homepage');

    const rotate = await handleDashboardRequest(
      new Request('https://clawping.test/api/dashboard/devices/dev_1/rotate-token', { method: 'POST' }),
      env as never,
    );
    const rotateBody = (await rotate.json()) as { deviceToken: string };
    expect(rotateBody.deviceToken).toBe('cp_device_new');

    const revoke = await handleDashboardRequest(
      new Request('https://clawping.test/api/dashboard/devices/dev_1/revoke-token', { method: 'POST' }),
      env as never,
    );
    const revokeBody = (await revoke.json()) as { revoked: boolean };
    expect(revokeBody.revoked).toBe(true);
  });

  it('rejects unauthenticated access and unknown routes', async () => {
    const util = await import('../util');
    const { handleDashboardRequest } = await import('./dashboard-api');
    const env = createMockEnv();

    vi.mocked(util.requireSession).mockResolvedValueOnce(null as never);
    expect((await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/overview'), env as never)).status).toBe(401);

    vi.mocked(util.requireSession).mockResolvedValueOnce({
      accountId: 'acct_default',
      role: 'admin',
      exp: 9999999999,
    } as never);
    expect((await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/unknown'), env as never)).status).toBe(404);
  });

  it('falls back to empty lists and default check fields', async () => {
    const env = createMockEnv({
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT * FROM devices') || sql.includes('SELECT * FROM incidents') || sql.includes('SELECT * FROM checks')) {
            return {
              all: async () => ({ results: [] }),
              bind: () => ({ run: async () => ({}) }),
            };
          }
          if (sql.includes('INSERT INTO checks')) {
            return createMockStatement({ run: {} });
          }
          return createMockStatement({});
        }),
      } as never,
    });
    const { handleDashboardRequest } = await import('./dashboard-api');

    expect(((await (await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/devices'), env as never)).json()) as { devices: unknown[] }).devices).toEqual([]);
    expect(((await (await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/incidents'), env as never)).json()) as { incidents: unknown[] }).incidents).toEqual([]);
    expect(((await (await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/checks'), env as never)).json()) as { checks: unknown[] }).checks).toEqual([]);

    const created = await handleDashboardRequest(
      new Request('https://clawping.test/api/dashboard/checks', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      env as never,
    );
    const body = (await created.json()) as { check: { source: string; type: string; name: string; target: null } };
    expect(body.check).toMatchObject({
      source: 'cloud',
      type: 'http',
      name: 'Unnamed Check',
      target: null,
    });
  });

  it('falls back to zero overview counters when aggregates are missing', async () => {
    const env = createMockEnv({
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('COUNT(*) AS count')) {
            return {
              first: async () => ({ count: 0 }),
              bind: () => ({ run: async () => ({}) }),
            };
          }
          return createMockStatement({});
        }),
      } as never,
    });
    const { handleDashboardRequest } = await import('./dashboard-api');

    const response = await handleDashboardRequest(new Request('https://clawping.test/api/dashboard/overview'), env as never);
    expect((await response.json()) as { overview: { devicesOnline: number; devicesOffline: number; warnings: number; critical: number; activeIncidents: number } }).toMatchObject({
      overview: {
        devicesOnline: 0,
        devicesOffline: 0,
        warnings: 0,
        critical: 0,
        activeIncidents: 0,
      },
    });
  });
});
