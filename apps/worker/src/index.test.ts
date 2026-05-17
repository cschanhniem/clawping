/// <reference types="@cloudflare/workers-types" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEnv } from './__tests__/helpers';

vi.mock('./routes/health', () => ({
  handleHealth: vi.fn(() => new Response('health')),
}));
vi.mock('./routes/install', () => ({
  installScript: vi.fn(() => new Response('install')),
}));
vi.mock('./routes/auth', () => ({
  login: vi.fn(async () => new Response('login')),
  logout: vi.fn(async () => new Response('logout')),
  me: vi.fn(async () => new Response('me')),
}));
vi.mock('./routes/telegram', () => ({
  telegramWebhook: vi.fn(async () => new Response('telegram')),
}));
vi.mock('./routes/agents', () => ({
  registerAgent: vi.fn(async () => new Response('register')),
  receiveHeartbeat: vi.fn(async () => new Response('heartbeat')),
}));
vi.mock('./routes/dashboard-api', () => ({
  handleDashboardRequest: vi.fn(async () => new Response('dashboard')),
}));
vi.mock('./routes/checks', () => ({
  runScheduledChecks: vi.fn(async () => undefined),
  sweepMissedHeartbeats: vi.fn(async () => undefined),
}));
vi.mock('./queues/alert-queue', () => ({
  processAlertBatch: vi.fn(async () => undefined),
}));
vi.mock('./util', async () => {
  const actual = await vi.importActual<typeof import('./util')>('./util');
  return {
    ...actual,
    ensureAdminPassword: vi.fn(async () => undefined),
  };
});

describe('worker entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes requests and scheduled handlers', async () => {
    const worker = (await import('./index')).default;
    const env = createMockEnv();
    const handleFetch = worker.fetch as (request: Request, env: unknown, ctx: unknown) => Promise<Response>;

    expect(await (await handleFetch(new Request('https://clawping.test/'), env, {})).text()).toContain(
      'ClawPing worker is running.',
    );
    expect(await (await handleFetch(new Request('https://clawping.test/api/health'), env, {})).text()).toBe('health');
    expect(await (await handleFetch(new Request('https://clawping.test/install.sh'), env, {})).text()).toBe('install');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/auth/login', { method: 'POST' }),
          env,
          {},
        )
      ).text(),
    ).toBe('login');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/dashboard/overview'),
          env,
          {},
        )
      ).text(),
    ).toBe('dashboard');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/auth/logout', { method: 'POST' }),
          env,
          {},
        )
      ).text(),
    ).toBe('logout');
    expect(await (await handleFetch(new Request('https://clawping.test/api/auth/me'), env, {})).text()).toBe('me');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/telegram/webhook', { method: 'POST' }),
          env,
          {},
        )
      ).text(),
    ).toBe('telegram');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/agent/register', { method: 'POST' }),
          env,
          {},
        )
      ).text(),
    ).toBe('register');
    expect(
      await (
        await handleFetch(
          new Request('https://clawping.test/api/agent/heartbeat', { method: 'POST' }),
          env,
          {},
        )
      ).text(),
    ).toBe('heartbeat');
    expect((await handleFetch(new Request('https://clawping.test/missing'), env, {})).status).toBe(404);

    const waitUntil = vi.fn();
    await worker.scheduled!({} as never, env as never, { waitUntil } as never);
    expect(waitUntil).toHaveBeenCalledTimes(2);

    await worker.queue!({} as never, env as never, {} as never);
  });
});
