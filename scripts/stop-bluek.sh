#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PID_FILE="$ROOT/.bluek-server.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "BlueK server is not running (no PID file)."
    exit 0
fi

PID=$(cat "$PID_FILE" 2>/dev/null || true)
case "$PID" in
    ''|*[!0-9]*)
        echo "Ignoring invalid BlueK PID file." >&2
        rm -f "$PID_FILE"
        exit 1
        ;;
esac

if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "Stopped BlueK server (PID $PID)."
else
    echo "BlueK server process $PID is already gone."
fi
rm -f "$PID_FILE"
