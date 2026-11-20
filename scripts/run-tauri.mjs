import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { updateEndpoint } from './desktop-update-feed.mjs';

const env = { ...process.env };
const rustupCandidates = [
  'rustup',
  '/opt/homebrew/opt/rustup/bin/rustup',
  '/usr/local/opt/rustup/bin/rustup',
];
for (const rustup of rustupCandidates) {
  const result = spawnSync(rustup, ['which', 'cargo'], { encoding: 'utf8' });
  if (result.status !== 0) continue;
  const cargoDirectory = path.dirname(result.stdout.trim());
  env.PATH = `${cargoDirectory}${path.delimiter}${env.PATH ?? ''}`;
  break;
}

const args = process.argv.slice(2);
if (args[0] === 'build' && env.BLUEK_UPDATER_PUBLIC_KEY) {
  args.push('--config', JSON.stringify({
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: {
      pubkey: env.BLUEK_UPDATER_PUBLIC_KEY.trim(),
      endpoints: [updateEndpoint],
      requireSignedVersion: true,
    } },
  }));
}

const result = spawnSync(process.execPath, [
  'node_modules/@tauri-apps/cli/tauri.js',
  ...args,
], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
