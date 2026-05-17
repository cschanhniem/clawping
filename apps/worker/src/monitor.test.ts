import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckConfig } from '@clawping/shared';

let certificate: { valid_to?: string; subject?: Record<string, unknown> } = {
  valid_to: new Date(Date.now() + 30 * 86_400_000).toUTCString(),
  subject: { CN: 'example.com' },
};

vi.mock('node:tls', () => ({
  connect: vi.fn((_options: unknown, onConnect: () => void) => {
    setImmediate(onConnect);
    const socket = {
      getPeerCertificate: () => certificate,
      end: () => undefined,
      setTimeout: () => undefined,
      on: () => undefined,
      destroy: () => undefined,
    };
    return socket;
  }),
  default: {
    connect: vi.fn((_options: unknown, onConnect: () => void) => {
      setImmediate(onConnect);
      const socket = {
        getPeerCertificate: () => certificate,
        end: () => undefined,
        setTimeout: () => undefined,
        on: () => undefined,
        destroy: () => undefined,
      };
      return socket;
    }),
  },
}));

describe('cloud monitor checks', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    certificate = {
      valid_to: new Date(Date.now() + 30 * 86_400_000).toUTCString(),
      subject: { CN: 'example.com' },
    };
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('dns-query')) {
        return new Response(JSON.stringify({ Answer: [{ data: '1.2.3.4' }] }), { status: 200 });
      }
      return new Response('ok', { status: 200 });
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('runs http, dns and tls checks across healthy paths', async () => {
    const { runCloudCheck } = await import('./monitor');
    const httpCheck = {
      id: 'chk_1',
      accountId: 'acct_default',
      deviceId: null,
      source: 'cloud',
      type: 'http',
      name: 'Homepage',
      target: 'https://example.com',
      configJson: '{}',
      warningThreshold: null,
      criticalThreshold: null,
      expectedStatus: 200,
      intervalSeconds: 60,
      enabled: 1,
      createdAt: '',
      updatedAt: '',
    } satisfies CheckConfig;

    expect((await runCloudCheck(httpCheck)).status).toBe('ok');
    expect((await runCloudCheck({ ...httpCheck, type: 'dns', target: 'example.com' })).status).toBe('ok');
    expect((await runCloudCheck({ ...httpCheck, type: 'tls_expiry' })).status).toBe('ok');
  });

  it('reports degraded cloud checks when responses fail expectations', async () => {
    const { runCloudCheck } = await import('./monitor');
    const baseCheck = {
      id: 'chk_1',
      accountId: 'acct_default',
      deviceId: null,
      source: 'cloud',
      type: 'http',
      name: 'Homepage',
      target: 'https://example.com',
      configJson: '{}',
      warningThreshold: null,
      criticalThreshold: null,
      expectedStatus: null,
      intervalSeconds: 60,
      enabled: 1,
      createdAt: '',
      updatedAt: '',
    } satisfies CheckConfig;

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('dns-query')) {
        return new Response(JSON.stringify({ Answer: [] }), { status: 200 });
      }
      return new Response('bad', { status: 500 });
    });

    const defaultHttp = await runCloudCheck(baseCheck);
    expect(defaultHttp.status).toBe('critical');
    expect(defaultHttp.message).toContain('Expected 2xx');

    const expectedHttp = await runCloudCheck({ ...baseCheck, expectedStatus: 204 });
    expect(expectedHttp.status).toBe('critical');
    expect(expectedHttp.message).toContain('Expected 204');

    const dns = await runCloudCheck({ ...baseCheck, type: 'dns', target: 'example.com' });
    expect(dns.status).toBe('critical');
    expect(dns.message).toContain('No DNS answer');

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('dns-query')) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response('bad', { status: 500 });
    });

    const dnsWithDefaultTarget = await runCloudCheck({ ...baseCheck, type: 'dns', target: null });
    expect(dnsWithDefaultTarget.metadata?.target).toBe('');
  });

  it('covers TLS expiry warning, critical, and invalid certificate branches', async () => {
    const { runCloudCheck } = await import('./monitor');
    const check = {
      id: 'chk_tls',
      accountId: 'acct_default',
      deviceId: null,
      source: 'cloud',
      type: 'tls_expiry',
      name: 'TLS',
      target: 'https://example.com',
      configJson: '{}',
      warningThreshold: null,
      criticalThreshold: null,
      expectedStatus: null,
      intervalSeconds: 60,
      enabled: 1,
      createdAt: '',
      updatedAt: '',
    } satisfies CheckConfig;

    certificate = { subject: { CN: 'example.com' } };
    const invalid = await runCloudCheck(check);
    expect(invalid.status).toBe('critical');
    expect(invalid.message).toContain('Unable to read certificate expiry');

    certificate = {
      valid_to: new Date(Date.now() + 5 * 86_400_000).toUTCString(),
      subject: { CN: 'example.com' },
    };
    expect((await runCloudCheck(check)).status).toBe('critical');

    certificate = {
      valid_to: new Date(Date.now() + 15 * 86_400_000).toUTCString(),
      subject: { CN: 'example.com' },
    };
    expect((await runCloudCheck(check)).status).toBe('warning');

    certificate = {
      valid_to: new Date(Date.now() + 30 * 86_400_000).toUTCString(),
    };
    expect((await runCloudCheck(check)).metadata?.subject).toBeNull();
  });
});
