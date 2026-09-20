// Builds the offline BlueK bundle: a self-contained folder (app + start scripts)
// plus a ZIP, for exam rooms without internet access.
// Usage: node scripts/build-offline.mjs [--out <dir>] [--no-zip] [--if-missing]
import { spawnSync } from 'node:child_process';
import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outIndex = process.argv.indexOf('--out');
const target = path.resolve(repository, outIndex === -1 ? 'dist-offline' : process.argv[outIndex + 1]);
const bundle = path.join(target, 'BlueK-offline');
const withZip = !process.argv.includes('--no-zip');

// `--if-missing` keeps `npm run dev` fast: the bundle is only built when the
// download the sidebar links to is not there yet.
if (process.argv.includes('--if-missing') && existsSync(path.join(repository, 'frontend/public/downloads/BlueK-offline.zip'))) {
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(bundle, { recursive: true });
// Removed before the build so an older ZIP never ends up inside the new one.
const downloads = path.join(repository, 'frontend/public/downloads');
await rm(downloads, { recursive: true, force: true });

// Relative base path so the bundle also works when served from a sub-directory.
const build = spawnSync('npx', ['vite', 'build', '--config', 'frontend/vite.config.ts', '--outDir', path.join(bundle, 'app'), '--emptyOutDir'], {
  cwd: repository,
  stdio: 'inherit',
  env: { ...process.env, VITE_BLUEK_OFFLINE: '1', VITE_BASE_PATH: './' },
});
if (build.status !== 0) process.exit(build.status ?? 1);

for (const file of ['server.mjs', 'server.ps1', 'start.bat', 'start.command', 'LIESMICH.txt']) {
  await cp(path.join(repository, 'scripts/offline', file), path.join(bundle, file));
}
await chmod(path.join(bundle, 'start.command'), 0o755);

let published = false;
if (withZip) {
  const zip = spawnSync('zip', ['-r', '-q', 'BlueK-offline.zip', 'BlueK-offline'], { cwd: target, stdio: 'inherit' });
  if (zip.status === 0) {
    // The online build offers this ZIP for download (link in the sidebar).
    await mkdir(downloads, { recursive: true });
    await cp(path.join(target, 'BlueK-offline.zip'), path.join(downloads, 'BlueK-offline.zip'));
    published = true;
  } else console.warn('Could not create the ZIP file; the folder is ready nonetheless.');
}

console.log(`\nOffline bundle: ${bundle}${withZip ? `\nZIP: ${path.join(target, 'BlueK-offline.zip')}` : ''}`);
if (published) console.log('Download link: frontend/public/downloads/BlueK-offline.zip (run the Vite build afterwards).');
console.log('Start: start.bat (Windows) or start.command (macOS/Linux).');
