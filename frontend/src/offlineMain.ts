import { mount } from 'svelte';
import App from './SvelteApp.svelte';
import { reloadOnLinkNavigation } from './linkNavigation';

// Global CSS is inserted into the single HTML file by build-offline.mjs.
reloadOnLinkNavigation();
mount(App, { target: document.getElementById('root')! });
