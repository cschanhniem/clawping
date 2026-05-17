import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';

vi.mock('../lib/api', () => ({
  getMe: vi.fn(),
  login: vi.fn().mockResolvedValue({ ok: true }),
  logout: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('useAuth', () => {
  it('loads authenticated session', async () => {
    const api = await import('../lib/api');
    vi.mocked(api.getMe).mockResolvedValueOnce({ ok: true } as never);
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.authenticated).toBe(true);
  });

  it('handles login and logout', async () => {
    const api = await import('../lib/api');
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error('unauthorized'));
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('secret');
    });
    await waitFor(() => expect(result.current.authenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });
    await waitFor(() => expect(result.current.authenticated).toBe(false));
  });

  it('surfaces login failures with a fallback message', async () => {
    const api = await import('../lib/api');
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error('unauthorized'));
    vi.mocked(api.login).mockRejectedValueOnce('bad credentials');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('secret').catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).toBe('Login failed'));
    expect(result.current.authenticated).toBe(false);
  });

  it('surfaces login failures from Error instances', async () => {
    const api = await import('../lib/api');
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error('unauthorized'));
    vi.mocked(api.login).mockRejectedValueOnce(new Error('Wrong password'));
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('secret').catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error).toBe('Wrong password'));
    expect(result.current.authenticated).toBe(false);
  });
});
