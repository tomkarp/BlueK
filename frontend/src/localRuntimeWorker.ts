/* The only runtime worker used by BlueK. It loads the bundled Kotlite
 * interpreter from /kotlite and never contacts a server. */
const bundleUrl = new URL('../kotlite/bluek-kotlite-browser.js', import.meta.url);
const apiReady = fetch(bundleUrl)
  .then(response => response.text())
  .then(bundleSource => {
    (0, eval)(bundleSource);
    return (globalThis as any)['bluek-kotlite-browser'];
  });
let session: any;
const getSession = async () => session || (session = (await apiReady).bluekCreateKotliteSession());

self.onmessage = async event => {
  const request = event.data || {};
  try {
    const api = await apiReady;
    let activeSession = await getSession();
    let response;
    if (request.op === 'compile') {
      session = api.bluekCreateKotliteSession();
      activeSession = session;
      for (const file of request.files || []) {
        response = JSON.parse(session.load(file.fileName, file.source));
        if (response.kind === 'error') break;
      }
      self.postMessage({ id: request.id, response: response || { kind: 'loaded', display: 'Unit' } });
      return;
    }
    if (request.op === 'eval') response = JSON.parse(activeSession.evaluate(request.filename || '<Codepad>', request.code || ''));
    else if (request.op === 'create') response = JSON.parse(activeSession.create(request.className, request.args || '', request.name || 'object'));
    else if (request.op === 'invoke') response = JSON.parse(activeSession.invoke(request.objectId, request.methodName, request.args || ''));
    else if (request.op === 'inspect') response = JSON.parse(activeSession.inspect(request.objectId));
    else if (request.op === 'remove') response = JSON.parse(activeSession.remove(request.objectId));
    else if (request.op === 'reset') response = JSON.parse(activeSession.reset());
    else response = { kind: 'unit', display: 'Unit' };
    response.output = activeSession.takeOutput();
    self.postMessage({ id: request.id, response });
  } catch (error) {
    self.postMessage({ id: request.id, response: { kind: 'error', display: error instanceof Error ? error.message : String(error) } });
  }
};
