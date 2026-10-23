/** Read-only compatibility window, explicitly accepted by the operator.
 * No shutdown date has been agreed. A later release can disable this one gate
 * for both IDE and player; no production UI may encode new content links.
 */
export const acceptLegacyContentLinks = true;
export function legacyContent(
  params: URLSearchParams,
  kind: "bluek" | "run",
): string | null {
  return acceptLegacyContentLinks ? params.get(kind) : null;
}
