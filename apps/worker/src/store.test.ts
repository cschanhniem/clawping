import { describe, expect, it } from 'vitest';
import { createMockEnv } from './__tests__/helpers';
import { getKvJson, setKvJson } from './store';

describe('worker KV store helpers', () => {
  it('reads fallback and stores json', async () => {
    const env = createMockEnv();
    expect(await getKvJson(env as never, 'missing', { ok: false })).toEqual({ ok: false });

    await setKvJson(env as never, 'meta:test', { ok: true });
    expect(await getKvJson(env as never, 'meta:test', { ok: false })).toEqual({ ok: true });
  });

  it('returns fallback for invalid json', async () => {
    const env = createMockEnv();
    env.KV.store.set('broken', '{');
    expect(await getKvJson(env as never, 'broken', { ok: 'fallback' })).toEqual({ ok: 'fallback' });
  });
});
