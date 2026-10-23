export type ShareRoute = {
  kind: "bluek" | "run" | "load";
  code: string;
  basePath: string;
};

/** Recognize share paths below the configured app base, including /BlueK/. */
export function shareRoute(
  basePath: string,
  pageUrl: string,
): ShareRoute | null {
  const page = new URL(pageUrl);
  const base = new URL(basePath, page).pathname;
  if (!page.pathname.startsWith(base)) return null;
  const query = page.searchParams.get("run") ?? page.searchParams.get("p");
  if (query !== null) return {
    kind: page.searchParams.has("run") ? "run" : "bluek",
    code: query.toLowerCase(), basePath: base,
  };
  const match = page.pathname
    .slice(base.length)
    .match(/^(?:BlueK\/)?(bluek|run|load)\/([^/]+)\/?$/);
  // Codes are lowercase words; a capitalized link still opens, as in code import.
  return match
    ? {
        kind: match[1] as ShareRoute["kind"],
        code: match[2].toLowerCase(),
        basePath: base,
      }
    : null;
}
