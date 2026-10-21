# Interface languages

BlueK starts in the browser language when supported, otherwise in English. A
language explicitly selected in Settings takes precedence. The choice is stored
under
`bluek-language` in Local Storage, separately from projects and browser drafts.
If storage is unavailable, switching works for the current page; a new page
uses the browser language with English as fallback.

## Ownership

`SvelteApp` creates one `Language` instance and provides it through Svelte
context. It owns presentation state only. Its subscription adapter lets legacy
Svelte components react to the same instance; rune components read it directly.
No global language singleton or second runtime store is used.

Changing language updates labels, tooltips, dialogs, the bundled manual and
BluePlay API explanations. Editor language extensions are reconfigured without
replacing their documents, selections or undo history.
CodeMirror phrases retain their object identity while the locale is unchanged;
source edits must not reconfigure the language extension or reset Vim insert mode.

The diagram stereotype `«functions»` stays English in every language.
Kotlin source, generated Kotlin, identifiers, user README/content, program
output and compiler/runtime diagnostics remain unchanged. Runtime test errors
are displayed verbatim; finite UI status labels are translated. Native browser
confirmations/prompts receive localized UI text.

Compile diagnostics show the English message without the interpreter's internal
`SemanticException` class name (including subclasses such as
`TypeMismatchException`). Runtime exceptions retain their Kotlin class names.

## Adding or maintaining translations

- Each locale has three files in `frontend/src/i18n/<locale>/`:
  `ui.json` for interface text, `help.json` for the manual, and `blueplay.json`
  for API explanations. Nested groups follow dialogs, manual sections and API
  classes. Edit values; keys identify the text's role and stay stable when its
  wording changes. `catalog.ts` derives typed dotted keys from English.
- Write complete sentences or paragraphs. Do not split prose around emphasized
  words, code or links. Manual and replacement-warning messages may contain
  `<strong>`, `<code>` and repository links; `TranslatedText` renders them through
  an allowlist. Other HTML is escaped. Source code remains outside translations.
- Each locale must have the same keys. `{0}`, `{1}`, … substitute names or
  counts; preserve their indices in translations. CodeMirror phrases use `$`.
- Keep Kotlin keywords, canonical labels (`Open Class`, `Abstract Class`,
  `Data Class`) and identifiers intact: `open`, `abstract`, `data` and source
  names are not translated. For user-facing object members, use
  **Attribut** in German and **property** in English. Reserve *field* for an
  actual backing field, a form/input field or an implementation detail. In
  technical explanations, use Kotlin's precise terminology when that
  distinction matters. Translate other terms only when natural and useful;
  prefer the exact English term to an awkward literal translation.
- To add a language, copy the three English files into a new locale directory,
  import/register them in `catalog.ts`, and add its self-name to `languages` in
  `Language.svelte.ts`. The locale type and saved-language validation derive
  from registered catalogs. English is the fallback for missing messages.
- Components use `t` for typed keys. `message` translates recognized English UI
  metadata and preserves unknown text. Never translate Kotlin diagnostics or
  infer keys from program source.
- Keep translations bundled so hosted and offline BlueK use the same UI.

Run `npm run test:i18n`, `npm run typecheck`, the GUI-130 cases in
`tests/gui/localization.spec.ts`, and the offline language case after changes.
The catalog smoke check verifies keys, nonempty values, placeholders and safe rich-text rendering.
