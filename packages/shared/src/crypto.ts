import type { SessionPayload } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  const encoded = btoa(String.fromCharCode(...bytes));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(signature);
}

export async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${prefix}_${toBase64Url(bytes)}`;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const input = `${header}.${body}`;
  const signature = toBase64Url(await hmacSha256(secret, input));
  return `${input}.${signature}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const [header, body, signature] = token.split('.');
  if (!header || !body || !signature) {
    return null;
  }

  const expected = toBase64Url(await hmacSha256(secret, `${header}.${body}`));
  if (expected !== signature) {
    return null;
  }

  const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}
