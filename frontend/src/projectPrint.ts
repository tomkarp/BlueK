import { StreamLanguage } from "@codemirror/language";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { classHighlighter, highlightCode } from "@lezer/highlight";
import { markdownMarks } from "./markdownEditor";

type Span = { text: string; className?: string };

const kotlinLanguage = StreamLanguage.define(kotlin);

export function printKotlinLines(source: string): Span[][] {
  const code = source.replace(/\r\n?/g, "\n");
  const lines: Span[][] = [];
  let line: Span[] = [];
  highlightCode(code, kotlinLanguage.parser.parse(code), classHighlighter,
    (text, className) => line.push({ text, className }),
    () => {
      lines.push(line);
      line = [];
    },
  );
  lines.push(line);
  return lines;
}

export function printReadmeLines(source: string) {
  const text = source.replace(/\r\n?/g, "\n");
  const marks = markdownMarks(text);
  const lineClasses = new Map(marks.flatMap(mark => mark.kind === "line" ? [[mark.line, mark.class]] : []));
  const hiddenLines = new Set(marks.flatMap(mark => mark.kind === "hiddenLine" ? [mark.line] : []));
  const ranges = marks
    .filter(mark => mark.kind !== "line" && mark.kind !== "hiddenLine")
    .sort((a, b) => a.from - b.from);
  let offset = 0;
  let nextRange = 0;
  return text.split("\n").map((line, index) => {
    const start = offset;
    offset += line.length + 1;
    const spans: Span[] = [];
    let cursor = start;
    let className: string | undefined;
    let styleEnd = start;
    function append(to: number) {
      const styledEnd = Math.min(to, styleEnd);
      if (cursor < styledEnd) spans.push({ text: text.slice(cursor, styledEnd), className });
      if (Math.max(cursor, styledEnd) < to)
        spans.push({ text: text.slice(Math.max(cursor, styledEnd), to) });
      cursor = to;
    }
    while (nextRange < ranges.length && ranges[nextRange].from < offset) {
      const range = ranges[nextRange++];
      append(range.from);
      if (range.kind === "span") {
        className = range.class;
        styleEnd = range.to;
      } else {
        if (range.kind === "bullet") spans.push({ text: "•" });
        cursor = range.to;
      }
    }
    append(offset - 1);
    return { spans, className: lineClasses.get(index + 1), hidden: hiddenLines.has(index + 1) };
  });
}
