import { describe, expect, it } from 'vitest';
import { installScript } from './install';
import { createMockEnv } from '../__tests__/helpers';

describe('install route', () => {
  it('returns install shell script', async () => {
    const env = createMockEnv();
    const response = installScript(new Request('https://clawping.test/install.sh'), env as never);
    const text = await response.text();
    expect(text).toContain('agent.yaml');
    expect(text).toContain('Registration token');
  });
});
