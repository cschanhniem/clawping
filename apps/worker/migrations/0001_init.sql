CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hostname TEXT,
  platform TEXT,
  token_hash TEXT,
  registration_token_hash TEXT,
  last_heartbeat_at TEXT,
  last_seen_at TEXT,
  heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 60,
  missed_heartbeat_threshold_seconds INTEGER NOT NULL DEFAULT 300,
  agent_version TEXT,
  muted_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_devices_account ON devices(account_id);
CREATE INDEX IF NOT EXISTS idx_devices_token_hash ON devices(token_hash);
CREATE INDEX IF NOT EXISTS idx_devices_registration_token_hash ON devices(registration_token_hash);

CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  target TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  warning_threshold REAL,
  critical_threshold REAL,
  expected_status INTEGER,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_checks_device ON checks(device_id);
CREATE INDEX IF NOT EXISTS idx_checks_source ON checks(source);

CREATE TABLE IF NOT EXISTS check_results (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL,
  device_id TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  value_text TEXT,
  value_number REAL,
  unit TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  observed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (check_id) REFERENCES checks(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_check_results_check_observed ON check_results(check_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT,
  check_id TEXT,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  opened_at TEXT NOT NULL,
  recovered_at TEXT,
  muted_until TEXT,
  last_notification_at TEXT,
  notification_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (check_id) REFERENCES checks(id)
);

CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(account_id, recovered_at);

CREATE TABLE IF NOT EXISTS telegram_channels (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_type TEXT,
  title TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_channels_account_chat ON telegram_channels(account_id, chat_id);
