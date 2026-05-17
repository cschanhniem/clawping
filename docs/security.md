# Security

ClawPing is designed to monitor home servers and private networks securely without requiring a public IP address or open inbound ports.

## Architecture security benefits

The core security model relies on outbound connections:

1. The agent reaches out to Cloudflare; Cloudflare does not reach in.
2. The agent has no inbound network interface.
3. Your firewall remains closed.

## Agent device tokens

The agent uses a long-lived Bearer token for authentication.

- Tokens are generated once during registration.
- The control plane stores only a hash of the token.
- Tokens are scoped to a single device.
- If a device is compromised, you can revoke its token from the dashboard without affecting other devices.
- Tokens are transmitted only over TLS.

## Local agent execution

The agent runs as a systemd service or Docker container.

- It executes read-only checks (HTTP, disk usage, Docker status, file modification time).
- It does not accept inbound commands from the control plane to run arbitrary code.
- Docker checks require Docker socket access. Run the agent natively (without the `docker_container` check enabled) if you prefer to avoid mounting `/var/run/docker.sock`.

## Control plane data storage

The Cloudflare Workers control plane uses D1 and KV.

- D1 stores relational data (accounts, devices, check results).
- KV stores low-sensitivity cached data.
- Durable Objects coordinate alert state machines.

All data remains within Cloudflare's infrastructure unless exported.

## Dashboard authentication

- Hosted mode uses email magic links or password authentication with CSRF protection.
- Self-deployed mode uses a single admin password (or Cloudflare Access).

## Telegram webhooks

- The Telegram API communicates with the Worker via HTTPS webhook.
- The webhook requires the `X-Telegram-Bot-Api-Secret-Token` header.
- The Worker rejects any request lacking the correct secret.

## Payload security

Agent payloads are sent via standard HTTPS `POST` requests.

The design supports future HMAC payload signing using a device-specific secret (`X-ClawPing-Signature`) to prevent replay or tampering if a device bearer token leaks, though TLS and HTTPS are sufficient for standard operation.

## Reporting vulnerabilities

To report a vulnerability in the open-source agent or control plane, please open an issue in the repository or contact the maintainers directly.
