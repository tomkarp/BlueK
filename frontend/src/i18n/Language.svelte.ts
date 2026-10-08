import { getContext, setContext } from "svelte";
import {
  catalogs,
  en,
  englishKeys,
  browserLocale,
  formatMessage,
  type Locale,
  type MessageKey,
} from "./catalog";
export type { Locale, MessageKey } from "./catalog";

export const languages: ReadonlyArray<{ value: Locale; name: string }> = [
  { value: "en", name: "English" },
  { value: "de", name: "Deutsch" },
];
const editorKeys: Record<string, MessageKey> = {
  Find: "ui.search.find",
  Replace: "ui.search.replace",
  next: "ui.search.next",
  previous: "ui.search.previous",
  all: "ui.search.all",
  "match case": "ui.search.matchCase",
  regexp: "ui.search.regexp",
  "by word": "ui.search.byWord",
  replace: "ui.search.replace2",
  "replace all": "ui.search.replaceAll",
  close: "ui.search.close",
  "Go to line": "ui.search.goToLine",
  go: "ui.search.go",
  "current match": "ui.search.currentMatch",
  "on line": "ui.search.onLine",
  "replaced $ matches": "ui.search.replacedMatches",
  "replaced match on line $": "ui.search.replacedMatchOnLine",
  "Control character": "ui.search.controlCharacter",
};
const context = Symbol("BlueK language");
const storageKey = "bluek-language";

/** Presentation state only. Project data and interpreter messages are not localized. */
export class Language {
  locale = $state<Locale>("en");
  private listeners = new Set<(language: Language) => void>();
  subscribe = (run: (language: Language) => void) => {
    this.listeners.add(run);
    run(this);
    return () => {
      this.listeners.delete(run);
    };
  };
  private notify() {
    for (const run of this.listeners) run(this);
  }
  restore() {
    const fallback = browserLocale(navigator.language);
    try {
      const saved = localStorage.getItem(storageKey);
      this.locale =
        saved && Object.hasOwn(catalogs, saved) ? (saved as Locale) : fallback;
    } catch {
      this.locale = fallback;
    }
    this.notify();
  }
  set = (locale: Locale) => {
    if (!Object.hasOwn(catalogs, locale)) return;
    this.locale = locale;
    this.notify();
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      /* Storage is optional. */
    }
  };
  t = (
    key: MessageKey,
    values: ReadonlyArray<string | number> = [],
  ): string => {
    const text = catalogs[this.locale][key] ?? en[key];
    return formatMessage(text, values);
  };
  get editorPhrases(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(editorKeys).map(([phrase, key]) => [phrase, this.t(key)]),
    );
  }
  /** For existing UI metadata. Unknown text is preserved, never machine-translated. */
  message = (text: string): string => {
    const key = englishKeys.get(text);
    if (key) return this.t(key);
    return text;
  };
}
export function provideLanguage(language: Language) {
  setContext(context, language);
}
export function useLanguage(): Language {
  return getContext<Language>(context);
}
