/** Old content-link decoding is enabled only for the browser test fixtures.
 * Production and ordinary development builds do not accept these links.
 */
export const acceptLegacyContentLinks =
  import.meta.env.VITE_BLUEK_TEST_LEGACY_CONTENT_LINKS === "1";
export function legacyContent(
  params: URLSearchParams,
  kind: "bluek" | "run",
): string | null {
  return acceptLegacyContentLinks ? params.get(kind) : null;
}
