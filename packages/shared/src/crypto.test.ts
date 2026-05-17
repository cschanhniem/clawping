import { describe, expect, it } from 'vitest';
import { randomToken, sha256Hex, signSession, verifySession } from './crypto';

describe('shared crypto helpers', () => {
  it('hashes strings to hex', async () => {
    const hash = await sha256Hex('clawping');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates prefixed random tokens', () => {
    const token = randomToken('cp_test');
    expect(token.startsWith('cp_test_')).toBe(true);
  });

  it('signs and verifies sessions', async () => {
    const token = await signSession(
      {
        accountId: 'acct_default',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      'secret',
    );

    const payload = await verifySession(token, 'secret');
    expect(payload?.accountId).toBe('acct_default');
    expect(payload?.role).toBe('admin');
  });

  it('rejects invalid signatures and expired payloads', async () => {
    const token = await signSession(
      {
        accountId: 'acct_default',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      'secret',
    );

    await expect(verifySession(token, 'wrong-secret')).resolves.toBeNull();
    await expect(verifySession(token, 'secret')).resolves.toBeNull();
    await expect(verifySession('bad.token', 'secret')).resolves.toBeNull();
  });
});
