import { KotlinFormatterClient } from "./kotlinFormatterClient";
import { applyDiagnostics, editorDiagnostics } from "./editorDiagnostics";
import { vim } from "@replit/codemirror-vim";
import { minimalSetup } from "codemirror";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Compartment, EditorState, StateEffect } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder as editorPlaceholder,
} from "@codemirror/view";
import {
  defaultKeymap,
  history as historyExtension,
  historyKeymap,
  indentWithTab,
  toggleComment as toggleEditorComment,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  HighlightStyle,
  indentUnit,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { searchKeymap } from "@codemirror/search";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { markdownPreview } from "./markdownEditor";
import type { Diagnostic } from "../../runtime-contract/src/index";

export interface EditorActionHost {
  formatters: Map<string, () => boolean>;
  commenters: Map<string, () => boolean>;
  setFormatError: (message: string) => void;
}
// defaultHighlightStyle picks colors for a light background; a dark
// background needs its own palette or keywords/strings turn unreadable.
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c586c0" },
  {
    tag: [tags.name, tags.deleted, tags.character, tags.macroName],
    color: "#9cdcfe",
  },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "#dcdcaa" },
  {
    tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)],
    color: "#4fc1ff",
  },
  { tag: [tags.definition(tags.name), tags.separator], color: "#9cdcfe" },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.number,
      tags.changed,
      tags.annotation,
      tags.modifier,
      tags.self,
      tags.namespace,
    ],
    color: "#4ec9b0",
  },
  {
    tag: [
      tags.operator,
      tags.operatorKeyword,
      tags.url,
      tags.escape,
      tags.regexp,
      tags.link,
      tags.special(tags.string),
    ],
    color: "#d4d4d4",
  },
  { tag: [tags.meta, tags.comment], color: "#6a9955" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "#6a9955", textDecoration: "underline" },
  { tag: tags.heading, fontWeight: "bold", color: "#9cdcfe" },
  {
    tag: [tags.atom, tags.bool, tags.special(tags.variableName)],
    color: "#4fc1ff",
  },
  {
    tag: [tags.processingInstruction, tags.string, tags.inserted],
    color: "#ce9178",
  },
  { tag: tags.invalid, color: "#f44747" },
]);
const darkEditorTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#1e1e1e", color: "#d4d4d4" },
    ".cm-content": { caretColor: "#d4d4d4" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#d4d4d4" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "#264f78" },
    ".cm-gutters": {
      backgroundColor: "#1e1e1e",
      color: "#6e7681",
      border: "none",
    },
    ".cm-activeLine": { backgroundColor: "#2a2d2e" },
    ".cm-activeLineGutter": { backgroundColor: "#2a2d2e" },
  },
  { dark: true },
);
export type EditorOptions = {
  id: string;
  value: string;
  fontSize: number;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  // Each compile run bumps this, so the same error can be marked again after
  // the student edited the line and compiled once more.
  diagnosticsRun: number;
  vim: boolean;
  dark: boolean;
  editable?: boolean;
};

export function createEditorActions(host: EditorActionHost) {
  function codeMirror(node: HTMLElement, options: EditorOptions) {
    let current = options;
    let shownRun = -1;
    const formatter = new KotlinFormatterClient();
    let view: EditorView;
    let formatRequest = 0;
    const formatDocument = () => {
      host.setFormatError("");
      const request = ++formatRequest;
      const source = view.state.doc.toString();
      void formatter
        .format(source)
        .then((formatted) => {
          if (
            request !== formatRequest ||
            formatted === view.state.doc.toString()
          )
            return;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted },
            userEvent: "input.format",
          });
        })
        .catch((error: unknown) => {
          if (request === formatRequest) {
            const message =
              error instanceof Error ? error.message : String(error);
            const formatError = message.replaceAll(
              "com.facebook.ktfmt.format.",
              "",
            );
            // A parse error names line and column, so the editor marks that place
            // and scrolls to it, exactly as it does for a compiler error.
            host.setFormatError(formatError);
            const location = formatError.match(/(\d+):(\d+)/);
            if (location)
              applyDiagnostics(view, [
                {
                  line: Number(location[1]),
                  column: Number(location[2]),
                  severity: "error",
                  message: formatError,
                },
              ]);
          }
        });
      return true;
    };
    host.formatters.set(current.id, formatDocument);
    const toggleComments = () => toggleEditorComment(view);
    host.commenters.set(current.id, toggleComments);
    // Vim rebinds nearly every key, so it has to sit in front of the other
    // keymaps — a compartment keeps that place while it is switched on and off.
    const vimKeys = new Compartment();
    const editorTheme = new Compartment();
    const editorHighlight = new Compartment();
    const editorEditable = new Compartment();
    view = new EditorView({
      state: EditorState.create({
        doc: current.value,
        extensions: [
          vimKeys.of(current.vim ? vim({ status: true }) : []),
          editorEditable.of(EditorView.editable.of(current.editable !== false)),
          editorTheme.of(current.dark ? darkEditorTheme : []),
          editorHighlight.of(
            syntaxHighlighting(
              current.dark ? darkHighlightStyle : defaultHighlightStyle,
              { fallback: true },
            ),
          ),
          minimalSetup,
          lineNumbers(),
          indentUnit.of("    "),
          historyExtension(),
          closeBrackets(),
          bracketMatching(),
          drawSelection(),
          highlightActiveLine(),
          StreamLanguage.define(kotlin),
          editorDiagnostics(),
          keymap.of([
            ...defaultKeymap,
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...searchKeymap,
            { key: "Mod-Shift-i", run: formatDocument },
            indentWithTab,
          ]),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "var(--editor-font-size, 16px)",
            },
            ".cm-content, .cm-line, .cm-gutters, .cm-gutterElement": {
              fontSize: "var(--editor-font-size, 16px)",
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "Menlo, Monaco, Consolas, monospace",
            },
          }),
        ],
      }),
      parent: node,
    });
    const listener = EditorView.updateListener.of((update) => {
      if (update.docChanged) current.onChange(update.state.doc.toString());
    });
    view.dispatch({ effects: StateEffect.appendConfig.of(listener) });
    shownRun = current.diagnosticsRun;
    if (current.diagnostics.length) applyDiagnostics(view, current.diagnostics);
    const formatShortcut = (event: KeyboardEvent) => {
      if (
        (event.key.toLowerCase() !== "i" && event.code !== "KeyI") ||
        event.shiftKey ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey)
      )
        return;
      if (!node.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      formatDocument();
    };
    const germanCommentShortcut = (event: KeyboardEvent) => {
      if (
        (!event.metaKey && !event.ctrlKey) ||
        !event.shiftKey ||
        event.code !== "Digit7"
      )
        return;
      if (!node.contains(document.activeElement)) return;
      event.preventDefault();
      event.stopPropagation();
      toggleComments();
    };
    window.addEventListener("keydown", formatShortcut, true);
    window.addEventListener("keydown", germanCommentShortcut, true);
    view.focus();
    return {
      update(next: EditorOptions) {
        const previousId = current.id;
        const vimChanged = next.vim !== current.vim;
        const darkChanged = next.dark !== current.dark;
        const editableChanged = next.editable !== current.editable;
        current = next;
        if (vimChanged) {
          view.dispatch({
            effects: vimKeys.reconfigure(next.vim ? vim({ status: true }) : []),
          });
          view.focus();
        }
        if (darkChanged)
          view.dispatch({
            effects: [
              editorTheme.reconfigure(next.dark ? darkEditorTheme : []),
              editorHighlight.reconfigure(
                syntaxHighlighting(
                  next.dark ? darkHighlightStyle : defaultHighlightStyle,
                  { fallback: true },
                ),
              ),
            ],
          });
        if (editableChanged)
          view.dispatch({
            effects: editorEditable.reconfigure(
              EditorView.editable.of(next.editable !== false),
            ),
          });
        if (previousId !== next.id) {
          host.formatters.delete(previousId);
          host.formatters.set(next.id, formatDocument);
          host.commenters.delete(previousId);
          host.commenters.set(next.id, toggleComments);
        }
        if (next.value !== view.state.doc.toString())
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: next.value },
          });
        // After the document, so a doc change does not wipe the fresh marks.
        if (next.diagnosticsRun !== shownRun) {
          shownRun = next.diagnosticsRun;
          applyDiagnostics(view, next.diagnostics);
        }
        const fontSize = `${next.fontSize}px`;
        view.dom.style.fontSize = fontSize;
        view.dom
          .querySelector<HTMLElement>(".cm-gutters")
          ?.style.setProperty("font-size", fontSize);
        view.dom
          .querySelectorAll<HTMLElement>(".cm-gutterElement")
          .forEach((gutter) => {
            gutter.style.fontSize = fontSize;
          });
        const measure = () => view.requestMeasure();
        measure();
        requestAnimationFrame(() => {
          measure();
          requestAnimationFrame(() => {
            const gutters = view.dom.querySelector<HTMLElement>(".cm-gutters");
            if (!gutters) return;
            const lines = [
              ...view.dom.querySelectorAll<HTMLElement>(".cm-line"),
            ];
            const numbers = [
              ...gutters.querySelectorAll<HTMLElement>(
                ".cm-lineNumbers .cm-gutterElement",
              ),
            ];
            lines.forEach((line, index) => {
              const number = numbers.find(
                (item) => item.textContent?.trim() === String(index + 1),
              );
              if (number)
                number.style.height = `${line.getBoundingClientRect().height}px`;
            });
          });
        });
      },
      destroy() {
        ++formatRequest;
        host.formatters.delete(current.id);
        host.commenters.delete(current.id);
        window.removeEventListener("keydown", formatShortcut, true);
        window.removeEventListener("keydown", germanCommentShortcut, true);
        formatter.dispose();
        view.destroy();
      },
    };
  }
  return { codeMirror };
}

export function markdownEditor(
  node: HTMLElement,
  options: { value: string; onChange: (value: string) => void },
) {
  let current = options;
  const view = new EditorView({
    parent: node,
    state: EditorState.create({
      doc: options.value,
      extensions: [
        historyExtension(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        drawSelection(),
        EditorView.lineWrapping,
        editorPlaceholder(
          "Describe the project here. Markdown works: # Heading, **bold**, - list",
        ),
        markdownPreview(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) current.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
  // No focus on opening: the description is meant to be read first, and a
  // cursor in the first line would show that line's markers straight away.
  return {
    update(next: typeof options) {
      current = next;
      if (next.value !== view.state.doc.toString())
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next.value },
        });
    },
    destroy() {
      view.destroy();
    },
  };
}
