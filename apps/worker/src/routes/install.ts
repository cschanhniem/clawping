import type { Env } from '../index';
import { appBaseUrl } from '../util';

export function installScript(request: Request, env: Env): Response {
  const baseUrl = appBaseUrl(env, request);
  const script = `#!/bin/sh
set -eu

TOKEN=""
DEVICE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --device)
      DEVICE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$TOKEN" ] || [ -z "$DEVICE" ]; then
  echo "Usage: install.sh --token <registration-token> --device <device-name>" >&2
  exit 1
fi

mkdir -p "$HOME/.config/clawping"
cat > "$HOME/.config/clawping/agent.yaml" <<CFG
server: "${baseUrl}"
device_token: "REPLACE_AFTER_REGISTER"
device_name: "\${DEVICE}"
interval_seconds: 60
checks:
  - type: http
    name: Example Local Check
    url: "http://127.0.0.1:8080"
    expected_status: 200
    timeout_seconds: 10
CFG

echo "Config stub written to $HOME/.config/clawping/agent.yaml"
echo "Next: register the device against ${baseUrl}/api/agent/register using the provided registration token, then replace device_token."
echo "Registration token: \$TOKEN"
`;

  return new Response(script, {
    headers: {
      'content-type': 'text/x-shellscript; charset=utf-8',
    },
  });
}
