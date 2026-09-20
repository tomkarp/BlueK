import { mount } from 'svelte';
import App from './SvelteApp.svelte';
import './style.css';

mount(App, { target: document.getElementById('root')! });
