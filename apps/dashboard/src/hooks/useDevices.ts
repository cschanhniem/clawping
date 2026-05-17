import { getDevices } from '../lib/api';
import { useAsyncData } from './useApi';

export function useDevices() {
  return useAsyncData(getDevices, []);
}
