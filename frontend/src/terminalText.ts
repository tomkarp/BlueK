/**
 * Program output as a terminal shows it (GUI-97): ANSI escape sequences for colours and text
 * styles (SGR, `ESC[…m`), erasing (`ESC[2J`, `ESC[K`) and cursor movement (`ESC[H`, `ESC[A` …),
 * and the control characters `\r` (back to the line start, the next text overwrites), `\b`
 * (one column back), `\t` (next tab stop, every 8 columns), and BEL (`\u0007`, terminal bell). Unsupported sequences are
 * swallowed instead of shown. The screen is the output since the last clear; `ESC[2J` clears it
 * and moves the cursor home. BlueK's own markers `\u0001`…`\u0002` enclose echoed input.
 * Larger and smaller text uses kitty's text sizing protocol `ESC]66;s=2;Text BEL` (GUI-98): the
 * text becomes a block `s` lines high that overlays the following lines, and the cursor moves
 * to its right in the top line.
 * Users' documentation: `docs/terminal.md`.
 */

export interface TerminalPart {
  text: string;
  input: boolean;
  /** Colours and text styles as CSS; palette colours are variables that themes may override. */
  style?: string;
  /**
   * Set for sized text (OSC 66): CSS of the block that holds `text`, as wide as its cells and as
   * high as its lines; it takes one line in the layout and overlays the lines below.
   */
  box?: string;
}

interface Style {
  fg: string | null; // palette index "0"–"15", "#rrggbb" or null for the default
  bg: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  inverse: boolean;
  hidden: boolean;
  input: boolean;
}

/** Sized text (OSC 66) starting at a cell; the other cells it covers in its top line are "". */
interface Box {
  text: string;
  style: number;
  /** Cells in width and lines in height. */
  width: number;
  height: number;
  /** Font size relative to normal text. */
  scale: number;
  vertical: number;
  horizontal: number;
}

interface Line {
  chars: string[];
  styles: number[];
  boxes: Map<number, Box>;
  /** Style of the line break after this line. */
  end: number;
}

const ESC = "\u001B";
const plain = (input = false): Style => ({
  fg: null, bg: null, bold: false, dim: false, italic: false, underline: false,
  strike: false, inverse: false, hidden: false, input,
});

function color256(index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index > 255) return null;
  if (index < 16) return String(index);
  const hex = (value: number) => value.toString(16).padStart(2, "0");
  if (index >= 232) {
    const gray = 8 + (index - 232) * 10;
    return `#${hex(gray)}${hex(gray)}${hex(gray)}`;
  }
  const levels = [0, 95, 135, 175, 215, 255];
  const cube = index - 16;
  return `#${hex(levels[Math.floor(cube / 36)])}${hex(levels[Math.floor(cube / 6) % 6])}${hex(levels[cube % 6])}`;
}

/** Applies SGR parameters; returns the new style. */
function applySgr(style: Style, params: number[]): Style {
  const next = { ...style };
  if (params.length === 0) params = [0];
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) Object.assign(next, plain(next.input));
    else if (p === 1) next.bold = true;
    else if (p === 2) next.dim = true;
    else if (p === 3) next.italic = true;
    else if (p === 4 || p === 21) next.underline = true;
    else if (p === 7) next.inverse = true;
    else if (p === 8) next.hidden = true;
    else if (p === 9) next.strike = true;
    else if (p === 22) { next.bold = false; next.dim = false; }
    else if (p === 23) next.italic = false;
    else if (p === 24) next.underline = false;
    else if (p === 27) next.inverse = false;
    else if (p === 28) next.hidden = false;
    else if (p === 29) next.strike = false;
    else if (p >= 30 && p <= 37) next.fg = String(p - 30);
    else if (p === 39) next.fg = null;
    else if (p >= 40 && p <= 47) next.bg = String(p - 40);
    else if (p === 49) next.bg = null;
    else if (p >= 90 && p <= 97) next.fg = String(p - 90 + 8);
    else if (p >= 100 && p <= 107) next.bg = String(p - 100 + 8);
    else if (p === 38 || p === 48) {
      let value: string | null = null;
      if (params[i + 1] === 5) {
        value = color256(params[i + 2]);
        i += 2;
      } else if (params[i + 1] === 2) {
        const [r, g, b] = params.slice(i + 2, i + 5);
        if ([r, g, b].every((c) => Number.isInteger(c) && c >= 0 && c <= 255)) {
          value = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        }
        i += 4;
      }
      if (value !== null) {
        if (p === 38) next.fg = value;
        else next.bg = value;
      }
    }
    // 5/6 (blink) and unknown codes are ignored, like many terminals do
  }
  return next;
}

export function terminalParts(value: string): TerminalPart[] {
  const styles: Style[] = [];
  const styleIds = new Map<string, number>();
  const idOf = (style: Style) => {
    const key = JSON.stringify(style);
    let id = styleIds.get(key);
    if (id === undefined) {
      id = styles.length;
      styles.push(style);
      styleIds.set(key, id);
    }
    return id;
  };
  let style = plain();
  let current = idOf(style);
  const blank = idOf(plain());
  const newLine = (): Line => ({ chars: [], styles: [], boxes: new Map(), end: blank });
  let lines: Line[] = [newLine()];
  let row = 0;
  let col = 0;
  let saved = { row: 0, col: 0 };
  const line = (index: number) => {
    while (lines.length <= index) lines.push(newLine());
    return lines[index];
  };
  // Writing into or erasing any cell of sized text removes all of it, as in kitty.
  const removeBoxes = (target: Line, from: number, to: number) => {
    for (const [start, box] of target.boxes) {
      if (start >= to || start + box.width <= from) continue;
      target.boxes.delete(start);
      for (let i = start; i < Math.min(start + box.width, target.chars.length); i++) {
        target.chars[i] = " ";
        target.styles[i] = blank;
      }
    }
  };
  const fill = (target: Line, to: number) => {
    while (target.chars.length < to) {
      target.chars.push(" ");
      target.styles.push(blank);
    }
  };
  const put = (char: string) => {
    const target = line(row);
    removeBoxes(target, col, col + 1);
    fill(target, col);
    target.chars[col] = char;
    target.styles[col] = current;
    col += 1;
  };
  const eraseInLine = (target: Line, from: number, to: number) => {
    removeBoxes(target, from, to);
    for (let i = from; i < Math.min(to, target.chars.length); i++) {
      target.chars[i] = " ";
      target.styles[i] = blank;
    }
  };
  const truncate = (target: Line, length: number) => {
    removeBoxes(target, length, Infinity);
    target.chars.length = Math.min(target.chars.length, length);
    target.styles.length = target.chars.length;
  };
  /** kitty's text sizing protocol: `66;s=2:w=0:n=0:d=0:v=0:h=0;text`. */
  const putSized = (metadata: string, text: string) => {
    const options = new Map<string, number>();
    for (const entry of metadata.split(":")) {
      const [key, raw] = entry.split("=");
      if (/^\d+$/.test(raw ?? "")) options.set(key, Number(raw));
    }
    const option = (key: string, max: number, fallback: number) => {
      const value = options.get(key);
      return value !== undefined && value <= max ? value : fallback;
    };
    const scale = Math.max(1, option("s", 7, 1));
    const fixedWidth = option("w", 7, 0);
    const numerator = option("n", 15, 0);
    const denominator = option("d", 15, 0);
    const cells = Array.from(text).filter((char) => char >= " ");
    if (cells.length === 0) return;
    const width = scale * (fixedWidth || cells.length);
    const target = line(row);
    removeBoxes(target, col, col + width);
    fill(target, col + width);
    for (let i = col; i < col + width; i++) {
      target.chars[i] = "";
      target.styles[i] = blank;
    }
    target.boxes.set(col, {
      text: cells.join(""), style: current, width, height: scale,
      scale: scale * (numerator > 0 && denominator > numerator ? numerator / denominator : 1),
      vertical: option("v", 2, 0), horizontal: option("h", 2, 0),
    });
    line(row + scale - 1); // the lines the text overlays
    col += width;
  };

  const chars = Array.from(value);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === ESC) {
      const kind = chars[i + 1];
      if (kind === undefined) break; // incomplete: the rest follows with the next output
      if (kind === "[") {
        let end = i + 2;
        while (end < chars.length && !(chars[end] >= "@" && chars[end] <= "~")) end++;
        if (end >= chars.length) break;
        const body = chars.slice(i + 2, end).join("");
        const final = chars[end];
        i = end;
        if (/^[<=>?]/.test(body)) continue; // private modes such as hiding the cursor
        const params = body === "" ? [] : body.split(";").map((p) => (p === "" ? 0 : Number.parseInt(p, 10)));
        const n = Math.max(1, params[0] || 0);
        switch (final) {
          case "m":
            style = applySgr(style, params.map((p) => (Number.isNaN(p) ? -1 : p)));
            current = idOf(style);
            break;
          case "J": {
            const mode = params[0] || 0;
            if (mode === 2 || mode === 3) {
              lines = [newLine()];
              row = 0;
              col = 0;
            } else if (mode === 0) {
              truncate(line(row), col);
              lines.length = row + 1;
            } else if (mode === 1) {
              for (let r = 0; r < row; r++) lines[r] = { ...newLine(), end: lines[r].end };
              eraseInLine(line(row), 0, col + 1);
            }
            break;
          }
          case "K": {
            const target = line(row);
            const mode = params[0] || 0;
            if (mode === 0) truncate(target, col);
            else if (mode === 1) eraseInLine(target, 0, col + 1);
            else if (mode === 2) truncate(target, 0);
            break;
          }
          case "H":
          case "f":
            row = Math.max(1, params[0] || 1) - 1;
            col = Math.max(1, params[1] || 1) - 1;
            line(row);
            break;
          case "A": row = Math.max(0, row - n); break;
          case "B": row += n; line(row); break;
          case "C": col += n; break;
          case "D": col = Math.max(0, col - n); break;
          case "E": row += n; col = 0; line(row); break;
          case "F": row = Math.max(0, row - n); col = 0; break;
          case "G": col = n - 1; break;
          case "d": row = n - 1; line(row); break;
          case "s": saved = { row, col }; break;
          case "u": ({ row, col } = saved); line(row); break;
          // other sequences are swallowed
        }
        continue;
      }
      if (kind === "]") {
        // OSC up to BEL or ESC \: sized text; others (e.g. a window title) are swallowed
        let end = i + 2;
        while (end < chars.length && chars[end] !== "\u0007" && !(chars[end] === ESC && chars[end + 1] === "\\")) end++;
        if (end >= chars.length) break;
        const sized = /^66;([^;]*);([\s\S]*)$/.exec(chars.slice(i + 2, end).join(""));
        if (sized) putSized(sized[1], sized[2]);
        i = chars[end] === ESC ? end + 1 : end;
        continue;
      }
      if (kind === "c") {
        // full reset
        lines = [newLine()];
        row = 0;
        col = 0;
        style = plain(style.input);
        current = idOf(style);
      }
      i += 1;
      continue;
    }
    if (char === "\u0001" || char === "\u0002") {
      style = { ...style, input: char === "\u0001" };
      current = idOf(style);
    } else if (char === "\n") {
      line(row).end = current;
      row += 1;
      col = 0;
      line(row);
    } else if (char === "\r") col = 0;
    else if (char === "\b") col = Math.max(0, col - 1);
    else if (char === "\f") {
      lines = [newLine()];
      row = 0;
      col = 0;
    } else if (char === "\t") col = (Math.floor(col / 8) + 1) * 8; // next tab stop, like terminals
    else if (char >= " ") put(char);
    // other control characters are not shown
  }

  const parts: TerminalPart[] = [];
  let text = "";
  let partStyle = -1;
  const flush = () => {
    if (text) parts.push(describe(styles[partStyle], text));
    text = "";
  };
  const append = (char: string, id: number) => {
    if (id !== partStyle) {
      flush();
      partStyle = id;
    }
    text += char;
  };
  lines.forEach((target, index) => {
    target.chars.forEach((char, column) => {
      const box = target.boxes.get(column);
      if (box) {
        flush();
        partStyle = -1;
        parts.push(describeBox(styles[box.style], box));
      } else append(char, target.styles[column]);
    });
    if (index < lines.length - 1) append("\n", target.end);
  });
  flush();
  return parts;
}

// The 16 palette colours of VS Code's light terminal theme; the dark theme overrides them through
// the CSS variables `--ansi-0` … `--ansi-15` (style.css). Exported programs use these values.
const PALETTE = [
  "#000000", "#cd3131", "#00bc00", "#949800", "#0451a5", "#bc05bc", "#0598bc", "#555555",
  "#666666", "#cd3131", "#14ce14", "#b5ba00", "#0451a5", "#bc05bc", "#0598bc", "#a5a5a5",
];

const ALIGN = ["flex-start", "flex-end", "center"];
const round = (value: number) => Math.round(value * 10000) / 10000;

function describeBox(style: Style, box: Box): TerminalPart {
  const part = describe(style, box.text);
  // One line high in the layout (negative margin), the full height overlays the lines below.
  part.box = [
    "display:inline-flex", "vertical-align:top", `width:${box.width}ch`, `height:${box.height}lh`,
    ...(box.height > 1 ? [`margin-bottom:-${box.height - 1}lh`] : []),
    `align-items:${ALIGN[box.vertical]}`, `justify-content:${ALIGN[box.horizontal]}`,
  ].join(";");
  // `lh` in line-height refers to the parent: the text's lines are `scale` normal lines high.
  part.style = [
    part.style, `font-size:${round(box.scale)}em`, `line-height:${round(box.scale)}lh`, "flex:none", "white-space:pre",
  ].filter(Boolean).join(";");
  return part;
}

function describe(style: Style, text: string): TerminalPart {
  const css: string[] = [];
  let fg = style.fg;
  let bg = style.bg;
  if (style.inverse) {
    fg = style.bg ?? "background";
    bg = style.fg ?? "foreground";
  }
  const color = (value: string | null) => {
    if (value === null) return null;
    if (value === "foreground") return "var(--terminal-fg,#222)";
    if (value === "background") return "var(--terminal-bg,#fff)";
    if (value.startsWith("#")) return value;
    return `var(--ansi-${value},${PALETTE[Number(value)]})`;
  };
  const foreground = style.hidden ? "transparent" : color(fg);
  if (foreground) css.push(`color:${foreground}`);
  const background = color(bg);
  if (background) css.push(`background-color:${background}`);
  if (style.bold) css.push("font-weight:bold");
  if (style.dim) css.push("opacity:.6");
  if (style.italic) css.push("font-style:italic");
  const lines = [style.underline ? "underline" : "", style.strike ? "line-through" : ""].filter(Boolean);
  if (lines.length) css.push(`text-decoration-line:${lines.join(" ")}`);
  const part: TerminalPart = { text, input: style.input };
  if (css.length) part.style = css.join(";");
  return part;
}
