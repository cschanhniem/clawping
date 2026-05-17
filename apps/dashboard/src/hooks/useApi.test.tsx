import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsyncData } from './useApi';

describe('useAsyncData', () => {
  it('loads async data', async () => {
    const loader = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useAsyncData(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('ok');
  });

  it('captures async errors and supports reloads', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncData(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');

    loader.mockResolvedValueOnce('fresh data');
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe('fresh data');
  });

  it('normalizes non-Error failures', async () => {
    const loader = vi.fn().mockRejectedValue('boom');
    const { result } = renderHook(() => useAsyncData(loader, []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Unknown error');
  });
});
