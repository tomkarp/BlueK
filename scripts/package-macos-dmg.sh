#!/usr/bin/env bash
set -euo pipefail

target="${1:-aarch64-apple-darwin}"
version="$(node -p "require('./src-tauri/tauri.conf.json').version")"
bundle_dir="src-tauri/target/$target/release/bundle"
app="$bundle_dir/macos/BlueK.app"
output_dir="$bundle_dir/dmg"
output="$output_dir/BlueK_${version}_aarch64.dmg"
stage="$(mktemp -d "${TMPDIR:-/tmp}/bluek-dmg.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

if [[ ! -d "$app" ]]; then
  echo "Built macOS app not found: $app" >&2
  exit 1
fi

mkdir -p "$output_dir"
ditto "$app" "$stage/BlueK.app"
ln -s /Applications "$stage/Applications"
rm -f "$output"
hdiutil create -volname "BlueK $version" -srcfolder "$stage" -ov -format UDZO "$output"
hdiutil verify "$output"
echo "Created $output"
