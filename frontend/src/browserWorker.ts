import { browserWorkerSource } from './runtimeClient';

// Keep the worker implementation in one place while letting Vite serve it as
// a real same-origin module. Safari is unreliable with module workers created
// from Blob URLs, especially when those workers import further modules.
new Function(browserWorkerSource)();
