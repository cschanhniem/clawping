import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export interface DashboardOverview {
  devicesOnline: number;
  devicesOffline: number;
  warnings: number;
  critical: number;
  activeIncidents: number;
  lastSweepAt: string | null;
}

export async function login(password: string) {
  const { data } = await api.post('/auth/login', { password });
  return data;
}

export async function logout() {
  const { data } = await api.post('/auth/logout');
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function getOverview() {
  const { data } = await api.get<{ ok: boolean; overview: DashboardOverview }>('/dashboard/overview');
  return data.overview;
}

export async function getDevices() {
  const { data } = await api.get('/dashboard/devices');
  return data.devices as Array<Record<string, unknown>>;
}

export async function getChecks() {
  const { data } = await api.get('/dashboard/checks');
  return data.checks as Array<Record<string, unknown>>;
}

export async function getIncidents() {
  const { data } = await api.get('/dashboard/incidents');
  return data.incidents as Array<Record<string, unknown>>;
}

export async function createDevice(payload: {
  name: string;
  heartbeatIntervalSeconds?: number;
  missedHeartbeatThresholdSeconds?: number;
}) {
  const { data } = await api.post('/dashboard/devices', payload);
  return data;
}

export async function createCheck(payload: Record<string, unknown>) {
  const { data } = await api.post('/dashboard/checks', payload);
  return data;
}

export default api;
