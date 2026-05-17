import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEnv } from '../__tests__/helpers';

vi.mock('../lib/d1', () => ({
  ensureDefaultAccount: vi.fn(async () => 'acct_default'),
}));

describe('auth routes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('logs in with a valid password', async () => {
    const { login } = await import('./auth');
    const env = createMockEnv();
    const response = await login(
      new Request('https://clawping.test/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'secret' }),
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('clawping_session');
  });

  it('rejects invalid password and returns me/logout responses', async () => {
    const { login, logout, me } = await import('./auth');
    const { makeSessionCookie } = await import('../util');
    const env = createMockEnv();
    const bad = await login(
      new Request('https://clawping.test/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'bad' }),
      }),
      env as never,
    );
    expect(bad.status).toBe(401);

    const signedCookie = await makeSessionCookie('acct_default', env as never);
    const token = signedCookie.split(';')[0];
    const meResponse = await me(
      new Request('https://clawping.test/api/auth/me', {
        headers: { cookie: token },
      }) as never,
      env as never,
    );
    expect(meResponse.status).toBe(200);

    const logoutResponse = await logout();
    expect(logoutResponse.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rate limits login attempts and rejects missing sessions', async () => {
    const { login, me } = await import('./auth');
    const env = createMockEnv();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await login(
        new Request('https://clawping.test/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ password: 'secret' }),
        }) as never,
        env as never,
      );
      expect(response.status).toBe(200);
    }

    expect(
      (
        await login(
          new Request('https://clawping.test/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password: 'secret' }),
          }) as never,
          env as never,
        )
      ).status,
    ).toBe(429);
    expect((await me(new Request('https://clawping.test/api/auth/me') as never, env as never)).status).toBe(401);
  });
});
