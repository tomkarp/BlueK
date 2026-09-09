#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ ! -f "$ROOT/jvm/worker.jar" ]; then
  kotlinc "$ROOT"/jvm/src/main/kotlin/de/tomkarp/bluek/*.kt -include-runtime -d "$ROOT/jvm/worker.jar"
fi
if [ ! -f "$ROOT/server/dist/server/src/index.js" ]; then
  npm run build
fi
exec node "$ROOT/server/dist/server/src/index.js"
