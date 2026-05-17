# Run ClawPing Agent in Docker

Running the agent in Docker is ideal for users who already containerize their services.

## Quick start

Create `docker-compose.yml` in your compose directory:

```yaml
version: "3.8"

services:
  clawping-agent:
    image: clawping/agent:latest
    container_name: clawping-agent
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/host:ro
      - ./agent.yaml:/etc/clawping/agent.yaml:ro
    environment:
      - CLAWPING_DEVICE_TOKEN=cp_device_xxxxx
```

Start the agent:

```bash
docker compose up -d
```

## Configuration file

Create `agent.yaml` in the same directory as your `docker-compose.yml`:

```yaml
server: "https://api.clawping.app"
device_name: "docker-host"
interval_seconds: 60

checks:
  - type: disk
    name: Root Disk
    path: "/host/"
    warning_percent: 80
    critical_percent: 90

  - type: docker_container
    name: Portainer
    container: portainer
    alert_on:
      - stopped
      - unhealthy
```

## Volume mounts explained

| Mount | Purpose |
|---|---|
| `/var/run/docker.sock:/var/run/docker.sock:ro` | Required for Docker container checks |
| `/:/host:ro` | Required for disk checks and backup freshness checks |
| `./agent.yaml:/etc/clawping/agent.yaml:ro` | Your configuration file |

The agent runs as root inside the container to access the Docker socket and host filesystem. The `:ro` suffix ensures read-only access where possible.

## Environment variables

Instead of the config file, you can use environment variables:

| Variable | Equivalent config |
|---|---|
| `CLAWPING_SERVER` | `server` |
| `CLAWPING_DEVICE_TOKEN` | `device_token` |
| `CLAWPING_DEVICE_NAME` | `device_name` |
| `CLAWPING_INTERVAL` | `interval_seconds` |

## Docker run (without compose)

```bash
docker run -d \
  --name clawping-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /:/host:ro \
  -v ./agent.yaml:/etc/clawping/agent.yaml:ro \
  -e CLAWPING_DEVICE_TOKEN=cp_device_xxxxx \
  clawping/agent:latest
```

## Docker tag stability

| Tag | Description |
|---|---|
| `latest` | Most recent stable release |
| `vX.Y.Z` | Specific version |
| `main` | Development branch (not recommended for production) |
