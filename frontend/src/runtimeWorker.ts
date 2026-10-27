import { RuntimeHost } from './runtimeHost';
import type { WorkerCommand } from '../../runtime-contract/src/index';

/**
 * Worker side of `LocalRuntimeClient`: evaluates the Kotlite bundle once and
 * forwards every command to one `RuntimeHost`. Only how the bundle's source is
 * obtained differs between the IDE (static asset) and an exported player
 * (embedded in the HTML file).
 */
export function startRuntimeWorker(loadKotlite: () => Promise<string>) {
  let sourceSession: {
    classifyProjectFile(filename: string, source: string): string;
    classRenameReferences(filenames: string[], sources: string[], className: string, withBluePlay: boolean): string;
  } | undefined;
  const hostReady = loadKotlite().then(source => {
    (0, eval)(source);
    const api = (globalThis as any)['bluek-kotlite-browser'];
    return new RuntimeHost(() => api.bluekCreateKotliteSession());
  });
  self.onmessage = (event: MessageEvent<(WorkerCommand & { id: number }) | { op: 'classifyFiles'; id: number; files: { fileName: string; source: string }[] } | { op: 'classReferences'; id: number; files: { fileName: string; source: string }[]; className: string; withBluePlay: boolean }>) => {
    const request = event.data;
    if (request.op === 'classifyFiles' || request.op === 'classReferences') {
      hostReady.then(() => {
        const api = (globalThis as any)['bluek-kotlite-browser'];
        sourceSession ??= api.bluekCreateKotliteSession();
        if (request.op === 'classifyFiles') {
          const files = request.files.map(file => JSON.parse(sourceSession!.classifyProjectFile(file.fileName, file.source)));
          self.postMessage({ id: request.id, files });
        } else {
          const references = JSON.parse(sourceSession!.classRenameReferences(request.files.map(file => file.fileName), request.files.map(file => file.source), request.className, request.withBluePlay));
          self.postMessage({ id: request.id, ...references });
        }
      }).catch(error => self.postMessage({ id: request.id, transportError: error instanceof Error ? error.message : String(error) }));
      return;
    }
    hostReady.then(host => host.dispatch(request.id, request, message => self.postMessage(message)))
      .catch(error => self.postMessage({ id: request.id, generationId: request.generationId,
        transportError: error instanceof Error ? error.message : String(error) }));
  };
}
