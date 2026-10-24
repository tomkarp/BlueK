import { parseProject, type SavedProject } from "./projectFormat";

export type HandoffProblem =
  | "unavailable"
  | "invalidRequest"
  | "noOpener"
  | "timeout"
  | "invalidProject"
  | "changed"
  | "sourceFailed";

const trustedOrigins = [
  "https://inf-schule.de",
  "https://www.inf-schule.de",
  "https://dev.inf-schule.de",
];
const enabled = import.meta.env.VITE_BLUEK_OFFLINE !== "1";

function trustedOrigin(origin: string): boolean {
  if (trustedOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** One opt-in, one-shot import from the exact window that opened this tab.
 * Neither a project URL nor project content is accepted from query parameters.
 * The provider fetches its own JSON and sends it only after our ready message.
 */
export function receiveProjectHandoff(options: {
  load: (project: SavedProject) => Promise<"loaded" | "cancelled" | "changed">;
  waiting: (waiting: boolean) => void;
  failed: (problem: HandoffProblem) => void;
  loaded: () => void;
}): () => void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("import")) return () => {};
  // A reload starts normally, and neither history nor a copied URL can replay
  // a completed handoff. Keep only the ordinary application base path.
  window.history.replaceState(window.history.state, "", url.pathname);
  const fail = (problem: HandoffProblem) => options.failed(problem);
  if (!enabled) {
    fail("unavailable");
    return () => {};
  }
  const sender = url.searchParams.get("sender");
  if (
    url.searchParams.get("import") !== "inf-schule" ||
    !sender ||
    !trustedOrigin(sender) ||
    url.hash ||
    [...url.searchParams.keys()].length !== 2
  ) {
    fail("invalidRequest");
    return () => {};
  }
  const opener: Window | null = window.opener;
  if (!opener || window.top !== window) {
    fail("noOpener");
    return () => {};
  }
  let finished = false;
  let timeout: number;
  const stop = () => {
    finished = true;
    window.clearTimeout(timeout);
    window.removeEventListener("message", message);
    options.waiting(false);
  };
  const result = (origin: string, status: "loaded" | "cancelled" | "error") => {
    opener.postMessage(
      { type: "bluek:handoff:result", version: 1, status },
      origin,
    );
  };
  const message = async (event: MessageEvent) => {
    if (
      finished ||
      !event.isTrusted ||
      event.source !== opener ||
      event.origin !== sender
    )
      return;
    const data: unknown = event.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const value = data as Record<string, unknown>;
    if (value.version !== 1) return;
    if (
      value.type === "bluek:handoff:cancel" &&
      Object.keys(value).length === 2
    ) {
      stop();
      fail("sourceFailed");
      return;
    }
    if (
      value.type !== "bluek:handoff:project" ||
      Object.keys(value).length !== 3 ||
      !("project" in value)
    )
      return;
    // Consume before parsing/loading, so duplicate messages cannot race imports.
    stop();
    let project: SavedProject;
    try {
      project = parseProject(value.project);
    } catch {
      result(event.origin, "error");
      fail("invalidProject");
      return;
    }
    try {
      const status = await options.load(project);
      result(event.origin, status === "changed" ? "error" : status);
      if (status === "changed") fail("changed");
      if (status === "loaded") options.loaded();
    } catch {
      result(event.origin, "error");
      fail("invalidProject");
    }
  };
  options.waiting(true);
  window.addEventListener("message", message);
  timeout = window.setTimeout(() => {
    stop();
    fail("timeout");
  }, 30_000);
  // The sender origin routes readiness, including local ports; it never grants
  // trust by itself. Above checks pin it to allowed hosts and the exact opener.
  opener.postMessage({ type: "bluek:handoff:ready", version: 1 }, sender);
  return stop;
}
