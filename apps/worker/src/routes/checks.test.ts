import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDB, createMockDeviceState, createMockEnv, createMockStatement } from '../__tests__/helpers';

vi.mock('../monitor', () => ({
  runCloudCheck: vi.fn(async () => ({
    key: 'cloud-1',
    name: 'Homepage',
    type: 'http',
    source: 'cloud',
    status: 'critical',
    message: 'Expected 200, got 500',
    observedAt: '2026-05-17T10:00:00Z',
  })),
}));

vi.mock('../lib/d1', () => ({
  upsertCheck: vi.fn(async () => ({ id: 'chk_1' })),
  insertCheckResult: vi.fn(async () => undefined),
  getOpenIncident: vi.fn(async () => null),
  openIncident: vi.fn(async () => ({ id: 'inc_1' })),
}));

describe('scheduled checks routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scheduled cloud checks and sweep', async () => {
    const deviceState = createMockDeviceState(true);
    const env = createMockEnv({
      DEVICE_STATE: deviceState,
      DB: createMockDB((sql) => {
        if (sql.includes("FROM checks WHERE source = 'cloud'")) {
          return createMockStatement({ all: [{ id: 'chk_1', type: 'http', target: 'https://example.com', name: 'Homepage' }] });
        }
        if (sql.includes('SELECT chat_id FROM telegram_channels')) {
          return createMockStatement({ all: [{ chat_id: '1' }] });
        }
        if (sql.includes('SELECT * FROM devices WHERE last_heartbeat_at')) {
          return createMockStatement({
            all: [
              {
                id: 'dev_1',
                name: 'home-mini-pc',
                last_heartbeat_at: '2020-01-01T00:00:00Z',
                missed_heartbeat_threshold_seconds: 300,
              },
            ],
          });
        }
        if (sql.includes('UPDATE incidents SET recovered_at')) {
          return createMockStatement({ run: {} });
        }
        return createMockStatement({});
      }),
    });

    const { runScheduledChecks, sweepMissedHeartbeats } = await import('./checks');
    await runScheduledChecks(env as never);
    await sweepMissedHeartbeats(env as never);
    expect(env.ALERT_QUEUE.send).toHaveBeenCalled();
  });

  it('recovers scheduled incidents and suppresses muted reminders', async () => {
    const monitor = await import('../monitor');
    const d1 = await import('../lib/d1');
    vi.mocked(monitor.runCloudCheck).mockResolvedValueOnce({
      key: 'cloud-1',
      name: 'Homepage',
      type: 'http',
      source: 'cloud',
      status: 'ok',
      message: 'HTTP 200',
      observedAt: '2026-05-17T10:00:00Z',
    } as never);
    vi.mocked(d1.getOpenIncident).mockResolvedValueOnce({ id: 'inc_1' } as never);

    const env = createMockEnv({
      DEVICE_STATE: createMockDeviceState(false),
      DB: createMockDB((sql) => {
        if (sql.includes("FROM checks WHERE source = 'cloud'")) {
          return createMockStatement({ all: [{ id: 'chk_1', type: 'http', target: 'https://example.com', name: 'Homepage' }] });
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

    const { runScheduledChecks } = await import('./checks');
    await runScheduledChecks(env as never);
    expect(env.ALERT_QUEUE.send).not.toHaveBeenCalled();
  });

  it('recovers fresh devices that were previously offline', async () => {
    const d1 = await import('../lib/d1');
    vi.mocked(d1.getOpenIncident).mockResolvedValueOnce({ id: 'inc_1' } as never);

    const env = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: createMockDB((sql) => {
        if (sql.includes('SELECT * FROM devices WHERE last_heartbeat_at')) {
          return createMockStatement({
            all: [
              {
                id: 'dev_1',
                name: 'home-mini-pc',
                last_heartbeat_at: new Date().toISOString(),
                missed_heartbeat_threshold_seconds: 300,
              },
            ],
          });
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

    const { sweepMissedHeartbeats } = await import('./checks');
    await sweepMissedHeartbeats(env as never);
    expect(env.ALERT_QUEUE.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('is back online') }),
    );
  });

  it('handles empty query results and warning checks without timestamps', async () => {
    const monitor = await import('../monitor');
    vi.mocked(monitor.runCloudCheck).mockResolvedValueOnce({
      key: 'cloud-2',
      name: 'DNS Check',
      type: 'dns',
      source: 'cloud',
      status: 'warning',
      message: 'Slow DNS response',
    } as never);

    const sparseDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes("FROM checks WHERE source = 'cloud'")) {
          return {
            all: async () => ({ results: [] }),
            bind: () => ({ run: async () => ({}) }),
          };
        }
        if (sql.includes('SELECT * FROM devices WHERE last_heartbeat_at')) {
          return {
            all: async () => ({ results: [] }),
            bind: () => ({ run: async () => ({}) }),
          };
        }
        return createMockStatement({});
      }),
    };
    const env = createMockEnv({ DB: sparseDb as never });
    const { runScheduledChecks, sweepMissedHeartbeats } = await import('./checks');

    await runScheduledChecks(env as never);
    await sweepMissedHeartbeats(env as never);
    expect(env.KV.put).toHaveBeenCalled();

    const warningEnv = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes("FROM checks WHERE source = 'cloud'")) {
            return createMockStatement({ all: [{ id: 'chk_2', type: 'dns', target: 'example.com', name: 'DNS Check' }] });
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

    await runScheduledChecks(warningEnv as never);
    expect(warningEnv.ALERT_QUEUE.send).not.toHaveBeenCalled();
  });
});
