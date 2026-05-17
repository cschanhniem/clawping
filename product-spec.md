# ClawPing Product Spec — Cloudflare Workers-First

Version: 1.0  
Date: 2026-05-17  
Product: ClawPing  
Primary architecture: Cloudflare Workers ecosystem first, lightweight home-server agent second

---

## 0. One-line definition

**ClawPing is a Cloudflare Workers-first, Telegram-first watchdog for home servers, mini PCs, NAS boxes, and self-hosted apps. It runs the control plane on Cloudflare, while local machines send outbound heartbeats and health reports without requiring a public IP.**

---

## 1. Executive summary

The original Docker-first version of ClawPing was conceptually simple but strategically less sharp: it looked too close to “another Uptime Kuma fork.”

The better architecture is:

> **Cloudflare Workers hosts the public control plane, Telegram bot, dashboard, scheduler, database, and alert logic. A tiny local agent runs on the user’s mini PC/NAS/home server and pushes health data outward.**

This changes the product from:

> “Install another monitoring dashboard on your server.”

to:

> “Your home server checks in with a lightweight cloud watchdog and messages you on Telegram when it stops behaving.”

This is stronger because many home-server users do not expose public IPs, do not want to maintain another full app, and do not want monitoring to fail when the monitored machine itself is down.

---

## 2. Key architectural correction

### 2.1 The mistake to avoid

A pure Cloudflare Workers app **cannot directly monitor private LAN services** such as:

- `http://192.168.1.20:2283`
- `http://homeassistant.local:8123`
- Docker containers on a private mini PC
- local disk usage
- local backup files
- NAS filesystem health

Cloudflare Workers runs outside the user’s LAN. It cannot magically reach private addresses unless the user exposes them via tunnel, public DNS, VPN, or a local agent.

Therefore, ClawPing must not promise:

> “Cloudflare Workers monitors your private home server directly.”

That is false.

### 2.2 Correct model

ClawPing should use a **push/agent model**.

```text
Home server / mini PC / NAS
        |
        | outbound HTTPS heartbeat
        v
Cloudflare Worker API
        |
        | stores state
        v
D1 / Durable Objects / KV
        |
        | alert evaluation
        v
Telegram Bot
```

The local agent performs checks from inside the user’s network, then sends results to Cloudflare.

This allows:

- no public IP
- no open inbound port
- no self-hosted dashboard required
- monitoring still visible remotely
- Telegram alerts from Cloudflare
- central status page/dashboard
- low maintenance

---

## 3. Product thesis

Most home-server monitoring products assume the user wants to host the monitor themselves.

ClawPing’s sharper thesis:

> **The monitored machine should not be the only place where monitoring truth lives.**

If the mini PC dies completely, a Docker-hosted monitor on that same mini PC may die too. A Cloudflare-hosted control plane can notice missed heartbeats.

The non-obvious insight:

> For home servers, “is the machine still checking in?” is often more valuable than “can an external uptime service reach port 443?”

---

## 4. Target users

### 4.1 Primary user: home-server operator

Runs:

- mini PC
- Mac mini
- old laptop
- Synology/QNAP NAS
- Unraid box
- Proxmox host
- Raspberry Pi
- home Docker server

Wants alerts for:

- machine offline
- Docker app down
- disk full
- backup stale
- local web app not responding
- network unreachable
- high memory/CPU
- Tailscale/WireGuard issue
- NAS storage issue

Does not want:

- public IP
- exposed ports
- enterprise observability
- Prometheus/Grafana setup
- another fragile dashboard hosted on the same box

### 4.2 Secondary user: OpenClaw-style user

Cares about:

- open-source
- Telegram workflows
- self-hostable components
- low-maintenance infra
- local-first privacy
- Cloudflare-native deployment

### 4.3 Tertiary user: small office operator

Runs:

- local server
- file share
- backup drive
- office router
- NAS
- camera/NVR system

Wants simple alerts without enterprise monitoring.

---

## 5. Positioning

### 5.1 Recommended headline

```text
Telegram-first watchdog for home servers — powered by Cloudflare Workers.
```

### 5.2 Stronger subheadline

```text
ClawPing watches your mini PC, NAS, Docker apps, disk space, and backups through a tiny outbound agent. No public IP. No open ports. Telegram alerts when something breaks.
```

### 5.3 Short tagline

```text
Your home server checks in. Telegram tells you when it doesn't.
```

### 5.4 Avoided positioning

Avoid:

```text
Uptime Kuma fork on Cloudflare
```

Avoid:

```text
Cloud-native observability platform
```

Avoid:

```text
AI-powered monitoring
```

Avoid:

```text
Enterprise-grade uptime system
```

These either undersell the product or make it sound fake.

---

## 6. Product architecture

## 6.1 Cloudflare-first architecture

Core Cloudflare services:

| Component | Cloudflare product | Purpose |
|---|---|---|
| Public API | Workers | Receive heartbeats, serve dashboard API, Telegram webhook |
| Dashboard | Workers / Pages | User-facing web UI |
| Database | D1 | Users, devices, monitors, incidents, check history |
| Coordination | Durable Objects | Per-device or per-user state, deduplication, alert state machine |
| Scheduler | Cron Triggers | Sweep missed heartbeats, run cloud-side checks |
| Async jobs | Queues | Fan out alerts, process check batches, avoid blocking request path |
| Config/cache | KV | Low-frequency config, invite codes, public status cache |
| Artifacts/logs | R2 | Optional longer-term logs, exports, screenshots later |
| Secrets | Worker secrets | Telegram bot token, signing secrets, encryption keys |
| Static UI | Pages or Worker Assets | Dashboard frontend |

### 6.2 Local components

ClawPing Agent:

- tiny binary/script/container running on home server
- performs local checks
- sends outbound HTTPS payloads to Worker
- does not require inbound access
- should be optional per device
- can run via systemd, launchd, Docker, Homebrew, Synology Task Scheduler, or cron

### 6.3 High-level diagram

```text
┌────────────────────────────────────────────┐
│ User home network                           │
│                                            │
│  Mini PC / NAS / Mac mini                  │
│  ┌──────────────────────────────────────┐  │
│  │ ClawPing Agent                       │  │
│  │ - HTTP local checks                  │  │
│  │ - Docker checks                      │  │
│  │ - Disk checks                        │  │
│  │ - Backup freshness                   │  │
│  │ - System heartbeat                   │  │
│  └──────────────────────────────────────┘  │
│                │ outbound HTTPS             │
└────────────────┼────────────────────────────┘
                 v
┌────────────────────────────────────────────┐
│ Cloudflare                                  │
│                                            │
│  Worker API                                │
│  Durable Objects                           │
│  D1 database                               │
│  Queues                                    │
│  Cron Triggers                             │
│  Pages / Worker dashboard                  │
└────────────────┬───────────────────────────┘
                 v
┌────────────────────────────────────────────┐
│ Telegram                                   │
│                                            │
│  Alerts                                    │
│  /status                                   │
│  /mute                                     │
│  /checks                                   │
└────────────────────────────────────────────┘
```

---

## 7. Why Cloudflare-first is strategically better

## 7.1 Better failure model

Docker-first monitoring has a serious weakness:

> If the box dies, the monitor may die with it.

Cloudflare-first solves this by making missed heartbeat detection external.

### Example

Agent sends heartbeat every 60 seconds.

If Cloudflare has not received heartbeat for 5 minutes:

```text
❌ home-mini-pc stopped checking in

Last heartbeat:
5 minutes ago

Likely causes:
• machine powered off
• network down
• agent stopped
• DNS/ISP issue
• firewall blocking outbound HTTPS
```

This is the core product moment.

## 7.2 Better onboarding

A full Docker app install is too heavy for some users.

Cloudflare-first can support:

- hosted ClawPing for normal users
- self-deployed Cloudflare stack for power users
- one-line local agent install

## 7.3 Better Telegram bot

Telegram webhook fits naturally with Workers.

The Worker receives Telegram updates and responds without running a server.

## 7.4 Better remote access

User can check dashboard from anywhere without exposing home network.

## 7.5 Better status history

Cloud-side state persists even when home machine is offline.

---

## 8. Deployment models

ClawPing should support three deployment modes.

---

## 8.1 Mode A — Hosted ClawPing Cloud

This is the easiest user experience.

```text
User creates account at clawping.app
Installs local agent
Connects Telegram
Done
```

Pros:

- fastest onboarding
- easiest for non-technical users
- best product experience
- easiest to monetize later

Cons:

- must operate service
- privacy expectations higher
- requires auth, billing later, abuse prevention

Best for:

- mainstream home-server users
- small office users

---

## 8.2 Mode B — Self-deployed Cloudflare

User deploys their own ClawPing Worker stack into their own Cloudflare account.

```text
npx create-clawping
wrangler deploy
clawping agent install
```

Pros:

- open-source credibility
- no central dependency
- aligns with technical users
- lower trust barrier

Cons:

- harder setup
- Cloudflare account required
- support burden
- migrations more complex

Best for:

- self-hosted community
- OpenClaw-style users
- privacy-sensitive users

---

## 8.3 Mode C — Hybrid

Default public hosted control plane, but local agent stays open-source and auditable.

This is likely the best commercial path.

---

## 9. MVP recommendation

### 9.1 Ship order

Do not start by cloning Uptime Kuma.

Build the Cloudflare-native wedge first:

1. Cloudflare Worker API
2. Telegram bot webhook
3. D1 schema
4. Agent registration
5. Heartbeat ingestion
6. Missed heartbeat detection
7. Simple dashboard
8. Local agent with basic checks
9. Backup freshness
10. Docker/system checks

### 9.2 Why not fork Uptime Kuma first?

A Uptime Kuma fork is optimized for a self-hosted web dashboard.

ClawPing Workers-first is a different product architecture.

Possible use of Uptime Kuma later:

- borrow monitor semantics
- compatibility/import
- optional local check engine ideas
- legal attribution if code is reused

But for MVP, a clean Workers-native implementation may be faster and strategically cleaner.

### 9.3 MVP scope

Must-have:

- Cloudflare Worker API
- Telegram bot webhook
- D1 database
- Cron sweep for missing heartbeats
- agent registration token
- local agent
- HTTP local check
- disk check
- backup freshness check
- basic Docker container check
- Telegram alert
- `/status`
- `/mute`
- web dashboard

Not MVP:

- enterprise teams
- billing
- public status pages
- SSO
- Prometheus
- Kubernetes
- log search
- AI explanations
- mobile app

---

## 10. Core product flows

---

## 10.1 First-time hosted flow

### User goal

Get Telegram alerts for home server without exposing ports.

### Flow

1. User visits ClawPing.
2. Creates account.
3. Connects Telegram.
4. Adds device: `home-mini-pc`.
5. ClawPing generates agent install command.
6. User runs command on home server.
7. Agent checks in.
8. Dashboard shows device online.
9. User adds checks:
   - disk
   - backup freshness
   - local web app
   - Docker container
10. ClawPing sends Telegram test alert.

### Success criteria

- First heartbeat received in under 5 minutes.
- User gets Telegram test alert.
- No public IP required.
- No inbound firewall rule required.

---

## 10.2 Self-deployed Cloudflare flow

### User goal

Run ClawPing in their own Cloudflare account.

### Flow

1. User clones repo or runs scaffold command.
2. Creates D1 database.
3. Creates KV namespace.
4. Creates Queue.
5. Configures Durable Object binding.
6. Sets Telegram bot secret.
7. Deploys Worker with Wrangler.
8. Opens dashboard.
9. Creates admin account.
10. Installs local agent.
11. Receives first Telegram test alert.

### Recommended command target

```bash
npx create-clawping@latest
```

Then:

```bash
cd clawping
pnpm install
pnpm clawping setup
pnpm deploy
```

The setup script should automate as much Wrangler configuration as possible.

---

## 10.3 Agent registration flow

### Hosted version

Dashboard shows:

```bash
curl -fsSL https://clawping.app/install.sh | sh -s -- \
  --token cp_live_xxxxx \
  --device home-mini-pc
```

### Self-deployed version

Dashboard shows:

```bash
curl -fsSL https://your-clawping-worker.example.com/install.sh | sh -s -- \
  --token cp_self_xxxxx \
  --device home-mini-pc
```

### Security requirement

Registration token should be:

- single-use or short-lived
- scoped to one account
- scoped to one device
- revocable

Agent receives a long-lived device credential after registration.

---

## 10.4 Heartbeat flow

Agent sends:

```http
POST /api/agent/heartbeat
Authorization: Bearer cp_device_xxxxx
Content-Type: application/json
```

Payload:

```json
{
  "deviceId": "dev_123",
  "agentVersion": "0.1.0",
  "hostname": "home-mini-pc",
  "timestamp": "2026-05-17T10:00:00Z",
  "uptimeSeconds": 38422,
  "checks": [
    {
      "key": "system.online",
      "status": "ok",
      "message": "Agent heartbeat received"
    },
    {
      "key": "disk.root",
      "status": "warning",
      "message": "/ is 83% full",
      "value": 83,
      "unit": "percent"
    }
  ]
}
```

Worker response:

```json
{
  "ok": true,
  "serverTime": "2026-05-17T10:00:01Z",
  "nextIntervalSeconds": 60,
  "configVersion": 12
}
```

---

## 10.5 Missed heartbeat flow

Cron Trigger runs every minute.

Pseudo logic:

```text
For each active device:
  if now - lastHeartbeatAt > device.missedHeartbeatThreshold:
    open incident if not already open
    enqueue Telegram alert
  else:
    recover incident if previously missing
```

Default thresholds:

```text
Heartbeat interval: 60 seconds
Warning: 3 missed heartbeats
Critical: 5 missed heartbeats
```

Alert:

```text
❌ home-mini-pc stopped checking in

Last heartbeat:
5 minutes ago

Device:
home-mini-pc

Likely causes:
• machine is off
• network is down
• ClawPing Agent stopped
• outbound HTTPS is blocked

ClawPing will notify you when it checks in again.
```

Recovery:

```text
✅ home-mini-pc is back online

Offline duration:
8 minutes

Last heartbeat:
just now
```

---

## 10.6 Telegram bot flow

### `/start`

```text
ClawPing can send alerts to this chat.

Open ClawPing dashboard and click "Connect Telegram" to finish setup.
```

### `/status`

```text
ClawPing status

✅ 2 devices online
⚠️ 1 warning
❌ 0 critical

Warnings:
• home-mini-pc: /data disk is 84% full
```

### `/checks`

```text
Checks

home-mini-pc
✅ Heartbeat
✅ Immich
✅ Home Assistant
⚠️ /data disk
✅ Backup freshness
```

### `/mute 1h`

```text
Muted all alerts for 1 hour.
```

### `/mute home-mini-pc 30m`

```text
Muted home-mini-pc alerts for 30 minutes.
```

### `/test`

```text
Test alert from ClawPing. Telegram is connected.
```

---

## 11. Feature specification

---

## 11.1 Cloud checks

Cloud-side checks run from Cloudflare, not from the user LAN.

Useful for:

- public website uptime
- public API check
- DNS check
- TLS certificate expiry
- webhook ping
- cron-style external check

MVP cloud checks:

| Check | MVP? |
|---|---:|
| HTTPS URL | Yes |
| TCP public endpoint | Maybe |
| DNS resolve | Yes |
| TLS expiry | Yes |
| Public status endpoint | Later |

Caution:

Cloudflare Workers cannot open arbitrary raw TCP sockets in the same way as a traditional server-side monitor. HTTP/S and fetch-friendly checks should be the first supported cloud checks. TCP checks may require platform-specific support or an agent.

---

## 11.2 Agent checks

Agent-side checks run from the user’s machine.

MVP agent checks:

| Check | Purpose |
|---|---|
| heartbeat | know device is alive |
| local HTTP | check local apps |
| disk usage | detect full disk |
| backup freshness | detect stale backup |
| Docker container | detect stopped/unhealthy containers |
| memory | detect pressure |
| CPU load | detect sustained overload |

Later:

| Check | Purpose |
|---|---|
| SMART disk health | early drive warnings |
| ZFS pool status | NAS/homelab users |
| UPS battery | power outage context |
| Tailscale status | remote access health |
| restic/borg/rclone parser | backup-specific success detection |
| Synology DSM adapter | NAS users |
| Proxmox adapter | VM/LXC users |

---

## 11.3 Backup freshness

This should be a hero feature.

### Problem

Most users discover backup failure only when they need the backup.

### MVP implementation

Agent checks:

- file exists
- file modified within threshold
- optional content contains success marker
- optional folder has file newer than threshold

Config example:

```yaml
checks:
  - type: backup_freshness
    name: Daily Restic Backup
    path: /backups/last-success.txt
    max_age_hours: 26
    success_contains: "backup completed"
```

Alert:

```text
❌ Backup may be stale

Device:
home-mini-pc

Check:
Daily Restic Backup

Expected:
last-success.txt updated within 26 hours

Actual:
last modified 3 days ago

Likely causes:
• backup job failed
• backup disk not mounted
• cron did not run
• credentials expired
```

Strategic reason:

Backup freshness is less commoditized than uptime checks and creates stronger emotional value.

---

## 11.4 Docker checks

Agent can inspect Docker locally.

MVP Docker checks:

- container running
- container health status
- restart count increased
- container missing
- selected containers only

Config:

```yaml
checks:
  - type: docker_container
    name: Immich
    container: immich_server
    alert_on:
      - stopped
      - unhealthy
      - restart_count_increased
```

Security note:

Docker socket access is sensitive. The agent should support Docker checks only when explicitly enabled.

---

## 11.5 Disk checks

Defaults:

```yaml
checks:
  - type: disk
    name: Root Disk
    path: /
    warning_percent: 80
    critical_percent: 90
```

Alert:

```text
⚠️ Disk warning on home-mini-pc

Disk:
/data

Usage:
84%

Threshold:
80%

Suggested checks:
• Docker logs
• media import folders
• backup snapshots
• temporary files
```

---

## 11.6 Local HTTP checks

Example:

```yaml
checks:
  - type: http
    name: Immich
    url: http://127.0.0.1:2283
    expected_status: 200
    timeout_seconds: 10
```

Agent runs this locally and reports result to Cloudflare.

---

## 12. System design

---

## 12.1 Worker routes

```http
GET  /
GET  /dashboard
GET  /api/health

POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

POST /api/telegram/webhook
POST /api/telegram/connect
POST /api/telegram/test

POST /api/devices/register
POST /api/agent/heartbeat
GET  /api/devices
GET  /api/devices/:id
PATCH /api/devices/:id
DELETE /api/devices/:id

GET  /api/checks
POST /api/checks
PATCH /api/checks/:id
DELETE /api/checks/:id

GET  /api/incidents
GET  /api/incidents/active
POST /api/incidents/:id/mute

GET  /api/config/agent/:deviceId
```

---

## 12.2 Scheduled handlers

Cron Triggers:

```toml
[triggers]
crons = ["* * * * *", "*/5 * * * *"]
```

Jobs:

Every minute:

- sweep missed heartbeats
- recover devices that returned
- enqueue alert jobs

Every 5 minutes:

- cloud-side public HTTP checks
- TLS expiry checks
- cleanup stale sessions
- rotate short-lived tokens

---

## 12.3 Queue jobs

Queue types:

```text
alert.telegram
incident.opened
incident.recovered
check.batch
email.later
```

Reason:

Do not send Telegram alerts directly in the heartbeat request path if avoidable. Ingestion should be fast and resilient.

---

## 12.4 Durable Object usage

Use Durable Objects for per-device or per-account coordination.

Good use cases:

- prevent duplicate alerts
- serialize incident state transitions
- maintain hot state per device
- debounce noisy check results
- coordinate mute windows

Suggested object IDs:

```text
account:{accountId}
device:{deviceId}
telegram-chat:{chatId}
```

Do not overuse Durable Objects for all storage. Keep durable relational data in D1.

---

## 12.5 D1 usage

Use D1 for core relational data:

- accounts
- users
- devices
- device credentials
- checks
- check results
- incidents
- notification channels
- mute rules
- audit events

---

## 12.6 KV usage

Use KV for:

- public dashboard cache
- low-sensitivity config cache
- rate limit counters if acceptable
- invite tokens with TTL
- short-lived setup state

Do not use KV as the primary source of truth for incident state because eventual consistency can create alert bugs.

---

## 13. Data model

---

## 13.1 Accounts

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 13.2 Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

For self-deployed mode, single-admin auth can be simpler.

---

## 13.3 Devices

```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  hostname TEXT,
  agent_version TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_heartbeat_at TEXT,
  heartbeat_interval_seconds INTEGER NOT NULL DEFAULT 60,
  missed_heartbeat_threshold_seconds INTEGER NOT NULL DEFAULT 300,
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

---

## 13.4 Device credentials

```sql
CREATE TABLE device_credentials (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

Never store raw device tokens.

---

## 13.5 Checks

```sql
CREATE TABLE checks (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL, -- cloud or agent
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL,
  warning_after_failures INTEGER NOT NULL DEFAULT 3,
  critical_after_failures INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

---

## 13.6 Check results

```sql
CREATE TABLE check_results (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL,
  device_id TEXT,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT,
  value REAL,
  unit TEXT,
  latency_ms INTEGER,
  observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  FOREIGN KEY (check_id) REFERENCES checks(id),
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

Retention:

- free: 7 days
- paid/hosted later: 30–90 days
- self-deployed: configurable

---

## 13.7 Incidents

```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  device_id TEXT,
  check_id TEXT,
  status TEXT NOT NULL, -- open, recovered, muted
  severity TEXT NOT NULL,
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
```

---

## 13.8 Telegram channels

```sql
CREATE TABLE telegram_channels (
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
```

---

## 14. Local agent specification

---

## 14.1 Agent principles

The agent should be:

- tiny
- boring
- auditable
- low CPU
- low memory
- outbound-only
- config-file based
- safe by default
- easy to uninstall

## 14.2 Agent language

Recommended options:

### Option A: Go

Pros:

- single static binary
- good cross-platform support
- low memory
- easy systemd deployment
- good for Docker/system checks

Cons:

- slightly more work for contributors who prefer JS/TS

### Option B: Node.js

Pros:

- same language as Workers app
- easier shared validation/schema code
- faster initial development

Cons:

- heavier runtime
- less ideal for tiny system agent

### Recommendation

Use **Go** for the production agent.

Use TypeScript for Workers/dashboard.

---

## 14.3 Agent config

Default path:

```text
/etc/clawping/agent.yaml
```

User-level alternative:

```text
~/.config/clawping/agent.yaml
```

Example:

```yaml
server: "https://api.clawping.app"
device_token: "cp_device_xxxxx"
device_name: "home-mini-pc"
interval_seconds: 60

checks:
  - type: http
    name: Immich
    url: "http://127.0.0.1:2283"
    expected_status: 200
    timeout_seconds: 10

  - type: disk
    name: Data Disk
    path: "/data"
    warning_percent: 80
    critical_percent: 90

  - type: backup_freshness
    name: Restic Daily Backup
    path: "/backups/last-success.txt"
    max_age_hours: 26

  - type: docker_container
    name: Vaultwarden
    container: "vaultwarden"
    alert_on:
      - stopped
      - unhealthy
```

---

## 14.4 Agent install modes

### Linux systemd

```bash
curl -fsSL https://clawping.app/install.sh | sh -s -- --token cp_xxxxx
```

Installs:

```text
/usr/local/bin/clawping-agent
/etc/clawping/agent.yaml
/etc/systemd/system/clawping-agent.service
```

### macOS launchd

```bash
brew install clawping/tap/clawping-agent
clawping-agent register --token cp_xxxxx
brew services start clawping-agent
```

### Docker agent

```yaml
services:
  clawping-agent:
    image: clawping/agent:latest
    container_name: clawping-agent
    volumes:
      - /:/host:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./agent.yaml:/etc/clawping/agent.yaml:ro
    restart: unless-stopped
```

### Synology

Support through:

- Container Manager
- scheduled task
- package later

### Unraid

Support through:

- Docker template later
- community app template later

---

## 15. Alert logic

---

## 15.1 Status levels

```text
ok
warning
critical
unknown
muted
```

## 15.2 Incident lifecycle

```text
new failing result
    ↓
failure threshold reached
    ↓
open incident
    ↓
send alert
    ↓
continue failing
    ↓
suppress duplicate alerts unless reminder interval reached
    ↓
successful result threshold reached
    ↓
recover incident
    ↓
send recovery alert
```

## 15.3 Default thresholds

```text
Local HTTP:
- warning after 3 failures
- critical after 5 failures

Heartbeat:
- warning after 3 missed
- critical after 5 missed

Disk:
- warning at 80%
- critical at 90%

Backup freshness:
- critical once max age exceeded
```

## 15.4 Deduplication

Do not send repeated alerts every minute.

Default reminder policy:

```text
Initial alert immediately after threshold.
Reminder after 1 hour if still down.
Then every 6 hours.
Recovery alert immediately.
```

---

## 16. Telegram notification design

## 16.1 Device offline

```text
❌ home-mini-pc stopped checking in

Last heartbeat:
5 minutes ago

Likely causes:
• machine powered off
• network down
• ClawPing Agent stopped
• outbound HTTPS blocked

Commands:
/status
/mute home-mini-pc 1h
```

## 16.2 Local app down

```text
❌ Immich is down on home-mini-pc

Check:
http://127.0.0.1:2283

Last error:
Connection refused

Failed for:
5 checks / 5 minutes

Likely causes:
• app container stopped
• app still starting
• port changed
• local reverse proxy issue

Commands:
/mute Immich 30m
/status
```

## 16.3 Backup stale

```text
❌ Backup may be stale

Device:
home-mini-pc

Check:
Restic Daily Backup

Expected:
updated within 26 hours

Actual:
last updated 3 days ago

Likely causes:
• backup job failed
• backup disk not mounted
• cron did not run
• credentials expired
```

## 16.4 Recovery

```text
✅ Immich recovered

Device:
home-mini-pc

Down for:
8 minutes

Recovered:
just now
```

---

## 17. Dashboard specification

---

## 17.1 Dashboard purpose

The dashboard is not the daily product.

Telegram is the daily product.

The dashboard is for:

- onboarding
- configuration
- status overview
- history
- device management
- debugging setup

## 17.2 Main dashboard sections

```text
Overall status
Devices
Active incidents
Checks
Recent alerts
Telegram status
Agent install command
```

## 17.3 Device page

Show:

- online/offline
- last heartbeat
- agent version
- hostname
- OS
- checks
- recent results
- install/update command
- revoke token button

## 17.4 Check page

Show:

- check type
- source: cloud or agent
- config
- latest result
- incident history
- thresholds
- mute settings

## 17.5 Telegram setup page

States:

```text
Not connected
Waiting for Telegram message
Connected
Test alert sent
```

---

## 18. API security

## 18.1 Device authentication

Agent uses bearer token.

Rules:

- raw token shown only once
- store hash only
- support token rotation
- support token revocation
- scope token to one device
- rate-limit failed auth

## 18.2 Payload signing

Optional but recommended later:

```text
X-ClawPing-Timestamp
X-ClawPing-Signature
```

HMAC over body using device secret.

This prevents replay/tampering if bearer token leaks.

## 18.3 Telegram webhook security

Use Telegram secret token header.

Verify:

```text
X-Telegram-Bot-Api-Secret-Token
```

Reject webhook requests without correct secret.

## 18.4 Dashboard auth

Hosted mode:

- email magic link or password
- later GitHub login
- session cookie
- CSRF protection

Self-deployed mode:

- single admin password
- optional Cloudflare Access integration

## 18.5 Rate limiting

Rate limit:

- login
- registration
- heartbeat per device
- Telegram webhook
- public API routes

Use Durable Objects or Cloudflare-native rate limiting depending on deployment mode.

---

## 19. Cloudflare-specific implementation notes

## 19.1 Workers

Use Workers for:

- API
- dashboard backend
- Telegram webhook
- scheduled jobs

Workers support scheduled execution through Cron Triggers using a `scheduled()` handler.

## 19.2 Cron Triggers

Use for:

- missed heartbeat detection
- recurring cloud checks
- cleanup jobs
- digest notifications

Minimum useful cadence:

```text
* * * * *
```

If cost/limits matter, use:

```text
*/2 * * * *
```

## 19.3 Durable Objects

Use for:

- state machines
- per-account serialization
- alert dedupe
- hot device state

Durable Objects are suitable when coordination/stateful behavior is needed.

## 19.4 D1

Use for relational persistence.

Good fit:

- accounts
- devices
- checks
- incidents
- check results

Not ideal for very high-cardinality metrics forever. Keep retention short.

## 19.5 Queues

Use for async processing:

- Telegram notifications
- incident fanout
- check result processing
- retries

This prevents a Telegram API slowdown from delaying heartbeat ingestion.

## 19.6 KV

Use for cached config and low-sensitivity data.

Do not use as source of truth for incident state.

## 19.7 R2

Not required for MVP.

Use later for:

- long-term exports
- debug bundles
- large logs
- generated reports

---

## 20. Repository structure

Recommended monorepo:

```text
clawping/
  README.md
  LICENSE
  NOTICE

  apps/
    worker/
      src/
        index.ts
        routes/
        telegram/
        agent/
        dashboard-api/
        scheduled/
        queues/
        durable-objects/
      wrangler.toml
      migrations/

    dashboard/
      src/
      package.json

  packages/
    shared/
      src/
        schema.ts
        types.ts
        crypto.ts

  agent/
    cmd/
      clawping-agent/
    internal/
      checks/
      config/
      heartbeat/
      docker/
      system/
    go.mod

  docs/
    cloudflare-deploy.md
    hosted-quickstart.md
    agent-linux.md
    agent-macos.md
    agent-docker.md
    telegram-setup.md
    backup-freshness.md
    security.md
    self-deploy.md

  examples/
    agent.yaml
    docker-compose.agent.yaml
    restic-backup.md
    immich.md
    home-assistant.md
```

---

## 21. Wrangler configuration sketch

```toml
name = "clawping"
main = "src/index.ts"
compatibility_date = "2026-05-01"

[triggers]
crons = ["* * * * *", "*/5 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "clawping"
database_id = "YOUR_D1_DATABASE_ID"

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_NAMESPACE_ID"

[[queues.producers]]
binding = "ALERT_QUEUE"
queue = "clawping-alerts"

[[queues.consumers]]
queue = "clawping-alerts"

[[durable_objects.bindings]]
name = "DEVICE_STATE"
class_name = "DeviceState"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DeviceState"]
```

---

## 22. MVP build plan

---

## Phase 1 — Cloudflare control plane skeleton

Deliverables:

- Worker app
- D1 schema
- basic auth
- dashboard shell
- Telegram webhook route
- `/api/health`
- Wrangler deploy

Done when:

- deployed Worker responds
- dashboard loads
- D1 migrations work
- Telegram webhook can receive `/start`

---

## Phase 2 — Device registration + heartbeat

Deliverables:

- create device
- generate registration token
- register agent
- receive heartbeat
- store last heartbeat
- display online/offline status

Done when:

- dashboard shows live device
- last heartbeat updates
- invalid token rejected

---

## Phase 3 — Missed heartbeat alerting

Deliverables:

- Cron sweep
- incident creation
- Telegram alert
- recovery alert
- deduplication
- mute

Done when:

- stopping agent triggers Telegram alert
- restarting agent triggers recovery alert

This is the first real product moment.

---

## Phase 4 — Agent MVP

Deliverables:

- Go agent
- config file
- heartbeat loop
- HTTP local check
- disk check
- backup freshness check
- Linux systemd install

Done when:

- user can monitor one local app, one disk, one backup marker

---

## Phase 5 — Docker checks

Deliverables:

- Docker container status
- health status
- restart count detection
- optional Docker socket config
- security warning

Done when:

- stopping a selected container triggers Telegram alert

---

## Phase 6 — Public beta polish

Deliverables:

- install docs
- self-deploy docs
- hosted quickstart
- dashboard UI polish
- example configs
- GitHub README
- security page
- attribution if any Uptime Kuma code reused

Done when:

- a new user can set it up from README without help

---

## 23. MVP acceptance criteria

ClawPing MVP is ready when:

- Cloudflare Worker deploys with Wrangler.
- D1 migrations run.
- Telegram bot webhook works.
- User can connect Telegram.
- User can create a device.
- User can install/register agent.
- Agent sends heartbeat.
- Dashboard shows device online.
- Missed heartbeat opens incident.
- Telegram offline alert sends.
- Agent recovery sends Telegram recovery alert.
- Agent can run local HTTP check.
- Agent can run disk check.
- Agent can run backup freshness check.
- Agent can run Docker container check.
- User can mute alerts.
- `/status` works.
- Setup docs are clear.

---

## 24. Product copy

## 24.1 Homepage

```text
Telegram-first watchdog for home servers.

ClawPing watches your mini PC, NAS, Docker apps, disk space, and backups through a tiny outbound agent.

No public IP.
No open ports.
Telegram alerts when something breaks.
```

CTA:

```text
Start with Cloudflare
```

Secondary CTA:

```text
Install the agent
```

## 24.2 README opening

```md
# ClawPing

ClawPing is a Cloudflare Workers-first watchdog for home servers, mini PCs, NAS boxes, and self-hosted apps.

A tiny local agent checks your machine from the inside, then sends outbound heartbeats to your ClawPing Worker. If your server stops checking in, a backup goes stale, a disk fills up, or a Docker container dies, ClawPing alerts you through Telegram.

No public IP required.
No open inbound ports.
Open-source agent.
Cloudflare-native control plane.
```

## 24.3 Show HN title

```text
Show HN: ClawPing — Cloudflare Workers watchdog for home servers, no public IP required
```

## 24.4 GitHub description

```text
Cloudflare Workers-first Telegram watchdog for home servers, mini PCs, NAS boxes, Docker apps, disk space, and backup freshness.
```

---

## 25. Pricing and packaging

## 25.1 Open-source core

Open-source:

- agent
- self-deploy Worker
- dashboard
- docs
- basic Telegram alerts

## 25.2 Hosted service later

Possible hosted pricing:

Free:

- 1 account
- 2 devices
- 20 checks
- 7-day history
- Telegram alerts

Pro:

- 10 devices
- 200 checks
- 90-day history
- alert reminders
- multiple Telegram chats
- email/webhook
- advanced backup checks

Small office:

- team access
- audit log
- multiple notification channels
- priority support

Do not start with billing. Validate usage first.

---

## 26. Competitive differentiation

## 26.1 Versus Uptime Kuma

| Area | Uptime Kuma | ClawPing |
|---|---|---|
| Default deployment | self-hosted app | Cloudflare Workers control plane |
| Private LAN checks | from self-hosted instance | from local outbound agent |
| Main alert channel | many integrations | Telegram-first |
| Machine offline detection | weak if same machine dies | strong via missed heartbeat |
| Backup freshness | not core | hero feature |
| Dashboard | central UX | setup/config UX |
| Daily product | web UI | Telegram |

## 26.2 Versus public uptime SaaS

| Public uptime SaaS | ClawPing |
|---|---|
| needs public endpoint | no public IP required |
| checks websites | checks private local services |
| weak local system visibility | agent sees disk/Docker/backups |
| SaaS trust issue | self-deploy possible |

## 26.3 Versus Prometheus/Grafana

| Prometheus/Grafana | ClawPing |
|---|---|
| powerful but heavy | simple and narrow |
| dashboard-first | alert-first |
| metric-centric | incident-centric |
| technical setup | agent + Telegram |

---

## 27. Risks and failure modes

## 27.1 Risk: Cloudflare-first alienates self-hosted purists

Some users dislike relying on Cloudflare.

Mitigation:

- make self-deploy first-class
- keep agent open-source
- allow custom Worker endpoint
- document data collected
- minimize telemetry

## 27.2 Risk: Agent becomes too complex

If the agent becomes a full monitoring platform, maintenance explodes.

Mitigation:

- start with 5 checks
- simple YAML
- no plugin system in MVP
- stable check result schema

## 27.3 Risk: Workers limits affect scheduling

Cron and Workers limits must shape design.

Mitigation:

- use heartbeat push instead of cloud polling
- use Queues for async alerting
- keep scheduled sweeps simple
- store hot state in Durable Objects
- keep D1 history retention bounded

## 27.4 Risk: Telegram delivery is not guaranteed enough

Telegram API can fail or rate-limit.

Mitigation:

- queue alerts
- retry with backoff
- store notification status
- later add ntfy/email/webhook

## 27.5 Risk: Home users do not want an agent

Some users prefer pure Docker apps.

Mitigation:

- support Docker agent
- provide one-command install
- make agent tiny and transparent
- explain why agent is necessary for no-public-IP monitoring

---

## 28. Cheapest disconfirming tests

## 28.1 Test 1 — landing page only

Create landing page:

```text
ClawPing: Cloudflare Workers watchdog for home servers. Tiny agent, no public IP, Telegram alerts.
```

Post to:

- r/selfhosted
- r/homelab
- Hacker News
- Cloudflare Discord/community
- Telegram bot builder communities

Disconfirming signal:

- people only say “just use Uptime Kuma”
- no one cares about Cloudflare-first
- no one asks for agent install

Confirming signal:

- people ask for Synology, Unraid, Proxmox, Tailscale, backup support

## 28.2 Test 2 — heartbeat-only prototype

Build only:

- Worker endpoint
- D1 device table
- Cron missed heartbeat sweep
- Telegram alert
- 30-line shell/Go agent sending heartbeat

No dashboard except simple status page.

Confirming signal:

- users run it because “tell me when my box is dead” is enough

## 28.3 Test 3 — backup freshness script

Ship a standalone agent check:

```text
check if /backups/last-success.txt is older than 26h and alert via ClawPing
```

Confirming signal:

- users adapt it to Restic, Borg, rclone, Synology, cron

This is the highest-signal test because stale backups are a real pain.

---

## 29. Open technical questions

## 29.1 How much should run in Durable Objects?

Unknown.

Start conservative:

- D1 as source of truth
- Durable Objects only for per-device alert state/dedupe

## 29.2 Hosted versus self-deployed first?

Recommendation:

- build self-deployable architecture from day one
- run hosted version yourself for smoother onboarding

Do not force users to choose too early.

## 29.3 Should Uptime Kuma code be reused?

Recommendation:

- do not reuse much code in the first Workers-first MVP
- reuse concepts, not code
- add importer later if useful

Reason:

Uptime Kuma’s core architecture is not Workers-first. Heavy reuse may slow the product down.

## 29.4 Should Cloudflare Tunnel be integrated?

Later, maybe.

Cloudflare Tunnel could expose selected local services safely, but it complicates onboarding and changes the product category.

For MVP, do not require Tunnel.

---

## 30. Final product direction

The strongest ClawPing is not:

```text
A Docker monitoring dashboard with Telegram alerts.
```

The strongest ClawPing is:

```text
A Cloudflare Workers watchdog that notices when your private home server stops checking in.
```

The product should be built around three moments:

1. **My server checked in.**
2. **My server stopped checking in.**
3. **My backup is stale before I need it.**

Everything else is secondary.

---

## 31. Final MVP definition

ClawPing MVP:

```text
Cloudflare Worker + D1 + Durable Objects + Cron + Queue + Telegram bot + tiny local agent.
```

It does:

- device registration
- outbound heartbeat
- missed heartbeat detection
- Telegram alerts
- recovery alerts
- local HTTP checks
- disk checks
- backup freshness checks
- Docker container checks
- dashboard overview
- mute/status commands

It does not do:

- enterprise observability
- full metric analytics
- public status pages
- AI explanations
- Kubernetes
- billing
- mobile app

---

## 32. Confidence

Confidence: **high** that Cloudflare-first is a sharper product direction than Docker-first.

Reason:

- it solves the “monitor dies with the machine” problem
- it avoids public IP requirements
- it creates a cleaner Telegram bot architecture
- it differentiates from Uptime Kuma
- it gives ClawPing a real reason to exist

Confidence: **medium** on commercial demand.

Reason:

- home-server users are real but fragmented
- many prefer free tools
- hosted Cloudflare control plane must earn trust
- the product must prove it is more than “heartbeat plus Telegram”

The cheapest validation is not a full dashboard.

The cheapest validation is:

```text
Worker receives heartbeat.
Cron detects silence.
Telegram says your server stopped checking in.
```

If users love that, build the rest.
