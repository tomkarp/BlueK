#!/bin/sh
# Starts BlueK offline on macOS/Linux: local web server + browser.
# Usage: ./start.command [port]   (default 8901)
cd "$(dirname "$0")" || exit 1
PORT="${1:-8901}"

(sleep 2; (command -v open >/dev/null && open "http://127.0.0.1:$PORT/") || (command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:$PORT/")) &

if command -v node >/dev/null 2>&1; then
  echo "BlueK startet mit Node.js ..."
  exec node "./server.mjs" "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  echo "BlueK startet mit Python ..."
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "./app"
else
  echo "Weder Node.js noch Python gefunden. Bitte eines davon installieren."
  exit 1
fi
