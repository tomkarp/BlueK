import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const moduleId = 'virtual:bluek-kotlite-gzip';
const resolvedId = '\0' + moduleId;

/**
 * Provides `virtual:bluek-kotlite-gzip`: the built Kotlite bundle, gzip-compressed
 * and base64-encoded, for the exported player that cannot fetch it.
 * @param {string} [bundlePath]
 * @returns {import('vite').Plugin}
 */
export function embeddedKotlite(bundlePath = path.resolve(process.cwd(), 'frontend/public/kotlite/bluek-kotlite-browser.js')) {
  return {
    name: 'bluek-embedded-kotlite',
    resolveId: id => (id === moduleId ? resolvedId : undefined),
    async load(id) {
      if (id !== resolvedId) return undefined;
      this.addWatchFile(bundlePath);
      const compressed = gzipSync(await readFile(bundlePath), { level: 9 }).toString('base64');
      return `export default ${JSON.stringify(compressed)};`;
    },
  };
}
