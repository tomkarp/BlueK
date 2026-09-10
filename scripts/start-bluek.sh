#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
npm run build
exec node "$ROOT/server/dist/server/src/index.js"
