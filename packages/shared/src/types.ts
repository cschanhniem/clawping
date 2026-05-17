export type CheckStatus = 'ok' | 'warning' | 'critical' | 'unknown' | 'muted';
export type CheckSource = 'agent' | 'cloud';
export type CheckType =
  | 'heartbeat'
  | 'http'
  | 'disk'
  | 'backup_freshness'
  | 'docker_container'
  | 'memory'
  | 'cpu'
  | 'dns'
  | 'tls_expiry';

export interface AgentCheckResult {
  key: string;
  name: string;
  type: CheckType;
  source: CheckSource;
  status: CheckStatus;
  message: string;
  value?: number | string;
  unit?: string;
  observedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentHeartbeatPayload {
  deviceId: string;
  agentVersion: string;
  hostname: string;
  timestamp: string;
  uptimeSeconds: number;
  checks: AgentCheckResult[];
}

export interface CheckConfig {
  id: string;
  accountId: string;
  deviceId: string | null;
  source: CheckSource;
  type: CheckType;
  name: string;
  target: string | null;
  configJson: string;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  expectedStatus: number | null;
  intervalSeconds: number;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  id: string;
  accountId: string;
  name: string;
  hostname: string | null;
  platform: string | null;
  tokenHash: string | null;
  registrationTokenHash: string | null;
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  missedHeartbeatThresholdSeconds: number;
  heartbeatIntervalSeconds: number;
  agentVersion: string | null;
  mutedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentRecord {
  id: string;
  accountId: string;
  deviceId: string | null;
  checkId: string | null;
  status: CheckStatus;
  title: string;
  message: string | null;
  openedAt: string;
  recoveredAt: string | null;
  mutedUntil: string | null;
  lastNotificationAt: string | null;
  notificationCount: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
  };
}

export interface DashboardOverview {
  devicesOnline: number;
  devicesOffline: number;
  warnings: number;
  critical: number;
  activeIncidents: number;
  lastSweepAt: string | null;
}

export interface SessionPayload {
  accountId: string;
  role: 'admin';
  exp: number;
}
