#!/usr/bin/env bash
# Start LAI in production: AI gateway (internal, port 8001) + web/API server (port ${PORT:-5000}).
set -euo pipefail
cd "$(dirname "$0")"
[ -f dist/index.cjs ] || npm run build
python3 ai/gateway.py > gateway.log 2>&1 &
GW=$!
trap 'kill $GW 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://127.0.0.1:${AI_GATEWAY_PORT:-8001}/health >/dev/null && break; sleep 1; done
NODE_ENV=production node dist/index.cjs
