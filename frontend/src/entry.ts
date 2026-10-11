import { shareRoute } from "./shareRoutes";
import { reloadOnLinkNavigation } from "./linkNavigation";

const isProgramLink = () =>
  new URLSearchParams(window.location.hash.slice(1)).has("run") ||
  shareRoute(import.meta.env.BASE_URL, window.location.href)?.kind === "run";
const playing = isProgramLink();

// Choose the UI before loading it, so program links never initialize the IDE
// or touch its project drafts.
reloadOnLinkNavigation(playing);
async function openView() {
  if (playing) {
    await import("./hostedPlayerMain");
    return;
  }
  await import("./svelte-main");
}
void openView();
