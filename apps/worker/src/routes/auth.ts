import type { Env } from '../index';
import { ensureDefaultAccount } from '../lib/d1';
import { clearSessionCookie, enforceRateLimit, json, makeSessionCookie, readJson, requireSession, unauthorized } from '../util';

export async function login(request: Request, env: Env): Promise<Response> {
  const allowed = await enforceRateLimit(env, `auth:login:${request.headers.get('cf-connecting-ip') ?? 'local'}`, 10, 60);
  if (!allowed) {
    return json({ ok: false, error: 'Rate limit exceeded' }, 429);
  }
  const body = await readJson<{ password?: string }>(request);
  if (!body.password || body.password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: 'Invalid password' }, 401);
  }

  const accountId = await ensureDefaultAccount(env.DB);
  return json(
    { ok: true, accountId },
    200,
    {
      'set-cookie': await makeSessionCookie(accountId, env),
    },
  );
}

export async function logout(): Promise<Response> {
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
}

export async function me(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) {
    return unauthorized();
  }
  return json({ ok: true, session });
}
