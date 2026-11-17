import { acceptLegacyContentLinks } from "./legacyContentLinks";

/**
 * Browser tests use old hash links as project fixtures. Production builds do
 * not reload or import content from URL fragments.
 */
export function reloadOnLinkNavigation(playing = false): void {
  if (!acceptLegacyContentLinks) return;
  window.addEventListener("hashchange", () => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (playing || params.has("run") || params.has("bluek"))
      window.location.reload();
  });
}
