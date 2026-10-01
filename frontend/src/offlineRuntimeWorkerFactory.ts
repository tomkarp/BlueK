import workerSource from 'virtual:bluek-player-worker';

// Reuse one immutable source URL for the page's lifetime. WebKit still needs
// it after the Worker constructor returns; immediate revocation breaks startup.
// The browser releases the URL when the document unloads.
const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
export const createLocalRuntimeWorker = () => new Worker(workerUrl);
