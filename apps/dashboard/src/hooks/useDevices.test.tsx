import { renderHook, waitFor } from '@testing-library/react';
import { useDevices } from './useDevices';

vi.mock('../lib/api', () => ({
  getDevices: vi.fn().mockResolvedValue([{ id: '1', name: 'home-mini-pc' }]),
}));

describe('useDevices', () => {
  it('loads device data', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: '1', name: 'home-mini-pc' }]);
  });
});
