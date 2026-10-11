/**
 * Opening a project or program link on the same page changes only the hash.
 * Reload so the page starts the matching UI and its normal link import; the
 * IDE stores its draft on pagehide. A player reloads on every hash change.
 */
export function reloadOnLinkNavigation(playing = false): void {
  window.addEventListener("hashchange", () => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (playing || params.has("run") || params.has("bluek"))
      window.location.reload();
  });
}
