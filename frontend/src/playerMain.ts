import { mount } from 'svelte';
import playerWorkerSource from 'virtual:bluek-player-worker';
import PlayerApp from './PlayerApp.svelte';
import { PROGRAM_ELEMENT_ID, parseEmbeddedProgram } from './programExport';

// Entry of the exported single-file player. The worker source travels as text
// and starts from a Blob URL, which also works for pages opened from file://.
const workerUrl = URL.createObjectURL(new Blob([playerWorkerSource], { type: 'text/javascript' }));
const target = document.getElementById('app')!;
try {
  const program = parseEmbeddedProgram(document.getElementById(PROGRAM_ELEMENT_ID)?.textContent);
  mount(PlayerApp, { target, props: { program, createWorker: () => new Worker(workerUrl) } });
} catch (error) {
  target.textContent = error instanceof Error ? error.message : String(error);
  target.setAttribute('role', 'alert');
}
