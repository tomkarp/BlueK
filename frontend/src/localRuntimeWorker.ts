import { startRuntimeWorker } from './runtimeWorker';

const bundleUrl = new URL('../kotlite/bluek-kotlite-browser.js', import.meta.url);
startRuntimeWorker(() => fetch(bundleUrl)
  .then(response => { if (!response.ok) throw new Error('Could not load Kotlite.'); return response.text(); }));
