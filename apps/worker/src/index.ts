import { DeviceState } from './durable-objects/device-state';
import { handleDashboardRequest } from './routes/dashboard-api';
import { receiveHeartbeat, registerAgent } from './routes/agents';
import { login, logout, me } from './routes/auth';
import { runScheduledChecks, sweepMissedHeartbeats } from './routes/checks';
import { handleHealth } from './routes/health';
import { installScript } from './routes/install';
import { telegramWebhook } from './routes/telegram';
import { processAlertBatch } from './queues/alert-queue';
import { ensureAdminPassword, json } from './util';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ALERT_QUEUE: Queue<{ chatId: string; text: string }>;
  DEVICE_STATE: DurableObjectNamespace<DeviceState>;
  APP_BASE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  HEARTBEAT_WARNING_SECONDS?: string;
  HEARTBEAT_CRITICAL_SECONDS?: string;
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(
        `ClawPing worker is running.\nHealth: ${new URL('/api/health', request.url).toString()}\n`,
        { headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return handleHealth();
    }

    if (request.method === 'GET' && url.pathname === '/install.sh') {
      return installScript(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      await ensureAdminPassword(env);
      return login(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return logout();
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      return me(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/telegram/webhook') {
      return telegramWebhook(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/agent/register') {
      return registerAgent(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/agent/heartbeat') {
      return receiveHeartbeat(request, env);
    }

    if (url.pathname.startsWith('/api/dashboard/')) {
      return handleDashboardRequest(request, env);
    }

    return json({ ok: false, error: 'Not found' }, 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledChecks(env));
    ctx.waitUntil(sweepMissedHeartbeats(env));
  },

  async queue(batch, env) {
    await processAlertBatch(batch as MessageBatch<{ chatId: string; text: string }>, env);
  },
};

export { DeviceState };
export default worker;
