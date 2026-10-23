import { PUBLIC_BLUEK_URL } from "./programExport";

/** Every share link opens the app base, including deployments below /BlueK/. */
export function applicationUrl(basePath: string, pageUrl: string): URL {
  const page = new URL(pageUrl);
  const url =
    page.protocol === "file:"
      ? new URL(PUBLIC_BLUEK_URL)
      : new URL(basePath, page);
  url.search = "";
  url.hash = "";
  return url;
}

export function shortShareUrl(
  kind: "bluek" | "run",
  code: string,
  basePath: string,
  pageUrl: string,
): URL {
  const url = applicationUrl(basePath, pageUrl);
  url.searchParams.set(kind === "run" ? "run" : "p", code.toLowerCase());
  return url;
}
