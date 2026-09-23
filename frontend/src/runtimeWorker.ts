import { RuntimeHost } from './runtimeHost';
import type { WorkerCommand } from '../../runtime-contract/src/index';

/**
 * Worker side of `LocalRuntimeClient`: evaluates the Kotlite bundle once and
 * forwards every command to one `RuntimeHost`. Only how the bundle's source is
 * obtained differs between the IDE (static asset) and an exported player
 * (embedded in the HTML file).
 */
export function startRuntimeWorker(loadKotlite: () => Promise<string>) {
  const hostReady = loadKotlite().then(source => {
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
}
