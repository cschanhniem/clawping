# Install ClawPing Agent on macOS

The ClawPing agent runs natively on macOS (Intel and Apple Silicon) via Homebrew and launchd.

## Installation

Install using Homebrew:

```bash
brew install clawping/tap/clawping-agent
```

Register your device using the token from your dashboard:

```bash
clawping-agent register --token cp_live_xxxxx --device my-mac-mini
```

Start the service:

```bash
brew services start clawping-agent
```

## Configuration

The configuration file is located at `~/.config/clawping/agent.yaml`.

```bash
nano ~/.config/clawping/agent.yaml
```

Add your checks and restart the service:

```bash
brew services restart clawping-agent
```

## Logs and troubleshooting

View logs:

```bash
tail -f /usr/local/var/log/clawping-agent.log
# Or on Apple Silicon:
tail -f /opt/homebrew/var/log/clawping-agent.log
```

Check service status:

```bash
brew services info clawping-agent
```

## Updating

```bash
brew upgrade clawping-agent
brew services restart clawping-agent
```

## Uninstalling

```bash
brew services stop clawping-agent
brew uninstall clawping-agent
rm -rf ~/.config/clawping
```
