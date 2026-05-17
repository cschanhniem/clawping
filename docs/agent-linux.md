# Install ClawPing Agent on Linux

The ClawPing agent is a tiny, outbound-only binary. On Linux, it runs as a systemd service.

## Installation

Run the install command provided by your ClawPing dashboard.

```bash
curl -fsSL https://clawping.app/install.sh | sh -s -- \
  --token cp_live_xxxxx \
  --device your-device-name
```

If you self-host the control plane, replace the URL with your Cloudflare Worker URL.

## What the installer does

1. Downloads the `clawping-agent` binary to `/usr/local/bin/`.
2. Creates the configuration directory `/etc/clawping/`.
3. Generates `/etc/clawping/agent.yaml` using your token.
4. Installs the systemd service unit to `/etc/systemd/system/clawping-agent.service`.
5. Enables and starts the service.

## Configuration

Edit `/etc/clawping/agent.yaml` to add local checks:

```bash
sudo nano /etc/clawping/agent.yaml
```

Example basic config:

```yaml
server: "https://api.clawping.app"
device_token: "cp_device_xxxxx"
device_name: "home-mini-pc"
interval_seconds: 60

checks:
  - type: disk
    name: Root Disk
    path: "/"
    warning_percent: 80
    critical_percent: 90
```

Apply changes by restarting the agent:

```bash
sudo systemctl restart clawping-agent
```

## Logs and troubleshooting

Check agent logs:

```bash
sudo journalctl -u clawping-agent -f
```

Check service status:

```bash
sudo systemctl status clawping-agent
```

## Updating

The installer script handles updates. Run it again without arguments:

```bash
curl -fsSL https://clawping.app/install.sh | sh
```

## Uninstalling

```bash
sudo systemctl stop clawping-agent
sudo systemctl disable clawping-agent
sudo rm /etc/systemd/system/clawping-agent.service
sudo rm /usr/local/bin/clawping-agent
sudo rm -rf /etc/clawping
```
