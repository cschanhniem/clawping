import { describe, expect, it } from 'vitest';
import { DeviceState } from './device-state';

function createState() {
  const storage = new Map<string, unknown>();
  return {
    storageMap: storage,
    storage: {
      get: async (key: string) => storage.get(key),
      put: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
    },
  };
}

describe('device state durable object', () => {
  it('returns alert decisions and mute state', async () => {
    const state = new DeviceState(createState() as never, {} as never);
    const shouldAlert = await state.fetch(new Request('https://device-state/should-alert'));
    expect(await shouldAlert.json()).toEqual({ send: true, reason: 'new_incident' });
    const shouldRecover = await state.fetch(new Request('https://device-state/should-alert?recover=1'));
    expect(await shouldRecover.json()).toEqual({ send: false });

    await state.fetch(
      new Request('https://device-state/mute', {
        method: 'POST',
        body: JSON.stringify({ mutedUntil: new Date(Date.now() + 60_000).toISOString() }),
      }),
    );
    const muted = await state.fetch(new Request('https://device-state/should-alert'));
    const mutedBody = (await muted.json()) as { send: boolean; mutedUntil: string };
    expect(mutedBody.send).toBe(false);
  });

  it('marks open and recovers incidents', async () => {
    const state = new DeviceState(createState() as never, {} as never);
    await state.fetch(new Request('https://device-state/mark-open'));
    const recoveryDecision = await state.fetch(new Request('https://device-state/should-alert?recover=1'));
    const recoveryBody = (await recoveryDecision.json()) as { send: boolean };
    expect(recoveryBody.send).toBe(true);
    const recovered = await state.fetch(new Request('https://device-state/recover'));
    const recoveredBody = (await recovered.json()) as { incidentOpen: boolean };
    expect(recoveredBody.incidentOpen).toBe(false);
  });

  it('handles reminder logic and returns raw state for unknown paths', async () => {
    const ctx = createState();
    const state = new DeviceState(ctx as never, {} as never);

    ctx.storageMap.set('state', {
      incidentOpen: true,
      lastNotificationAt: null,
      mutedUntil: null,
    });
    expect(await (await state.fetch(new Request('https://device-state/should-alert'))).json()).toEqual({
      send: true,
      reason: 'missing_notification_marker',
    });

    ctx.storageMap.set('state', {
      incidentOpen: true,
      lastNotificationAt: new Date().toISOString(),
      mutedUntil: null,
    });
    expect(await (await state.fetch(new Request('https://device-state/should-alert'))).json()).toEqual({
      send: false,
      reason: 'reminder',
    });

    ctx.storageMap.set('state', {
      incidentOpen: true,
      lastNotificationAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      mutedUntil: null,
    });
    expect(await (await state.fetch(new Request('https://device-state/should-alert'))).json()).toEqual({
      send: true,
      reason: 'reminder',
    });

    ctx.storageMap.set('state', {
      incidentOpen: true,
      lastNotificationAt: new Date(0).toISOString(),
      mutedUntil: null,
    });
    expect(await (await state.fetch(new Request('https://device-state/should-alert'))).json()).toEqual({
      send: false,
      reason: 'reminder',
    });

    expect(await (await state.fetch(new Request('https://device-state/state'))).json()).toMatchObject({
      incidentOpen: true,
    });
  });
});
