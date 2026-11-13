/** Kotlite bundle as gzip + base64, provided at build time by `frontend/build/embeddedKotlite.mjs`. */
declare module 'virtual:bluek-kotlite-gzip' {
  const kotliteGzipBase64: string;
  export default kotliteGzipBase64;
}

/** The built player runtime worker as script text, provided by `scripts/build-player.mjs`. */
declare module 'virtual:bluek-player-worker' {
  const playerWorkerSource: string;
  export default playerWorkerSource;
}

/** BluePlay project templates embedded in the desktop app build. */
declare module 'virtual:bluek-project-templates' {
  const templates: Record<string, unknown> | null;
  export default templates;
}
