import {
  acceptLegacyContentLinks,
  legacyContent,
} from "./legacyContentLinks";
import { retiredLoadPathBase, shareRoute } from "./shareRoutes";
import { reloadOnLinkNavigation } from "./linkNavigation";

const retiredBase = retiredLoadPathBase(
  import.meta.env.BASE_URL,
  window.location.href,
);
if (retiredBase) {
  window.history.replaceState(
    window.history.state,
    "",
    `${retiredBase}${window.location.search}${window.location.hash}`,
  );
}
if (!acceptLegacyContentLinks) {
  const fragments = new URLSearchParams(window.location.hash.slice(1));
  if (fragments.has("bluek") || fragments.has("run"))
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
}

const isProgramLink = () =>
  !new URLSearchParams(window.location.search).has("import") &&
  (Boolean(
    legacyContent(new URLSearchParams(window.location.hash.slice(1)), "run"),
  ) ||
    shareRoute(import.meta.env.BASE_URL, window.location.href)?.kind === "run");
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
