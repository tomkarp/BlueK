import enUi from "./en/ui.json";
import enHelp from "./en/help.json";
import enBlueplay from "./en/blueplay.json";
import deUi from "./de/ui.json";
import deHelp from "./de/help.json";
import deBlueplay from "./de/blueplay.json";

type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafKeys<T[K]>}`;
}[keyof T & string];
function flatten<T extends object>(source: T): Record<LeafKeys<T>, string> {
  const result: Record<string, string> = {};
  function visit(value: unknown, path: string) {
    if (typeof value === "string") result[path] = value;
    else if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value))
        visit(child, path ? `${path}.${key}` : key);
  }
  visit(source, "");
  return result as Record<LeafKeys<T>, string>;
}
export const en = flatten({ ui: enUi, help: enHelp, blueplay: enBlueplay });
export type MessageKey = keyof typeof en;
export const catalogs = {
  en,
  de: flatten({ ui: deUi, help: deHelp, blueplay: deBlueplay }),
} satisfies Record<string, Record<MessageKey, string>>;
export type Locale = keyof typeof catalogs;
export function browserLocale(language: string): Locale {
  const locale = language.toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(catalogs, locale) ? (locale as Locale) : "en";
}
// Only finite interface metadata is looked up by English text. Diagnostics bypass this.
export const englishKeys = new Map(
  Object.entries(en).map(([key, value]) => [value, key as MessageKey]),
);
export function formatMessage(
  text: string,
  values: ReadonlyArray<string | number> = [],
): string {
  return text.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(values[Number(index)] ?? `{${index}}`),
  );
}
export const englishText = (
  key: MessageKey,
  values: ReadonlyArray<string | number> = [],
) => formatMessage(en[key], values);

/** Inline catalog formatting only: no dynamic HTML or arbitrary links. */
export function richText(text: string): string {
  const tags =
    /(<\/?(?:strong|code)>|<a href="https:\/\/github\.com\/tomkarp\/BlueK\/[A-Za-z0-9_./?#=\-]+" target="_blank" rel="noopener noreferrer">|<\/a>)/g;
  return text
    .split(tags)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;"),
    )
    .join("");
}
