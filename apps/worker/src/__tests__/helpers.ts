import { vi } from 'vitest';

export function createMockKV(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

export function createMockStatement(config: {
  first?: unknown;
  all?: unknown[];
  run?: unknown;
  onRun?: (args: unknown[]) => void | Promise<void>;
}) {
  let boundArgs: unknown[] = [];
  return {
    bind: (...args: unknown[]) => {
      boundArgs = args;
      return {
        first: async () => config.first ?? null,
        all: async () => ({ results: config.all ?? [] }),
        run: async () => {
          await config.onRun?.(boundArgs);
          return config.run ?? {};
        },
      };
    },
    first: async () => config.first ?? null,
    all: async () => ({ results: config.all ?? [] }),
    run: async () => config.run ?? {},
  };
}

export function createMockDB(
  matcher: (sql: string) => ReturnType<typeof createMockStatement>,
) {
  return {
    prepare: vi.fn((sql: string) => matcher(sql)),
  };
}

export function createMockDeviceState(send = true) {
  const fetch = vi.fn(async (url: string) => {
    if (url.includes('/should-alert')) {
      return Response.json({ send });
    }
    return Response.json({ ok: true });
  });
  return {
    idFromName: vi.fn((name: string) => name),
    get: vi.fn(() => ({ fetch })),
    fetch,
  };
}

export function createMockEnv(overrides: Record<string, unknown> = {}) {
  const kv = createMockKV();
  const deviceState = createMockDeviceState(true);
  const sent: Array<{ chatId: string; text: string }> = [];
  const env = {
    DB: createMockDB(() => createMockStatement({})),
    KV: kv,
    ALERT_QUEUE: {
      send: vi.fn(async (message: { chatId: string; text: string }) => {
        sent.push(message);
      }),
    },
    DEVICE_STATE: deviceState,
    APP_BASE_URL: 'https://clawping.test',
    ADMIN_PASSWORD: 'secret',
    SESSION_SECRET: 'session-secret',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    __sent: sent,
    ...overrides,
  };

  return env;
}
