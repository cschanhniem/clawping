# Backup Freshness Checks

Backup freshness is a first-class ClawPing feature. Most people discover their backup is broken only when they need it. ClawPing watches for stale backups and alerts you before that happens.

## How it works

The agent checks whether a file (or any file inside a folder) has been modified recently. If the file is older than the configured threshold, ClawPing reports a critical failure.

## Basic configuration

In your `agent.yaml`, add a `backup_freshness` check:

```yaml
checks:
  - type: backup_freshness
    name: Daily Restic Backup
    path: /backups/last-success.txt
    max_age_hours: 26
```

This tells the agent: if `/backups/last-success.txt` has not been modified in the last 26 hours, report the backup as stale.

## Configuration options

| Key | Required | Description |
|---|---|---|
| `type` | Yes | Must be `backup_freshness` |
| `name` | Yes | Human-readable check name |
| `path` | Yes | Path to a file or directory |
| `max_age_hours` | Yes | Maximum allowed age in hours |
| `success_contains` | No | If set, the file content must include this string |

## File-based checks

Use a marker file that your backup script touches on success:

```bash
# At the end of your backup script:
echo "backup completed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > /backups/last-success.txt
```

```yaml
checks:
  - type: backup_freshness
    name: Nightly Borg Backup
    path: /backups/last-success.txt
    max_age_hours: 26
    success_contains: "backup completed"
```

Using `success_contains` ensures the file was actually written by a successful backup, not just touched by accident.

## Folder-based checks

If your backup tool writes timestamped folders (e.g., Restic snapshots, Time Machine), point the check at the parent directory. The agent checks whether the most recently modified file inside the folder is within the threshold:

```yaml
checks:
  - type: backup_freshness
    name: Restic Snapshots
    path: /backups/restic-repo/snapshots/
    max_age_hours: 26
```

## Choosing the right threshold

Set `max_age_hours` a few hours longer than your backup schedule to account for normal variation:

| Backup schedule | Recommended threshold |
|---|---|
| Every 6 hours | 8 hours |
| Daily | 26 hours |
| Weekly | 170 hours (7 days + 2 hours) |

## Alert example

When a backup goes stale, ClawPing sends:

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

When the file is refreshed, you receive a recovery alert.

## Integrating with common tools

See [examples/restic-backup.md](../examples/restic-backup.md) for a complete Restic example.

General pattern for any backup tool:

1. Run the backup command.
2. Check exit code.
3. On success, write a marker file.
4. Configure ClawPing to watch that marker.

```bash
#!/bin/bash
set -euo pipefail

# Run your backup
restic backup /data

# Write marker on success
echo "backup completed $(date -u +%Y-%m-%dT%H:%M:%SZ)" > /backups/last-success.txt
```
