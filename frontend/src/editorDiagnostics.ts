// A compiler error belongs where the mistake is: the editor marks the line it
// happened on, instead of sending the student to a separate window that hides
// the code they have to fix. The message itself is printed below the editor,
// where the formatter reports its parse errors as well.
import { StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { Diagnostic } from "../../runtime-contract/src/index";

export const setEditorDiagnostics = StateEffect.define<Diagnostic[]>();

const errorLine = Decoration.line({ class: "cm-bluek-error-line" });
const errorSpan = Decoration.mark({ class: "cm-bluek-error-span" });

function decorate(state: EditorState, diagnostics: Diagnostic[]): DecorationSet {
  const byLine = new Map<number, Diagnostic[]>();
  for (const item of diagnostics) {
    const number = Math.min(Math.max(1, item.line || 1), state.doc.lines);
    byLine.set(number, [...(byLine.get(number) || []), item]);
  }
  const ranges: Range<Decoration>[] = [];
  for (const [number, items] of byLine) {
    const line = state.doc.line(number);
    ranges.push(errorLine.range(line.from));
    const column = Math.min(Math.max(1, items[0].column || 1), line.text.length + 1);
    const from = line.from + column - 1;
    // Underline the word the compiler points at, or the rest of the line when
    // it points at punctuation or at the end of the line.
    const word = line.text.slice(column - 1).match(/^[\p{L}\p{N}_$]+/u);
    const to = word ? from + word[0].length : line.from + line.text.trimEnd().length;
    if (to > from) ranges.push(errorSpan.range(from, to));
  }
  return Decoration.set(ranges, true);
}

const diagnosticDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects)
      if (effect.is(setEditorDiagnostics)) return decorate(transaction.state, effect.value);
    // Editing is how the error gets fixed, so the marks go as soon as the text
    // changes — a marker that stayed behind would point at the wrong code.
    if (transaction.docChanged) return Decoration.none;
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const diagnosticTheme = EditorView.theme({
  ".cm-bluek-error-line": { backgroundColor: "#fdecec" },
  ".cm-bluek-error-span": {
    textDecoration: "underline wavy #cc0000",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
});

export function editorDiagnostics() {
  return [diagnosticDecorations, diagnosticTheme];
}

/** Marks the lines of the given errors and scrolls to the first one. */
export function applyDiagnostics(view: EditorView, diagnostics: Diagnostic[]) {
  const effects: StateEffect<unknown>[] = [setEditorDiagnostics.of(diagnostics)];
  if (diagnostics.length) {
    const number = Math.min(Math.max(1, diagnostics[0].line || 1), view.state.doc.lines);
    effects.push(EditorView.scrollIntoView(view.state.doc.line(number).from, { y: "center" }));
  }
  view.dispatch({ effects });
}
