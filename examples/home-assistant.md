# Monitor Home Assistant with ClawPing

[Home Assistant](https://www.home-assistant.io/) is a popular open-source home automation platform. This guide shows how to monitor it with ClawPing.

## HTTP health check

Home Assistant's API includes a health endpoint.

Add an HTTP check to your `agent.yaml`:

```yaml
checks:
  - type: http
    name: Home Assistant
    url: "http://127.0.0.1:8123/api/"
    expected_status: 200
    timeout_seconds: 10
```

The base URL returns HTTP 200 with a JSON body like `{"message": "API running."}`.

## Docker container check

If Home Assistant runs in Docker or Docker Compose:

```yaml
checks:
  - type: docker_container
    name: Home Assistant Container
    container: homeassistant
    alert_on:
      - stopped
      - unhealthy
      - restart_count_increased
```

The `restart_count_increased` option catches crash loops where the container restarts repeatedly.

## Supervised / HAOS installs

If you run Home Assistant OS or Supervised, the agent runs as a native binary (not in Docker). Use the HTTP health check:

```yaml
checks:
  - type: http
    name: Home Assistant
    url: "http://127.0.0.1:8123/api/"
    expected_status: 200
    timeout_seconds: 15
```

Allow a longer `timeout_seconds` for slow startups on Raspberry Pi.

## Disk monitoring for HA data

Home Assistant stores its database and configuration on disk. Add a disk check for the volume that holds `/config`:

```yaml
checks:
  - type: disk
    name: HA Config Disk
    path: "/data"
    warning_percent: 80
    critical_percent: 90
```

A full disk can cause Home Assistant to corrupt its database or stop recording events.

## Combined example

```yaml
checks:
  - type: http
    name: Home Assistant
    url: "http://127.0.0.1:8123/api/"
    expected_status: 200
    timeout_seconds: 15

  - type: docker_container
    name: Home Assistant Container
    container: homeassistant
    alert_on:
      - stopped
      - unhealthy
      - restart_count_increased

  - type: disk
    name: HA Data Disk
    path: "/data"
    warning_percent: 80
    critical_percent: 90
```

## Alert examples

```text
❌ Home Assistant is down on home-mini-pc

Check:
http://127.0.0.1:8123/api/

Last error:
Connection refused

Failed for:
5 checks / 5 minutes
```

```text
⚠️ Disk warning on home-mini-pc

Disk:
/data

Usage:
84%

Threshold:
80%
```
