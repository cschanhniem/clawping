import { randomToken, sha256Hex, signSession, verifySession, type SessionPayload } from '@clawping/shared';
import type { Env } from './index';
import { ensureDefaultAccount } from './lib/d1';

const COOKIE_NAME = 'clawping_session';

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) {
    return null;
  }
  const pairs = header.split(';').map((part) => part.trim().split('='));
  const hit = pairs.find(([key]) => key === name);
  return hit ? decodeURIComponent(hit[1] ?? '') : null;
}

export async function requireSession(request: Request, env: Env): Promise<SessionPayload | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return null;
  }
  return verifySession(token, env.SESSION_SECRET);
}

export async function makeSessionCookie(accountId: string, env: Env): Promise<string> {
  const payload: SessionPayload = {
    accountId,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const token = await signSession(payload, env.SESSION_SECRET);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function unauthorized(): Response {
  return json({ ok: false, error: 'Unauthorized' }, 401);
}

export async function ensureAdminPassword(env: Env): Promise<void> {
  if (!env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required');
  }
  await ensureDefaultAccount(env.DB);
}

export async function hashToken(value: string): Promise<string> {
  return sha256Hex(value);
}

export function parseBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice('Bearer '.length);
}

export function appBaseUrl(env: Env, request?: Request): string {
  return env.APP_BASE_URL || (request ? new URL(request.url).origin : 'http://127.0.0.1:8787');
}

export function formatInstallCommand(baseUrl: string, registrationToken: string, deviceName: string): string {
  return [
    `curl -fsSL ${baseUrl}/install.sh | sh -s -- \\`,
    `  --token ${registrationToken} \\`,
    `  --device ${deviceName}`,
  ].join('\n');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseDurationToMs(raw: string): number | null {
  const match = raw.trim().match(/^(\d+)(m|h|d)$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return amount * 60_000;
  if (unit === 'h') return amount * 60 * 60_000;
  return amount * 24 * 60 * 60_000;
}

export async function telegramApi(env: Env, method: string, payload: Record<string, unknown>): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn('Skipping Telegram send; TELEGRAM_BOT_TOKEN not configured');
    return;
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram API ${method} failed with ${response.status}`);
  }
}

export function newToken(prefix: string): string {
  return randomToken(prefix);
}

export async function isAccountMuted(env: Env): Promise<boolean> {
  const mutedUntil = await env.KV.get('mute:account');
  return Boolean(mutedUntil && new Date(mutedUntil).getTime() > Date.now());
}

export async function enforceRateLimit(
  env: Env,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucket = `${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  const current = Number((await env.KV.get(bucket)) ?? '0');
  if (current >= maxRequests) {
    return false;
  }
  await env.KV.put(bucket, String(current + 1), { expirationTtl: windowSeconds + 5 });
  return true;
}
