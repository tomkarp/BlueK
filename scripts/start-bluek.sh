#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
npm run build
PID_FILE="$ROOT/.bluek-server.pid"

server_is_reachable() {
    curl -fsS --max-time 1 http://localhost:5173/ >/dev/null 2>&1
}

if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    case "$OLD_PID" in
        ''|*[!0-9]*) OLD_PID='' ;;
    esac
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        if server_is_reachable; then
            echo "BlueK server is already running (PID $OLD_PID)." >&2
            exit 1
        fi
        echo "Ignoring stale BlueK PID file (PID $OLD_PID; port 5173 is not reachable)." >&2
    fi
    rm -f "$PID_FILE"
fi

node "$ROOT/server/dist/server/src/index.js" &
SERVER_PID=$!
printf '%s\n' "$SERVER_PID" > "$PID_FILE"

cleanup() {
    rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

wait "$SERVER_PID"
