import { mount } from 'svelte';
import App from './SvelteApp.svelte';

// Global CSS is inserted into the single HTML file by build-offline.mjs.
mount(App, { target: document.getElementById('root')! });
