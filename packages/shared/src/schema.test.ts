import { describe, expect, it } from 'vitest';
import { parseCheckResult, parseHeartbeatPayload, parseTelegramUpdate } from './schema';

describe('shared schema helpers', () => {
  it('parses a valid heartbeat payload', () => {
    const payload = parseHeartbeatPayload({
      deviceId: 'dev_1',
      agentVersion: '0.1.0',
      hostname: 'home-mini-pc',
      timestamp: '2026-05-17T10:00:00Z',
      uptimeSeconds: 120,
      checks: [
        {
          key: 'system.online',
          name: 'Agent Heartbeat',
          type: 'heartbeat',
          source: 'agent',
          status: 'ok',
          message: 'Agent heartbeat received',
        },
      ],
    });

    expect(payload.deviceId).toBe('dev_1');
    expect(payload.checks).toHaveLength(1);
  });

  it('parses a valid check result', () => {
    const result = parseCheckResult({
      key: 'disk',
      name: 'Root Disk',
      type: 'disk',
      source: 'agent',
      status: 'warning',
      message: '/ is 82% full',
      value: 82,
      unit: 'percent',
      metadata: { path: '/' },
    });

    expect(result.value).toBe(82);
    expect(result.metadata?.path).toBe('/');
  });

  it('fills default check fields when optional values are missing', () => {
    const result = parseCheckResult({
      key: 'heartbeat',
      name: 'Heartbeat',
      type: 'heartbeat',
      status: 'ok',
      message: 'received',
      observedAt: 123,
      metadata: 'invalid',
    });

    expect(result.source).toBe('agent');
    expect(result.observedAt).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it('preserves explicit observedAt strings', () => {
    const result = parseCheckResult({
      key: 'heartbeat',
      name: 'Heartbeat',
      type: 'heartbeat',
      source: 'agent',
      status: 'ok',
      message: 'received',
      observedAt: '2026-05-17T10:00:00Z',
    });

    expect(result.observedAt).toBe('2026-05-17T10:00:00Z');
  });

  it('parses a valid Telegram update', () => {
    const update = parseTelegramUpdate({
      update_id: 10,
      message: {
        message_id: 20,
        date: 123,
        text: '/start',
        chat: { id: 1, type: 'private' },
      },
    });

    expect(update.update_id).toBe(10);
    expect(update.message?.text).toBe('/start');
  });

  it('rejects invalid payloads', () => {
    expect(() => parseHeartbeatPayload(null)).toThrow();
    expect(() =>
      parseHeartbeatPayload({
        deviceId: 'dev',
        agentVersion: '0.1.0',
        hostname: 'host',
        timestamp: 'bad',
        uptimeSeconds: 123,
        checks: {},
      }),
    ).toThrow('Heartbeat payload must include checks');
    expect(() =>
      parseHeartbeatPayload({
        deviceId: 'dev',
        agentVersion: '0.1.0',
        hostname: 'host',
        timestamp: 'bad',
        uptimeSeconds: '123',
        checks: [],
      }),
    ).toThrow();
    expect(() =>
      parseCheckResult({
        key: '',
        name: 'Empty key',
        type: 'http',
        source: 'agent',
        status: 'ok',
        message: 'bad',
      }),
    ).toThrow('Invalid check key');
    expect(() => parseCheckResult('bad')).toThrow();
    expect(() => parseTelegramUpdate(null)).toThrow('Telegram payload must be an object');
    expect(() => parseTelegramUpdate({})).toThrow();
  });
});
