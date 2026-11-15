#!/usr/bin/env bash
# Builds, serves dist on a local port, runs Lighthouse in mobile mode and fails under
# performance 90 or accessibility 95.
set -euo pipefail
PORT=4332
OUT="${TMPDIR:-/tmp}/wind-farm-lighthouse.json"

if HOLDER=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null) && [ -n "$HOLDER" ]; then
  echo "port $PORT is already in use; refusing to run:" >&2
  echo "$HOLDER" >&2
  exit 1
fi

npm run build >/dev/null
# Run the astro binary directly so $! is the server itself; --ignore-lock keeps it in the foreground.
node_modules/.bin/astro preview --port "$PORT" --ignore-lock >/dev/null 2>&1 &
PID=$!
# Only ever stop the process we started and its children.
cleanup() { pkill -TERM -P "$PID" 2>/dev/null || true; kill -TERM "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT

READY=
for _ in $(seq 1 60); do
  kill -0 "$PID" 2>/dev/null || { echo "preview server exited before listening" >&2; exit 1; }
  if curl -sf "http://localhost:$PORT" >/dev/null; then READY=1; break; fi
  sleep 0.5
done
[ -n "$READY" ] || { echo "preview server did not start on $PORT" >&2; exit 1; }

npx lighthouse "http://localhost:$PORT" --quiet --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path="$OUT"
node -e "
const r = require('$OUT').categories;
const s = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v.score * 100)]));
console.log('lighthouse mobile', s);
if (s.performance < 90 || s.accessibility < 95) { console.error('under the gate: performance 90, accessibility 95'); process.exit(1); }
"
