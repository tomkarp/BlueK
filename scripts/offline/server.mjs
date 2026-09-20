// Static file server for the offline BlueK bundle. Serves ./app on 127.0.0.1 only.
// Usage: node server.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'app');
const port = Number(process.argv[2]) || 8901;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const requested = decodeURIComponent((request.url || '/').split('?')[0]);
  let file = path.join(root, path.normalize(requested).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`BlueK: http://127.0.0.1:${port}/  (Fenster schliessen beendet BlueK)`);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} ist belegt. Starten Sie BlueK mit einem anderen Port, z. B.: start.bat ${port + 1}`
    : String(error));
  process.exit(1);
});
