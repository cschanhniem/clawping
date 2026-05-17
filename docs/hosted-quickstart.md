# ClawPing Hosted Quickstart

ClawPing Cloud is the fastest way to get Telegram alerts for your home server without hosting the control plane yourself. It requires no public IP, no open ports, and no Cloudflare configuration.

## 1. Create an account

1. Go to [clawping.app](https://clawping.app).
2. Sign up with email or GitHub.

## 2. Connect Telegram

1. Open the ClawPing dashboard.
2. Click **Connect Telegram**.
3. Follow the link to the `@ClawPingBot`.
4. Click **Start** in Telegram.
5. The dashboard will confirm the connection.

## 3. Register your device

1. In the dashboard, click **Add Device**.
2. Name your device (e.g., `home-mini-pc`, `synology-nas`).
3. ClawPing will generate an install command with a secure device token.

Example install command:

```bash
curl -fsSL https://clawping.app/install.sh | sh -s -- \
  --token cp_live_xxxxx \
  --device home-mini-pc
```

## 4. Install the agent

Run the install command on your home server.

See the specific guides for your OS:
- [Linux (systemd)](./agent-linux.md)
- [macOS (launchd)](./agent-macos.md)
- [Docker](./agent-docker.md)

## 5. Verify heartbeat

1. Return to the ClawPing dashboard.
2. Your device status should change from `unknown` to `online`.
3. Check Telegram. You can send `/status` to the bot to see your new device.

## 6. Configure checks

Edit your local `/etc/clawping/agent.yaml` to add specific checks like disk space, backup freshness, or Docker containers.

The agent automatically pushes these checks to the cloud on its next heartbeat.

## 7. Test an alert

The easiest way to test the alert system is to turn off your server (or stop the agent):

```bash
sudo systemctl stop clawping-agent
```

After 5 minutes (or your configured missed-heartbeat threshold), ClawPing Cloud will notice the missing heartbeats and send a Telegram alert:

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

Restart the agent to receive a recovery alert.
