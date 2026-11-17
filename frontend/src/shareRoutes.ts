export type ShareRoute = {
  kind: "bluek" | "run";
  code: string;
  basePath: string;
};

/** Return the app base for a retired load path, without treating it as a code route. */
export function retiredLoadPathBase(
  basePath: string,
  pageUrl: string,
): string | null {
  const page = new URL(pageUrl);
  const base = new URL(basePath, page).pathname;
  if (!page.pathname.startsWith(base)) return null;
  return /^(?:BlueK\/)?load\/[^/]+\/?$/.test(
    page.pathname.slice(base.length),
  )
    ? base
    : null;
}

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
    .match(/^(?:BlueK\/)?(bluek|run)\/([^/]+)\/?$/);
  // Codes are lowercase words; a capitalized link still opens, as in code import.
  return match
    ? {
        kind: match[1] as ShareRoute["kind"],
        code: match[2].toLowerCase(),
        basePath: base,
      }
    : null;
}
