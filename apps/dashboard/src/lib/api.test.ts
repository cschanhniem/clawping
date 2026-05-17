import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
    }),
  },
}));

describe('dashboard api client', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('calls auth endpoints', async () => {
    const api = await import('./api');
    mockPost.mockResolvedValueOnce({ data: { ok: true } });
    expect(await api.login('secret')).toEqual({ ok: true });

    mockPost.mockResolvedValueOnce({ data: { ok: true } });
    expect(await api.logout()).toEqual({ ok: true });

    mockGet.mockResolvedValueOnce({ data: { ok: true } });
    expect(await api.getMe()).toEqual({ ok: true });
  });

  it('calls dashboard endpoints', async () => {
    const api = await import('./api');
    mockGet.mockResolvedValueOnce({ data: { overview: { devicesOnline: 1 } } });
    expect(await api.getOverview()).toEqual({ devicesOnline: 1 });

    mockGet.mockResolvedValueOnce({ data: { devices: [{ id: '1' }] } });
    expect(await api.getDevices()).toEqual([{ id: '1' }]);

    mockGet.mockResolvedValueOnce({ data: { checks: [{ id: '2' }] } });
    expect(await api.getChecks()).toEqual([{ id: '2' }]);

    mockGet.mockResolvedValueOnce({ data: { incidents: [{ id: '3' }] } });
    expect(await api.getIncidents()).toEqual([{ id: '3' }]);

    mockPost.mockResolvedValueOnce({ data: { ok: true, installCommand: 'x' } });
    expect(await api.createDevice({ name: 'home-mini-pc' })).toEqual({ ok: true, installCommand: 'x' });

    mockPost.mockResolvedValueOnce({ data: { ok: true } });
    expect(await api.createCheck({ name: 'Homepage' })).toEqual({ ok: true });
  });
});
