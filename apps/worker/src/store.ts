import type { Env } from './index';

export async function getKvJson<T>(env: Env, key: string, fallback: T): Promise<T> {
  const raw = await env.KV.get(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setKvJson(env: Env, key: string, value: unknown): Promise<void> {
  await env.KV.put(key, JSON.stringify(value));
}
