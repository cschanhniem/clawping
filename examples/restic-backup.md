# Monitor Restic Backups with ClawPing

Restic is a fast, secure backup tool. This guide explains how to monitor your nightly Restic backups with ClawPing.

## How it works

1. Your cron job runs Restic.
2. If Restic succeeds, it touches a success file `/backups/last-success.txt` and appends `"backup completed"`.
3. The ClawPing agent runs a `backup_freshness` check on `/backups/last-success.txt` with a `max_age_hours` threshold.
4. If the file is too old or does not contain the success string, ClawPing alerts you on Telegram.

## 1. Create your backup script

Create `/usr/local/bin/backup-and-ping.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_MARKER="/backups/last-success.txt"

echo "Starting restic backup..."

# Run restic
export RESTIC_REPOSITORY="/mnt/nas/restic"
export RESTIC_PASSWORD_FILE="/etc/restic-password"

if restic backup /data; then
  # On success, write the marker file with a timestamp
  echo "backup completed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BACKUP_MARKER"
  echo "Backup succeeded and marker updated."
else
  # If restic fails, the marker is NOT touched
  echo "Backup failed. Marker NOT updated."
  exit 1
fi
```

Make it executable:

```bash
chmod +x /usr/local/bin/backup-and-ping.sh
```

## 2. Schedule the script with Cron

Add the cron job to `/etc/crontab` or `crontab -e` to run nightly at 2 AM:

```cron
0 2 * * * root /usr/local/bin/backup-and-ping.sh > /var/log/restic-backup.log 2>&1
```

## 3. Configure the ClawPing agent

Add this check to `/etc/clawping/agent.yaml`:

```yaml
checks:
  - type: backup_freshness
    name: Daily Restic Backup
    path: /backups/last-success.txt
    max_age_hours: 26
    success_contains: "backup completed"
```

Restart the agent:

```bash
sudo systemctl restart clawping-agent
```

## Why 26 hours?

If your backup runs every 24 hours (at 2 AM), a threshold of exactly 24 hours would trigger false positives if a backup took a few minutes longer to complete. A 26-hour window gives the job 2 hours of buffer.

## Failure scenarios monitored

ClawPing will detect and alert on these scenarios:

| Failure | Result | ClawPing alert |
|---|---|---|
| Restic exits with error | Marker is not touched | Alert within 26 hours |
| Machine loses power | Agent heartbeats stop | Alert within 5 minutes |
| NAS drive not mounted | Restic fails, marker is not touched | Alert within 26 hours |
| Cron daemon stopped | Script never runs, marker is not touched | Alert within 26 hours |
