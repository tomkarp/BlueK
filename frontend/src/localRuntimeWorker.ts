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
      const files = request.files || [];
      const source = files.map((file: any) => `// BlueK file: ${file.fileName}\n${file.source}`).join('\n\n');
      response = JSON.parse(session.load('<BlueK project>', source));
      if (response.kind !== 'error') {
        const manifest = JSON.parse(session.manifest());
        const functionMeta = manifest.functions || [];
        const functionCards = files.filter((file: any) => file.kind === 'functions').map((file: any) => {
          const names = [...String(file.source || '').matchAll(/\bfun\s+([A-Za-z_]\w*)/g)].map(match => match[1]);
          const methods = functionMeta.filter((method: any) => names.includes(method.name)).map((method: any, index: number) => ({ ...method, id: `${file.fileName}.${method.name}.${index}`, declaringType: file.fileName }));
          return { id: file.fileName, name: file.fileName.replace(/\.kt$/, ''), kind: 'functions', modifiers: [], typeParameters: [], supertypes: [], constructors: [], properties: [], methods };
        });
        response.classes = [...(manifest.classes || []), ...functionCards];
      }
      self.postMessage({ id: request.id, response: response || { kind: 'loaded', display: 'Unit' } });
      return;
    }
    if (request.op === 'key') response = JSON.parse(activeSession.setKey(request.key || '', Boolean(request.pressed)));
    else if (request.op === 'click') response = JSON.parse(activeSession.setClick(Number(request.x) || 0, Number(request.y) || 0));
    else if (request.op === 'eval') response = JSON.parse(activeSession.evaluate(request.filename || '<Codepad>', request.code || ''));
    else if (request.op === 'main') response = JSON.parse(activeSession.evaluate(request.filename || '<Main>', 'main()'));
    else if (request.op === 'create') response = JSON.parse(activeSession.create(request.className, request.args || '', request.name || 'object'));
    else if (request.op === 'invoke') response = JSON.parse(activeSession.invoke(request.objectId, request.methodName, request.args || ''));
    else if (request.op === 'inspect') response = JSON.parse(activeSession.inspect(request.objectId));
    else if (request.op === 'remove') response = JSON.parse(activeSession.remove(request.objectId));
    else if (request.op === 'reset') response = JSON.parse(activeSession.reset());
    else response = { kind: 'unit', display: 'Unit' };
    response.output = activeSession.takeOutput();
    const stage = activeSession.takeStage();
    if (stage) response.stage = JSON.parse(stage);
    self.postMessage({ id: request.id, response });
  } catch (error) {
    self.postMessage({ id: request.id, response: { kind: 'error', display: error instanceof Error ? error.message : String(error) } });
  }
};
