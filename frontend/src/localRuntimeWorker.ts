import { RuntimeHost } from './runtimeHost';
import type { RuntimeEvent, WorkerCommand } from '../../runtime-contract/src/index';

const bundleUrl = new URL('../kotlite/bluek-kotlite-browser.js', import.meta.url);
const hostReady = fetch(bundleUrl)
  .then(response => { if (!response.ok) throw new Error('Could not load Kotlite.'); return response.text(); })
  .then(source => {
    (0, eval)(source);
    const api = (globalThis as any)['bluek-kotlite-browser'];
    return new RuntimeHost(() => api.bluekCreateKotliteSession());
  });

self.onmessage = (event: MessageEvent<WorkerCommand & { id: number }>) => {
  const request = event.data;
  hostReady.then(host => host.dispatch(request.id, request, message => self.postMessage(message)))
    .catch(error => self.postMessage({ id: request.id, generationId: request.generationId,
      transportError: error instanceof Error ? error.message : String(error) }));
};
