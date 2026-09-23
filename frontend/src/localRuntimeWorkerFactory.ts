/** The IDE's runtime worker; Vite bundles it as a module worker next to the app. */
export const createLocalRuntimeWorker = () =>
  new Worker(new URL('./localRuntimeWorker.ts', import.meta.url), { type: 'module' });
