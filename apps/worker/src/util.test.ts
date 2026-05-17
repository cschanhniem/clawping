import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  ensureAdminPassword,
  appBaseUrl,
  clearSessionCookie,
  enforceRateLimit,
  formatInstallCommand,
  getCookie,
  hashToken,
  isAccountMuted,
  json,
  makeSessionCookie,
  newToken,
  nowIso,
  parseBearerToken,
  parseDurationToMs,
  readJson,
  requireSession,
  telegramApi,
  unauthorized,
} from './util';
import { createMockEnv } from './__tests__/helpers';

describe('worker util helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds json responses and unauthorized responses', async () => {
    const response = json({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(unauthorized().status).toBe(401);
    expect(await readJson<{ hello: string }>(new Request('https://clawping.test', { body: JSON.stringify({ hello: 'world' }), method: 'POST' }))).toEqual({
      hello: 'world',
    });
  });

  it('reads cookies and bearer tokens', () => {
    const request = new Request('https://clawping.test', {
      headers: {
        cookie: 'foo=bar; clawping_session=baz',
        authorization: 'Bearer abc',
      },
    });
    expect(getCookie(request, 'foo')).toBe('bar');
    expect(getCookie(request, 'missing')).toBeNull();
    expect(getCookie(new Request('https://clawping.test', { headers: { cookie: 'foo' } }), 'foo')).toBe('');
    expect(parseBearerToken(request)).toBe('abc');
    expect(parseBearerToken(new Request('https://clawping.test'))).toBeNull();
    expect(parseBearerToken(new Request('https://clawping.test', { headers: { authorization: 'Basic abc' } }))).toBeNull();
  });

  it('creates and verifies session cookies', async () => {
    const env = createMockEnv();
    const cookie = await makeSessionCookie('acct_default', env as never);
    const token = cookie.split(';')[0].split('=')[1];
    const request = new Request('https://clawping.test', {
      headers: { cookie: `clawping_session=${token}` },
    });
    const session = await requireSession(request, env as never);
    expect(session?.accountId).toBe('acct_default');
    expect(await requireSession(new Request('https://clawping.test'), env as never)).toBeNull();
    expect(clearSessionCookie()).toContain('Max-Age=0');
  });

  it('formats tokens, hashes, urls and durations', async () => {
    expect(appBaseUrl(createMockEnv() as never)).toBe('https://clawping.test');
    expect(appBaseUrl({ APP_BASE_URL: '', DB: {} } as never, new Request('https://fallback.test'))).toBe(
      'https://fallback.test',
    );
    expect(appBaseUrl({ APP_BASE_URL: '' } as never)).toBe('http://127.0.0.1:8787');
    expect(formatInstallCommand('https://clawping.test', 'cp_reg_1', 'home-mini-pc')).toContain('--device home-mini-pc');
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parseDurationToMs('30m')).toBe(1_800_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('1d')).toBe(86_400_000);
    expect(parseDurationToMs('bad')).toBeNull();
    expect(await hashToken('hello')).toMatch(/^[a-f0-9]{64}$/);
    expect(newToken('cp_live')).toMatch(/^cp_live_/);
  });

  it('sends Telegram payloads and respects muted/rate limited state', async () => {
    const env = createMockEnv();
    await telegramApi(env as never, 'sendMessage', { chat_id: '1', text: 'ok' });
    expect(global.fetch).toHaveBeenCalled();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(telegramApi(env as never, 'sendMessage', { chat_id: '1', text: 'bad' })).rejects.toThrow();

    expect(await enforceRateLimit(env as never, 'bucket', 1, 60)).toBe(true);
    expect(await enforceRateLimit(env as never, 'bucket', 1, 60)).toBe(false);

    env.KV.store.set('mute:account', new Date(Date.now() + 60_000).toISOString());
    expect(await isAccountMuted(env as never)).toBe(true);
    env.KV.store.set('mute:account', new Date(Date.now() - 60_000).toISOString());
    expect(await isAccountMuted(env as never)).toBe(false);
  });

  it('guards admin password configuration and skips telegram calls without a token', async () => {
    const env = createMockEnv();
    await expect(ensureAdminPassword({ ...env, ADMIN_PASSWORD: '' } as never)).rejects.toThrow('ADMIN_PASSWORD is required');
    await expect(ensureAdminPassword(env as never)).resolves.toBeUndefined();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      telegramApi({ ...env, TELEGRAM_BOT_TOKEN: '' } as never, 'sendMessage', { chat_id: '1', text: 'noop' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Skipping Telegram send; TELEGRAM_BOT_TOKEN not configured');
  });
});
