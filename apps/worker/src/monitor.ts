import { connect as tlsConnect } from 'node:tls';
import type { AgentCheckResult, CheckConfig } from '@clawping/shared';

async function runHttpCheck(check: CheckConfig): Promise<AgentCheckResult> {
  const response = await fetch(check.target!, { redirect: 'follow' });
  const ok = check.expectedStatus ? response.status === check.expectedStatus : response.ok;
  return {
    key: check.id,
    name: check.name,
    type: 'http',
    source: 'cloud',
    status: ok ? 'ok' : 'critical',
    message: ok ? `HTTP ${response.status}` : `Expected ${check.expectedStatus ?? '2xx'}, got ${response.status}`,
    value: response.status,
    unit: 'status_code',
    observedAt: new Date().toISOString(),
    metadata: { target: check.target },
  };
}

async function runDnsCheck(check: CheckConfig): Promise<AgentCheckResult> {
  const target = check.target ?? '';
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', target);
  url.searchParams.set('type', 'A');
  const response = await fetch(url.toString(), {
    headers: { accept: 'application/dns-json' },
  });
  const payload = (await response.json()) as { Answer?: Array<{ data: string }> };
  const answers = payload.Answer ?? [];
  return {
    key: check.id,
    name: check.name,
    type: 'dns',
    source: 'cloud',
    status: answers.length > 0 ? 'ok' : 'critical',
    message: answers.length > 0 ? `Resolved ${answers[0].data}` : 'No DNS answer returned',
    observedAt: new Date().toISOString(),
    metadata: { target, answers },
  };
}

async function runTlsExpiryCheck(check: CheckConfig): Promise<AgentCheckResult> {
  const targetUrl = new URL(check.target!);
  const cert = await new Promise<{ valid_to?: string; subject?: Record<string, unknown> }>((resolve, reject) => {
    const socket = tlsConnect(
      {
        host: targetUrl.hostname,
        port: Number(targetUrl.port || 443),
        servername: targetUrl.hostname,
      },
      () => {
        resolve(socket.getPeerCertificate());
        socket.end();
      },
    );
    socket.setTimeout(10_000, () => socket.destroy(new Error('TLS timeout')));
    socket.on('error', reject);
  });

  if (!cert.valid_to) {
    return {
      key: check.id,
      name: check.name,
      type: 'tls_expiry',
      source: 'cloud',
      status: 'critical',
      message: 'Unable to read certificate expiry',
      observedAt: new Date().toISOString(),
      metadata: { target: check.target },
    };
  }

  const expiresAt = new Date(cert.valid_to);
  const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
  return {
    key: check.id,
    name: check.name,
    type: 'tls_expiry',
    source: 'cloud',
    status: daysRemaining <= 7 ? 'critical' : daysRemaining <= 21 ? 'warning' : 'ok',
    message: `TLS certificate expires in ${daysRemaining} day(s)`,
    value: daysRemaining,
    unit: 'days',
    observedAt: new Date().toISOString(),
    metadata: { target: check.target, expiresAt: expiresAt.toISOString(), subject: cert.subject ?? null },
  };
}

export async function runCloudCheck(check: CheckConfig): Promise<AgentCheckResult> {
  if (check.type === 'dns') {
    return runDnsCheck(check);
  }
  if (check.type === 'tls_expiry') {
    return runTlsExpiryCheck(check);
  }
  return runHttpCheck(check);
}
