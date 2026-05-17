import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEnv } from '../__tests__/helpers';
import { processAlertBatch } from './alert-queue';

describe('alert queue', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response('{}', { status: 200 }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('acks messages on success and mute', async () => {
    const env = createMockEnv();
    const ack = vi.fn();
    const retry = vi.fn();
    await processAlertBatch(
      {
        messages: [{ body: { chatId: '1', text: 'hello' }, ack, retry }],
      } as never,
      env as never,
    );
    expect(ack).toHaveBeenCalled();

    env.KV.store.set('mute:account', new Date(Date.now() + 60_000).toISOString());
    await processAlertBatch(
      {
        messages: [{ body: { chatId: '1', text: 'hello' }, ack, retry }],
      } as never,
      env as never,
    );
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it('retries messages on failure', async () => {
    const env = createMockEnv();
    const ack = vi.fn();
    const retry = vi.fn();
    global.fetch = vi.fn(async () => new Response('{}', { status: 500 }));

    await processAlertBatch(
      {
        messages: [{ body: { chatId: '1', text: 'hello' }, ack, retry }],
      } as never,
      env as never,
    );

    expect(retry).toHaveBeenCalled();
  });
});
