# Monitor Immich with ClawPing

[Immich](https://immich.app) is a self-hosted photo and video backup solution. This guide shows how to monitor Immich with ClawPing.

## HTTP health check

Add an HTTP check to your `agent.yaml`:

```yaml
checks:
  - type: http
    name: Immich
    url: "http://127.0.0.1:2283"
    expected_status: 200
    timeout_seconds: 10
```

This checks that Immich's web server responds with HTTP 200 on port 2283.

## Docker container check

If Immich runs in Docker, you can also monitor the container directly:

```yaml
checks:
  - type: docker_container
    name: Immich Server
    container: immich_server
    alert_on:
      - stopped
      - unhealthy
```

This alerts if the `immich_server` container stops or reports an unhealthy status.

## Combined example

For the most robust monitoring, use both checks:

```yaml
checks:
  - type: http
    name: Immich HTTP
    url: "http://127.0.0.1:2283"
    expected_status: 200
    timeout_seconds: 10

  - type: docker_container
    name: Immich Container
    container: immich_server
    alert_on:
      - stopped
      - unhealthy
```

## Docker socket requirement

The `docker_container` check requires the agent to access the Docker socket. If you run the agent natively (not in Docker), add the `clawping` user to the `docker` group:

```bash
sudo usermod -aG docker clawping
```

If you run the agent in Docker, mount the socket:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

## What the alerts look like

When Immich goes down:

```text
❌ Immich HTTP is down on home-mini-pc

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
```

When Immich recovers:

```text
✅ Immich HTTP recovered

Device:
home-mini-pc

Down for:
8 minutes

Recovered:
just now
```
