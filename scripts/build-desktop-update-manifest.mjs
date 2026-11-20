import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { installerFeed, updateFeed } from './desktop-update-feed.mjs';

const [macArchive, windowsDir, outputPath] = process.argv.slice(2);
const { version } = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'));

async function platform(path, base = installerFeed(version)) {
  const [artifact, signatureText] = await Promise.all([stat(path), readFile(`${path}.sig`, 'utf8')]);
  if (!artifact.isFile() || artifact.size === 0) throw new Error(`Missing update package ${basename(path)}.`);
  const signature = signatureText.trim();
  const signedComment = Buffer.from(signature, 'base64').toString('utf8')
    .split('\n').find(line => line.startsWith('trusted comment:'));
  if (!signedComment?.split('\t').includes(`version:${version}`)) {
    throw new Error(`Update signature for ${basename(path)} does not declare version ${version}.`);
  }
  return { url: new URL(basename(path), base).href, signature };
}

const [mac, msi, nsis] = await Promise.all([
  platform(macArchive, updateFeed),
  platform(join(windowsDir, 'msi', `BlueK_${version}_Windows_x64.msi`)),
  platform(join(windowsDir, 'nsis', `BlueK_${version}_Windows_x64_Setup.exe`)),
]);
await writeFile(outputPath, JSON.stringify({
  version,
  platforms: {
    'darwin-aarch64': mac,
    'windows-x86_64-msi': msi,
    'windows-x86_64-nsis': nsis,
    'windows-x86_64': nsis,
  },
}, null, 2) + '\n');
