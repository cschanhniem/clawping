import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDB, createMockDeviceState, createMockEnv, createMockStatement } from '../__tests__/helpers';

vi.mock('../util', async () => {
  const actual = await vi.importActual<typeof import('../util')>('../util');
  return {
    ...actual,
    telegramApi: vi.fn(async () => undefined),
  };
});

describe('telegram webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function sendCommand(env: ReturnType<typeof createMockEnv>, text: string) {
    const { telegramWebhook } = await import('./telegram');
    return telegramWebhook(
      new Request('https://clawping.test/api/telegram/webhook', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret' },
        body: JSON.stringify({
          update_id: 1,
          message: {
            message_id: 1,
            date: 1,
            text,
            chat: { id: 1, type: 'private' },
          },
        }),
      }),
      env as never,
    );
  }

  it('rejects invalid secrets and rate-limited calls', async () => {
    const util = await import('../util');
    const env = createMockEnv();
    const { telegramWebhook } = await import('./telegram');

    vi.spyOn(util, 'enforceRateLimit').mockResolvedValueOnce(false);
    expect(
      (
        await telegramWebhook(
          new Request('https://clawping.test/api/telegram/webhook', {
            method: 'POST',
            body: JSON.stringify({ update_id: 1 }),
          }),
          env as never,
        )
      ).status,
    ).toBe(429);

    const bad = await telegramWebhook(
      new Request('https://clawping.test/api/telegram/webhook', {
        method: 'POST',
        body: JSON.stringify({ update_id: 1 }),
      }),
      env as never,
    );
    expect(bad.status).toBe(401);
  });

  it('ignores updates without text', async () => {
    const env = createMockEnv();
    const { telegramWebhook } = await import('./telegram');
    const response = await telegramWebhook(
      new Request('https://clawping.test/api/telegram/webhook', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret' },
        body: JSON.stringify({
          update_id: 1,
          message: {
            message_id: 1,
            date: 1,
            chat: { id: 1, type: 'private' },
          },
        }),
      }),
      env as never,
    );
    expect(await response.json()).toEqual({ ok: true, ignored: true });
  });

  it('handles status, checks, mute, test, and unknown commands', async () => {
    const util = await import('../util');
    const env = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: createMockDB((sql) => {
        if (sql.includes('INSERT INTO telegram_channels')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('SELECT name, last_heartbeat_at')) {
          return createMockStatement({
            all: [
              {
                name: 'home-mini-pc',
                last_heartbeat_at: new Date().toISOString(),
                missed_heartbeat_threshold_seconds: 300,
              },
              {
                name: 'nas-box',
                last_heartbeat_at: '2020-01-01T00:00:00Z',
                missed_heartbeat_threshold_seconds: 300,
              },
            ],
          });
        }
        if (sql.includes('SELECT title, status FROM incidents')) {
          return createMockStatement({ all: [{ title: 'Immich is down', status: 'critical' }] });
        }
        if (sql.includes('SELECT c.name')) {
          return createMockStatement({
            all: [
              { name: 'Homepage', device_name: null, status: 'ok', message: 'HTTP 200' },
              { name: 'Disk', device_name: 'home-mini-pc', status: 'warning', message: '/ is 82% full' },
              { name: 'Immich', device_name: 'home-mini-pc', status: 'critical', message: 'Connection refused' },
            ],
          });
        }
        if (sql.includes('SELECT id FROM devices WHERE name')) {
          return createMockStatement({ first: { id: 'dev_1' } });
        }
        return createMockStatement({ run: {} });
      }),
    });
    const reply = vi.mocked(util.telegramApi);

    expect((await sendCommand(env, '/start')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      chat_id: '1',
      text: expect.stringContaining('connect Telegram'),
    });

    expect((await sendCommand(env, '/status')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('Active incidents:'),
    });
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('• Immich is down (critical)'),
    });

    expect((await sendCommand(env, '/checks')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('❌ home-mini-pc: Immich'),
    });

    expect((await sendCommand(env, '/mute 1h')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('Muted all alerts until'),
    });

    expect((await sendCommand(env, '/mute home-mini-pc 30m')).status).toBe(200);
    expect(env.DEVICE_STATE.get).toHaveBeenCalled();
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('Muted home-mini-pc until'),
    });

    expect((await sendCommand(env, '/test')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Test alert from ClawPing. Telegram is connected.',
    });

    expect((await sendCommand(env, '/unknown')).status).toBe(200);
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('Unknown command'),
    });
  });

  it('handles status without incidents and validates mute syntax', async () => {
    const util = await import('../util');
    const env = createMockEnv({
      DEVICE_STATE: createMockDeviceState(true),
      DB: createMockDB((sql) => {
        if (sql.includes('INSERT INTO telegram_channels')) {
          return createMockStatement({ run: {} });
        }
        if (sql.includes('SELECT name, last_heartbeat_at')) {
          return createMockStatement({ all: [] });
        }
        if (sql.includes('SELECT title, status FROM incidents')) {
          return createMockStatement({ all: [] });
        }
        if (sql.includes('SELECT id FROM devices WHERE name')) {
          return createMockStatement({ first: null });
        }
        return createMockStatement({ run: {} });
      }),
    });
    const reply = vi.mocked(util.telegramApi);

    await sendCommand(env, '/status');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.not.stringContaining('Active incidents:'),
    });

    await sendCommand(env, '/mute');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Usage: /mute 1h or /mute device-name 30m',
    });

    await sendCommand(env, '/mute nope');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Usage: /mute 1h or /mute device-name 30m',
    });

    await sendCommand(env, '/mute home-mini-pc nope');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Usage: /mute device-name 30m',
    });

    await sendCommand(env, '/mute home-mini-pc 30m');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Device not found: home-mini-pc',
    });
  });

  it('falls back cleanly when query helpers return no results arrays', async () => {
    const util = await import('../util');
    const env = createMockEnv({
      DB: {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('INSERT INTO telegram_channels')) {
            return createMockStatement({ run: {} });
          }
          if (sql.includes('SELECT name, last_heartbeat_at') || sql.includes('SELECT title, status FROM incidents') || sql.includes('SELECT c.name')) {
            return {
              all: async () => ({ results: [] }),
              bind: () => ({ first: async () => null, run: async () => ({}) }),
            };
          }
          if (sql.includes('SELECT id FROM devices WHERE name')) {
            return createMockStatement({ first: null });
          }
          return createMockStatement({ run: {} });
        }),
      } as never,
    });
    const reply = vi.mocked(util.telegramApi);

    await sendCommand(env, '/status');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: expect.stringContaining('0 active incidents'),
    });

    await sendCommand(env, '/checks');
    expect(reply.mock.calls.at(-1)?.[2]).toMatchObject({
      text: 'Checks\n',
    });
  });
});
