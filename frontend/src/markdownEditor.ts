// The README is written the way Typora or Nextcloud write Markdown: what the
// document contains is Markdown, and it is formatted while it is typed. The
// markers stay part of the text — they are only hidden on the lines the cursor
// is not on, so a heading level can still be corrected where it was written.
// Nothing here becomes HTML: the text stays text and only carries CSS classes.
import { StringStream } from "@codemirror/language";
import { StateEffect, StateField, type EditorState } from "@codemirror/state";
import { kotlin as kotlinMode } from "@codemirror/legacy-modes/mode/clike";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

export type MarkdownMark =
  | { kind: "line"; line: number; class: string }
  | { kind: "hidden"; from: number; to: number }
  | { kind: "hiddenLine"; line: number; from: number; to: number }
  | { kind: "bullet"; from: number; to: number }
  | { kind: "span"; from: number; to: number; class: string };

const HEADING = /^(#{1,6})(\s+)/;
const QUOTE = /^\s*>\s?/;
const BULLET = /^(\s*)([-*+])(\s)/;
const ORDERED = /^(\s*)(\d+[.)])(\s)/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*```/;

function inlineMarks(text: string, from: number, start: number, active: boolean, marks: MarkdownMark[]) {
  const taken: Array<[number, number]> = [];
  const scan = (pattern: RegExp, apply: (match: RegExpExecArray) => void) => {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      const end = match.index + match[0].length;
      if (match.index < start || taken.some(([a, b]) => match!.index < b && end > a)) continue;
      taken.push([match.index, end]);
      apply(match);
    }
  };
  const around = (match: RegExpExecArray, width: number, className: string) => {
    const at = from + match.index, end = at + match[0].length;
    marks.push({ kind: "span", from: at + width, to: end - width, class: className });
    if (active) return;
    marks.push({ kind: "hidden", from: at, to: at + width });
    marks.push({ kind: "hidden", from: end - width, to: end });
  };
  // Code spans first: inside them no other marker counts.
  scan(/`([^`]+)`/g, (match) => {
    const at = from + match.index, end = at + match[0].length;
    marks.push({ kind: "span", from: at, to: end, class: "cm-md-code-span" });
    if (active) return;
    marks.push({ kind: "hidden", from: at, to: at + 1 });
    marks.push({ kind: "hidden", from: end - 1, to: end });
  });
  scan(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match) => {
    const at = from + match.index, label = at + 1 + match[1].length;
    marks.push({ kind: "span", from: at + 1, to: label, class: "cm-md-link" });
    if (active) return;
    marks.push({ kind: "hidden", from: at, to: at + 1 });
    marks.push({ kind: "hidden", from: label, to: at + match[0].length });
  });
  scan(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, (match) => around(match, 2, "cm-md-strong"));
  scan(/(?<![\w\\])__(?=\S)([\s\S]*?\S)__(?!\w)/g, (match) => around(match, 2, "cm-md-strong"));
  scan(/\*(?=\S)([^*]*?\S)\*/g, (match) => around(match, 1, "cm-md-em"));
  // Inside a word an underscore belongs to a name like `max_wert`, not to emphasis.
  scan(/(?<![\w\\])_(?=\S)([^_]*?\S)_(?!\w)/g, (match) => around(match, 1, "cm-md-em"));
}

/** The fenced code blocks of a document, as line numbers including the fences. */
function codeRegions(lines: string[]) {
  const regions: Array<{ start: number; end: number; language: string }> = [];
  let open: { start: number; language: string } | undefined;
  lines.forEach((text, index) => {
    if (!FENCE.test(text)) return;
    if (open) {
      regions.push({ start: open.start, end: index + 1, language: open.language });
      open = undefined;
    } else open = { start: index + 1, language: (text.match(/^\s*`{3,}\s*([\w+#-]*)/)?.[1] || "").toLowerCase() };
  });
  // A fence that was opened but not closed still formats the rest as code.
  if (open) regions.push({ start: open.start, end: lines.length, language: open.language });
  return regions;
}

/** Consecutive quoted lines belong together, like the lines of a code block. */
function quoteRegions(lines: string[], inCode: (line: number) => boolean) {
  const regions: Array<{ start: number; end: number }> = [];
  let start = 0;
  lines.forEach((text, index) => {
    const quoted = !inCode(index + 1) && QUOTE.test(text);
    if (quoted && !start) start = index + 1;
    if (!quoted && start) {
      regions.push({ start, end: index });
      start = 0;
    }
  });
  if (start) regions.push({ start, end: lines.length });
  return regions;
}

// A block is edited as a whole: standing anywhere inside a code block or a
// quote, its markers belong on screen — the fences of a code block above all,
// because without them it is not visible where the code ends.
function expandToRegions(active: Set<number>, regions: Array<{ start: number; end: number }>) {
  for (const region of regions) {
    let touched = false;
    for (let line = region.start; line <= region.end && !touched; line++) touched = active.has(line);
    if (touched) for (let line = region.start; line <= region.end; line++) active.add(line);
  }
}

// The same names the Kotlin editor colours, so code reads the same everywhere.
const TOKEN_CLASS: Record<string, string> = {
  keyword: "keyword", atom: "atom", number: "number", def: "def", type: "type",
  "variable-3": "type", "variable-2": "variable2", string: "string", "string-2": "string2",
  comment: "comment", meta: "meta", operator: "operator",
};

function codeMarks(text: string, from: number, state: unknown, marks: MarkdownMark[]) {
  if (!text.trim()) {
    kotlinMode.blankLine?.(state as never, 4);
    return;
  }
  const stream = new StringStream(text, 4, 4);
  while (!stream.eol()) {
    const at = stream.pos;
    const token = kotlinMode.token(stream, state as never);
    if (stream.pos === at) {
      stream.next();
      continue;
    }
    const name = token && TOKEN_CLASS[token.split(" ")[0]];
    if (name) marks.push({ kind: "span", from: from + at, to: from + stream.pos, class: `cm-md-tok-${name}` });
    stream.start = stream.pos;
  }
}

/**
 * What the document looks like when it is formatted: one entry per styled line,
 * marker to hide and text to emphasise. `activeLines` are the lines the cursor
 * touches; their markers stay visible so they can be edited, and a cursor inside
 * a code block or a quote reveals that whole block.
 */
export function markdownMarks(doc: string, activeLines: Set<number> = new Set()): MarkdownMark[] {
  const marks: MarkdownMark[] = [];
  const lines = doc.split("\n");
  const code = codeRegions(lines);
  const codeOf = (line: number) => code.find((region) => line >= region.start && line <= region.end);
  const active = new Set(activeLines);
  expandToRegions(active, code);
  expandToRegions(active, quoteRegions(lines, (line) => Boolean(codeOf(line))));
  let offset = 0;
  let codeState: unknown = null;
  lines.forEach((text, index) => {
    const line = index + 1, from = offset;
    offset += text.length + 1;
    const region = codeOf(line);
    if (region) {
      const fence = line === region.start || line === region.end;
      marks.push({ kind: "line", line, class: fence ? "cm-md-code-block cm-md-fence" : "cm-md-code-block" });
      if (line === region.start) codeState = kotlinMode.startState?.(4) ?? null;
      // Outside the block the fences are noise; inside they mark where it ends.
      // An empty block keeps them, or there would be no way back into it.
      if (fence && !active.has(line) && region.end > region.start + 1)
        marks.push({ kind: "hiddenLine", line, from, to: from + text.length });
      else if (!fence && codeState && (!region.language || region.language === "kotlin" || region.language === "kt"))
        codeMarks(text, from, codeState, marks);
      return;
    }
    const isActive = active.has(line);
    const heading = text.match(HEADING);
    if (heading) {
      marks.push({ kind: "line", line, class: `cm-md-h${heading[1].length}` });
      if (!isActive) marks.push({ kind: "hidden", from, to: from + heading[0].length });
      inlineMarks(text, from, heading[0].length, isActive, marks);
      return;
    }
    const quote = text.match(QUOTE);
    if (quote) {
      marks.push({ kind: "line", line, class: "cm-md-quote" });
      if (!isActive) marks.push({ kind: "hidden", from, to: from + quote[0].length });
      inlineMarks(text, from, quote[0].length, isActive, marks);
      return;
    }
    if (RULE.test(text)) {
      marks.push({ kind: "line", line, class: "cm-md-rule" });
      if (!isActive && text.length) marks.push({ kind: "hidden", from, to: from + text.length });
      return;
    }
    const bullet = text.match(BULLET);
    if (bullet) {
      marks.push({ kind: "line", line, class: "cm-md-list" });
      const at = from + bullet[1].length;
      if (!isActive) marks.push({ kind: "bullet", from: at, to: at + 1 });
      inlineMarks(text, from, bullet[0].length, isActive, marks);
      return;
    }
    const ordered = text.match(ORDERED);
    if (ordered) {
      marks.push({ kind: "line", line, class: "cm-md-list" });
      const at = from + ordered[1].length;
      marks.push({ kind: "span", from: at, to: at + ordered[2].length, class: "cm-md-marker" });
      inlineMarks(text, from, ordered[0].length, isActive, marks);
      return;
    }
    inlineMarks(text, from, 0, isActive, marks);
  });
  return marks;
}

class BulletWidget extends WidgetType {
  toDOM() {
    const bullet = document.createElement("span");
    bullet.className = "cm-md-bullet";
    bullet.textContent = "•";
    return bullet;
  }
  eq() {
    return true;
  }
}

const hidden = Decoration.replace({});
const hiddenLine = Decoration.replace({ block: true });
const bullet = Decoration.replace({ widget: new BulletWidget() });

function decorate(state: EditorState, focused: boolean): DecorationSet {
  // Without focus there is no cursor, so nothing has to reveal its markers.
  const active = new Set<number>();
  if (focused)
    for (const range of state.selection.ranges)
      for (let line = state.doc.lineAt(range.from).number; line <= state.doc.lineAt(range.to).number; line++)
        active.add(line);
  const ranges = markdownMarks(state.doc.toString(), active).map((mark) =>
    mark.kind === "line"
      ? Decoration.line({ class: mark.class }).range(state.doc.line(mark.line).from)
      : mark.kind === "hidden"
        ? hidden.range(mark.from, mark.to)
        : mark.kind === "hiddenLine"
          ? hiddenLine.range(mark.from, mark.to)
          : mark.kind === "bullet"
            ? bullet.range(mark.from, mark.to)
            : Decoration.mark({ class: mark.class }).range(mark.from, mark.to),
  );
  return Decoration.set(ranges, true);
}

const setFocused = StateEffect.define<boolean>();

// A hidden fence is a block decoration, and those may only come from state, not
// from a view plugin — so the focus has to live in the state as well.
const focused = StateField.define<boolean>({
  create: () => false,
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setFocused)) return effect.value;
    return value;
  },
});

const formatting = StateField.define<DecorationSet>({
  create: (state) => decorate(state, false),
  update: (_, transaction) => decorate(transaction.state, transaction.state.field(focused)),
  provide: (field) => EditorView.decorations.from(field),
});

const theme = EditorView.theme({
  "&": { fontSize: "15px" },
  ".cm-content": { fontFamily: "Arial,Helvetica,sans-serif", lineHeight: "1.55", padding: "10px 4px" },
  ".cm-line": { padding: "0 6px" },
  ".cm-md-h1, .cm-md-h2, .cm-md-h3, .cm-md-h4, .cm-md-h5, .cm-md-h6": { fontWeight: "bold" },
  ".cm-md-h1": { fontSize: "1.65em" },
  ".cm-md-h2": { fontSize: "1.35em" },
  ".cm-md-h3": { fontSize: "1.15em" },
  ".cm-md-strong": { fontWeight: "bold" },
  ".cm-md-em": { fontStyle: "italic" },
  ".cm-md-link": { color: "#0b6fa4", textDecoration: "underline" },
  ".cm-md-marker": { color: "#999" },
  ".cm-md-bullet": { color: "#666" },
  ".cm-md-code-span": { fontFamily: "Menlo,Monaco,Consolas,monospace", fontSize: ".92em", background: "#f2f1ed", borderRadius: "3px" },
  ".cm-md-code-block": { fontFamily: "Menlo,Monaco,Consolas,monospace", fontSize: ".92em", background: "#f2f1ed" },
  ".cm-md-fence": { color: "#aaa" },
  // The colours of the Kotlin editor, so code reads the same in both places.
  ".cm-md-tok-keyword": { color: "#708" },
  ".cm-md-tok-atom": { color: "#219" },
  ".cm-md-tok-number": { color: "#164" },
  ".cm-md-tok-def": { color: "#00f" },
  ".cm-md-tok-type": { color: "#085" },
  ".cm-md-tok-variable2": { color: "#05a" },
  ".cm-md-tok-string": { color: "#a11" },
  ".cm-md-tok-string2": { color: "#f50" },
  ".cm-md-tok-comment": { color: "#a50" },
  ".cm-md-tok-meta": { color: "#555" },
  ".cm-md-tok-operator": { color: "#666" },
  ".cm-md-list": { paddingLeft: "22px", textIndent: "-12px" },
  ".cm-md-quote": { paddingLeft: "12px", borderLeft: "4px solid #ddd", color: "#555" },
  ".cm-md-rule": { borderBottom: "1px solid #ccc" },
});

/** Formats Markdown while it is typed; without it the source stays as it is. */
export function markdownPreview() {
  return [
    focused,
    formatting,
    EditorView.focusChangeEffect.of((_, focusing) => setFocused.of(focusing)),
    theme,
  ];
}
