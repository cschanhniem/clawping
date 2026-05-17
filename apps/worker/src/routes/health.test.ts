import { describe, expect, it } from 'vitest';
import { handleHealth } from './health';

describe('health route', () => {
  it('returns health payload', async () => {
    const response = handleHealth();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('clawping-worker');
  });
});
