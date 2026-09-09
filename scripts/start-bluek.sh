#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
kotlinc "$ROOT"/jvm/src/main/kotlin/de/tomkarp/bluek/*.kt -include-runtime -d "$ROOT/jvm/worker.jar"
npm run build
exec node "$ROOT/server/dist/server/src/index.js"
