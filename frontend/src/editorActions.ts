import { KotlinFormatterClient } from "./kotlinFormatterClient";
import { applyDiagnostics, editorDiagnostics } from "./editorDiagnostics";
import { vim } from "@replit/codemirror-vim";
import { minimalSetup } from "codemirror";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { Compartment, EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  Decoration,
  GutterMarker,
  gutter,
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
  breakpointTogglers: Map<string, () => void>;
  debugNavigators: Map<string, (line: number, column: number) => void>;
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
  phrases?: Record<string, string>;
  id: string;
  fileId?: string;
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
  breakpointEditable?: boolean;
  breakpointLines?: number[];
  onBreakpointToggle?: (fileId: string, line: number) => void;
  onBreakpointsChange?: (fileId: string, lines: number[]) => void;
  debugLine?: number | null;
};

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const marker = document.createElement("span");
    marker.className = "cm-breakpoint-marker";
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }
  eq(other: GutterMarker) { return other instanceof BreakpointMarker; }
}
function createDebugMarker(withBreakpoint: boolean) {
  const marker = document.createElement("span");
  marker.className = `cm-debug-marker${withBreakpoint ? " cm-combined-debug-marker" : ""}`;
  const arrowMarker = document.createElement("span");
  arrowMarker.className = "cm-debug-arrow-marker";
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.setAttribute("viewBox", "0 0 24 24");
  arrow.setAttribute("aria-hidden", "true");
  const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  outline.setAttribute("d", "M1 1h14l8 11-8 11H1z");
  outline.setAttribute("fill", "currentColor");
  arrow.append(outline);
  arrowMarker.append(arrow);
  marker.append(arrowMarker);
  if (withBreakpoint) {
    const breakpoint = document.createElement("span");
    breakpoint.className = "cm-breakpoint-marker";
    marker.append(breakpoint);
  }
  marker.setAttribute("aria-hidden", "true");
  return marker;
}
class DebugArrowMarker extends GutterMarker {
  toDOM() { return createDebugMarker(false); }
  eq(other: GutterMarker) { return other instanceof DebugArrowMarker; }
}
class CombinedDebugMarker extends GutterMarker {
  toDOM() { return createDebugMarker(true); }
  eq(other: GutterMarker) { return other instanceof CombinedDebugMarker; }
}
class BreakpointSpacer extends GutterMarker {
  toDOM() {
    const spacer = document.createElement("span");
    spacer.className = "cm-breakpoint-spacer";
    spacer.setAttribute("aria-hidden", "true");
    return spacer;
  }
  eq(other: GutterMarker) { return other instanceof BreakpointSpacer; }
}
const breakpointMarker = new BreakpointMarker();
const debugArrowMarker = new DebugArrowMarker();
const combinedDebugMarker = new CombinedDebugMarker();
const breakpointSpacer = new BreakpointSpacer();

export function createEditorActions(host: EditorActionHost) {
  function codeMirror(node: HTMLElement, options: EditorOptions) {
    let current = options;
    let shownRun = -1;
    const formatter = new KotlinFormatterClient();
    let view: EditorView;
    let applyingExternalDocument = false;
    let formatRequest = 0;
    const canToggleBreakpoint = () => current.breakpointEditable ?? current.editable !== false;
    const formatDocument = () => {
      if (current.editable === false) return false;
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
    const toggleComments = () => {
      if (current.editable === false) return false;
      return toggleEditorComment(view);
    };
    host.commenters.set(current.id, toggleComments);
    // Vim rebinds nearly every key, so it has to sit in front of the other
    // keymaps — a compartment keeps that place while it is switched on and off.
    const vimKeys = new Compartment();
    const editorTheme = new Compartment();
    const editorHighlight = new Compartment();
    const editorEditable = new Compartment();
    const editorLanguage = new Compartment();
    const setBreakpointLines = StateEffect.define<number[]>();
    const setDebugLine = StateEffect.define<number | null>();
    const breakpointField = StateField.define<Set<number>>({
      create: (state) => new Set((current.breakpointLines || []).filter((line) => line > 0 && line <= state.doc.lines).map((line) => state.doc.line(line).from)),
      update: (value, transaction) => {
        let next = value;
        if (transaction.docChanged) {
          const mapped = new Set<number>();
          for (const position of value) {
            const oldLine = transaction.startState.doc.lineAt(position);
            let removed = false;
            transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              if (fromA === 0 && toA === transaction.startState.doc.length) removed = true;
              else if (toA > fromA && fromA <= oldLine.from && toA >= oldLine.to && inserted.length === 0) removed = true;
            });
            if (!removed) mapped.add(transaction.changes.mapPos(position, 1));
          }
          next = mapped;
        }
        for (const effect of transaction.effects) {
          if (effect.is(setBreakpointLines))
            next = new Set(effect.value.filter((line) => line > 0 && line <= transaction.state.doc.lines).map((line) => transaction.state.doc.line(line).from));
        }
        return next;
      },
    });
    const debugLineField = StateField.define<number | null>({
      create: (state) => current.debugLine && current.debugLine > 0 && current.debugLine <= state.doc.lines
        ? state.doc.line(current.debugLine).from
        : null,
      update: (position, transaction) => {
        let next = position === null ? null : transaction.docChanged ? transaction.changes.mapPos(position, 1) : position;
        for (const effect of transaction.effects) {
          if (effect.is(setDebugLine)) {
            const line = effect.value;
            next = line && line > 0 && line <= transaction.state.doc.lines
              ? transaction.state.doc.line(line).from
              : null;
          }
        }
        return next;
      },
      provide: (field) => EditorView.decorations.compute([field], (state) => {
        const position = state.field(field);
        return position === null
          ? Decoration.none
          : Decoration.set([Decoration.line({ class: "cm-debug-current-line" }).range(state.doc.lineAt(position).from)]);
      }),
    });
    const breakpointGutter = gutter({
      class: "cm-breakpoint-gutter",
      renderEmptyElements: true,
      initialSpacer: () => breakpointSpacer,
      lineMarker: (editorView, line) => {
        const hasBreakpoint = editorView.state.field(breakpointField).has(line.from);
        const hasDebugArrow = editorView.state.field(debugLineField) === line.from;
        if (hasBreakpoint && hasDebugArrow) return combinedDebugMarker;
        if (hasBreakpoint) return breakpointMarker;
        if (hasDebugArrow) return debugArrowMarker;
        return null;
      },
      lineMarkerChange: (update) => update.startState.field(breakpointField) !== update.state.field(breakpointField) || update.startState.field(debugLineField) !== update.state.field(debugLineField),
      domEventHandlers: {
        mousedown: (_editorView, line, event) => {
          if ((event as MouseEvent).button !== 0) return false;
          if (!canToggleBreakpoint()) return false;
          if (!_editorView.state.doc.lineAt(line.from).text.trim()) return true;
          event.preventDefault();
          current.onBreakpointToggle?.(current.fileId || current.id, _editorView.state.doc.lineAt(line.from).number);
          return true;
        },
      },
    });
    const toggleBreakpointAtCursor = () => {
      if (!canToggleBreakpoint()) return;
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      if (!line.text.trim()) return;
      current.onBreakpointToggle?.(current.fileId || current.id, line.number);
    };
    host.breakpointTogglers.set(current.id, toggleBreakpointAtCursor);
    const revealPosition = (line: number, column: number) => {
      if (line > 0 && line <= view.state.doc.lines)
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line).from + Math.max(0, column - 1), { y: "center" }) });
    };
    host.debugNavigators.set(current.id, revealPosition);
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
          editorLanguage.of(EditorState.phrases.of(current.phrases ?? {})),
          minimalSetup,
          lineNumbers(),
          breakpointField,
          debugLineField,
          breakpointGutter,
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
            ".cm-breakpoint-gutter .cm-gutterElement": { cursor: "pointer", width: "1.2em" },
            ".cm-breakpoint-marker": { color: "#d83b3b", fontSize: "0.8em", lineHeight: "1.7em" },
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
      if (update.docChanged && !applyingExternalDocument) {
        current.onChange(update.state.doc.toString());
        const lines = [...update.state.field(breakpointField)].map((position) => update.state.doc.lineAt(position).number).sort((a, b) => a - b);
        current.onBreakpointsChange?.(current.fileId || current.id, lines);
      }
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
        const fileChanged = next.fileId !== current.fileId;
        const breakpointLinesChanged = fileChanged || (next.breakpointLines || []).join(",") !== (current.breakpointLines || []).join(",");
        const debugLineChanged = next.debugLine !== current.debugLine || next.fileId !== current.fileId;
        if (next.phrases !== current.phrases)
          view.dispatch({
            effects: editorLanguage.reconfigure(
              EditorState.phrases.of(next.phrases ?? {}),
            ),
          });
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
          host.breakpointTogglers.delete(previousId);
          host.breakpointTogglers.set(next.id, toggleBreakpointAtCursor);
          host.debugNavigators.delete(previousId);
          host.debugNavigators.set(next.id, revealPosition);
        }
        if (next.value !== view.state.doc.toString()) {
          applyingExternalDocument = true;
          try {
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: next.value },
            });
          } finally {
            applyingExternalDocument = false;
          }
        }
        if (breakpointLinesChanged) view.dispatch({ effects: setBreakpointLines.of(next.breakpointLines || []) });
        if (debugLineChanged) view.dispatch({ effects: setDebugLine.of(next.debugLine ?? null) });
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
        host.breakpointTogglers.delete(current.id);
        host.debugNavigators.delete(current.id);
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
  options: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  },
) {
  let current = options;
  const hint = new Compartment();
  const view = new EditorView({
    parent: node,
    state: EditorState.create({
      doc: options.value,
      extensions: [
        historyExtension(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        drawSelection(),
        EditorView.lineWrapping,
        hint.of(
          editorPlaceholder(
            options.placeholder ??
              "Describe the project here. Markdown works: # Heading, **bold**, - list",
          ),
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
      if (next.placeholder !== current.placeholder)
        view.dispatch({
          effects: hint.reconfigure(
            editorPlaceholder(
              next.placeholder ??
                "Describe the project here. Markdown works: # Heading, **bold**, - list",
            ),
          ),
        });
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
