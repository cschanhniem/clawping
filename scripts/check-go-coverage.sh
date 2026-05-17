#!/bin/sh
set -eu

cd "$(dirname "$0")/../agent"
go test ./... -coverprofile=coverage.out
coverage="$(go tool cover -func=coverage.out | awk '/total:/ {print $3}')"
echo "Go coverage: ${coverage}"
if [ "$coverage" != "100.0%" ]; then
  echo "Expected 100.0% Go coverage, got ${coverage}" >&2
  exit 1
fi
