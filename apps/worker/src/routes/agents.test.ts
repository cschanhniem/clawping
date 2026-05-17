import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDB, createMockDeviceState, createMockEnv, createMockStatement } from '../__tests__/helpers';

vi.mock('../lib/d1', () => ({
  getDeviceByRegistrationTokenHash: vi.fn(),
  getDeviceByTokenHash: vi.fn(),
  upsertCheck: vi.fn(async () => ({ id: 'chk_1' })),
  insertCheckResult: vi.fn(async () => undefined),
  getOpenIncident: vi.fn(async () => null),
  openIncident: vi.fn(async () => ({ id: 'inc_1' })),
  createDevice: vi.fn(),
}));

vi.mock('../util', async () => {
  const actual = await vi.importActual<typeof import('../util')>('../util');
  return {
    ...actual,
    hashToken: vi.fn(async (value: string) => `hashed:${value}`),
    newToken: vi.fn(() => 'cp_device_123'),
  };
});

describe('agent routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers an agent with a valid registration token', async () => {
    const d1 = await import('../lib/d1');
    vi.mocked(d1.getDeviceByRegistrationTokenHash).mockResolvedValue({
      id: 'dev_1',
      heartbeatIntervalSeconds: 60,
    } as never);

    const env = createMockEnv({
      DB: createMockDB((sql) => {
        if (sql.includes('UPDATE devices')) {
          return createMockStatement({ run: {} });
        }
        return createMockStatement({});
      }),
    });
    const { registerAgent } = await import('./agents');

    const response = await registerAgent(
      new Request('https://clawping.test/api/agent/register', {
        method: 'POST',
        body: JSON.stringify({ registrationToken: 'cp_reg_1', deviceName: 'home-mini-pc' }),
      }),
      env as never,
    );
    const body = (await response.json()) as { deviceToken: string };
    expect(body.deviceToken).toBe('cp_device_123');
  });

  it('accepts a heartbeat and queues alerts', async () => {
    const d1 = await import('../lib/d1');
    vi.mocked(d1.getDeviceByTokenHash).mockResolvedValue({
      id: 'dev_1',
      name: 'home-mini-pc',
      heartbeatIntervalSeconds: 60,
    } as never);

    const deviceState = createMockDeviceState(true);
    const env = createMockEnv({
      DEVICE_STATE: deviceState,
      DB: createMockDB((sql) => {
        if (sql.includes('UPDATE devices')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('SELECT chat_id FROM telegram_channels')) {
          return createMockStatement({ all: [{ chat_id: '1' }] });
        }
        return createMockStatement({});
      }),
    });
    const { receiveHeartbeat } = await import('./agents');

    const response = await receiveHeartbeat(
      new Request('https://clawping.test/api/agent/heartbeat', {
        method: 'POST',
        headers: { authorization: 'Bearer cp_device_123' },
        body: JSON.stringify({
          deviceId: 'dev_1',
          agentVersion: '0.1.0',
          hostname: 'mini.local',
          timestamp: '2026-05-17T10:00:00Z',
          uptimeSeconds: 100,
          checks: [
            {
              key: 'disk',
              name: 'Root Disk',
              type: 'disk',
              source: 'agent',
              status: 'warning',
              message: '/ is 82% full',
            },
          ],
        }),
      }),
      env as never,
    );

    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(env.ALERT_QUEUE.send).toHaveBeenCalled();
  });

  it('rejects rate-limited or invalid agent requests', async () => {
    const util = await import('../util');
    const d1 = await import('../lib/d1');
    const env = createMockEnv();
    const { registerAgent, receiveHeartbeat } = await import('./agents');

    vi.spyOn(util, 'enforceRateLimit').mockResolvedValueOnce(false);
    expect(
      (
        await registerAgent(
          new Request('https://clawping.test/api/agent/register', { method: 'POST', body: JSON.stringify({ registrationToken: 'cp_reg_1', deviceName: 'mini' }) }),
          env as never,
        )
      ).status,
    ).toBe(429);

    vi.mocked(d1.getDeviceByRegistrationTokenHash).mockResolvedValueOnce(null as never);
    expect(
      (
        await registerAgent(
          new Request('https://clawping.test/api/agent/register', { method: 'POST', body: JSON.stringify({ registrationToken: 'cp_reg_1', deviceName: 'mini' }) }),
          env as never,
        )
      ).status,
    ).toBe(401);

    vi.spyOn(util, 'enforceRateLimit').mockResolvedValueOnce(false);
    expect(
      (
        await receiveHeartbeat(
          new Request('https://clawping.test/api/agent/heartbeat', { method: 'POST' }),
          env as never,
        )
      ).status,
    ).toBe(429);

    expect(
      (
        await receiveHeartbeat(
          new Request('https://clawping.test/api/agent/heartbeat', { method: 'POST' }),
          env as never,
        )
      ).status,
    ).toBe(401);

    vi.mocked(d1.getDeviceByTokenHash).mockResolvedValueOnce(null as never);
    expect(
      (
        await receiveHeartbeat(
          new Request('https://clawping.test/api/agent/heartbeat', {
            method: 'POST',
            headers: { authorization: 'Bearer cp_device_123' },
            body: JSON.stringify({
              deviceId: 'dev_1',
              agentVersion: '0.1.0',
              hostname: 'mini.local',
              timestamp: '2026-05-17T10:00:00Z',
              uptimeSeconds: 100,
              checks: [],
            }),
          }),
          env as never,
        )
      ).status,
    ).toBe(401);
  });

  it('recovers existing incidents and suppresses duplicate alerts', async () => {
    const d1 = await import('../lib/d1');
    vi.mocked(d1.getDeviceByTokenHash).mockResolvedValue({
      id: 'dev_1',
      name: 'home-mini-pc',
      heartbeatIntervalSeconds: 60,
    } as never);
    vi.mocked(d1.getOpenIncident).mockResolvedValueOnce({ id: 'inc_1' } as never);

    const env = createMockEnv({
      DEVICE_STATE: createMockDeviceState(false),
      DB: createMockDB((sql) => {
        if (sql.includes('UPDATE devices')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('UPDATE incidents SET recovered_at')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('SELECT chat_id FROM telegram_channels')) {
          return createMockStatement({ all: [{ chat_id: '1' }] });
        }
        return createMockStatement({});
      }),
    });
    const { receiveHeartbeat } = await import('./agents');

    const response = await receiveHeartbeat(
      new Request('https://clawping.test/api/agent/heartbeat', {
        method: 'POST',
        headers: { authorization: 'Bearer cp_device_123' },
        body: JSON.stringify({
          deviceId: 'dev_1',
          agentVersion: '0.1.0',
          hostname: 'mini.local',
          timestamp: '2026-05-17T10:00:00Z',
          uptimeSeconds: 100,
          checks: [
            {
              key: 'system.online',
              name: 'Agent Heartbeat',
              type: 'heartbeat',
              source: 'agent',
              status: 'ok',
              message: 'Agent heartbeat received',
            },
          ],
        }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(env.ALERT_QUEUE.send).not.toHaveBeenCalled();
  });

  it('sends recovery and critical notifications through the durable-object flow', async () => {
    const d1 = await import('../lib/d1');
    const { receiveHeartbeat } = await import('./agents');

    vi.mocked(d1.getDeviceByTokenHash).mockResolvedValue({
      id: 'dev_1',
      name: 'home-mini-pc',
      heartbeatIntervalSeconds: 60,
    } as never);

    vi.mocked(d1.getOpenIncident).mockResolvedValueOnce({ id: 'inc_recover' } as never);
    const recoveryEnv = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: createMockDB((sql) => {
        if (sql.includes('UPDATE devices')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('UPDATE incidents SET recovered_at')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('SELECT chat_id FROM telegram_channels')) {
          return createMockStatement({ all: [{ chat_id: '1' }] });
        }
        return createMockStatement({});
      }),
    });

    await receiveHeartbeat(
      new Request('https://clawping.test/api/agent/heartbeat', {
        method: 'POST',
        headers: { authorization: 'Bearer cp_device_123' },
        body: JSON.stringify({
          deviceId: 'dev_1',
          agentVersion: '0.1.0',
          hostname: 'mini.local',
          timestamp: '2026-05-17T10:00:00Z',
          uptimeSeconds: 100,
          checks: [
            {
              key: 'system.online',
              name: 'Agent Heartbeat',
              type: 'heartbeat',
              source: 'agent',
              status: 'ok',
              message: 'Agent heartbeat received',
            },
          ],
        }),
      }),
      recoveryEnv as never,
    );
    expect(recoveryEnv.ALERT_QUEUE.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('recovered on home-mini-pc') }),
    );

    vi.mocked(d1.getOpenIncident).mockResolvedValueOnce(null as never);
    const criticalEnv = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('UPDATE devices')) {
            return createMockStatement({ run: {} });
          }
          if (sql.includes('SELECT chat_id FROM telegram_channels')) {
            return {
              all: async () => ({ results: [] }),
              bind: () => ({ run: async () => ({}) }),
            };
          }
          return createMockStatement({});
        }),
      } as never,
    });

    await receiveHeartbeat(
      new Request('https://clawping.test/api/agent/heartbeat', {
        method: 'POST',
        headers: { authorization: 'Bearer cp_device_123' },
        body: JSON.stringify({
          deviceId: 'dev_1',
          agentVersion: '0.1.0',
          hostname: 'mini.local',
          timestamp: '2026-05-17T10:00:00Z',
          uptimeSeconds: 100,
          checks: [
            {
              key: 'immich',
              name: 'Immich',
              type: 'http',
              source: 'agent',
              status: 'critical',
              message: 'Connection refused',
            },
          ],
        }),
      }),
      criticalEnv as never,
    );
    expect(criticalEnv.ALERT_QUEUE.send).not.toHaveBeenCalled();
    expect(criticalEnv.DEVICE_STATE.fetch).toHaveBeenCalledWith('https://device-state/mark-open');
  });
});
