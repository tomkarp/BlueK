# Terminal formatting

BlueK and exported HTML programs support ANSI colors/styles, cursor movement
and clearing, plus kitty text sizing. ESC (code 27) is `"\u001B"` in Kotlin.

```kotlin
println("\u001B[1;31mImportant\u001B[0m")
```

Always reset styles afterward with `\u001B[0m`. Multiple codes use `;`.

## Colors and styles

| Code | Meaning | Code | Meaning |
| --- | --- | --- | --- |
| 0 | Reset all | 1 | Bold |
| 2 | Dim | 3 | Italic |
| 4 | Underline | 7 | Swap foreground/background |
| 8 | Hidden | 9 | Strikethrough |
| 22 | Clear bold/dim | 23 | Clear italic |
| 24 | Clear underline | 27 | Clear reverse |
| 28 | Visible | 29 | Clear strikethrough |
| 39 | Default foreground | 49 | Default background |

| Color | Foreground | Bright | Background | Bright |
| --- | --- | --- | --- | --- |
| Black | 30 | 90 | 40 | 100 |
| Red | 31 | 91 | 41 | 101 |
| Green | 32 | 92 | 42 | 102 |
| Yellow | 33 | 93 | 43 | 103 |
| Blue | 34 | 94 | 44 | 104 |
| Magenta | 35 | 95 | 45 | 105 |
| Cyan | 36 | 96 | 46 | 106 |
| White | 37 | 97 | 47 | 107 |

256 colors use `\u001B[38;5;208m` (foreground) or `48;5` (background).
RGB uses `\u001B[38;2;255;120;0m` or `48;2;r;g;b`, with channels 0–255.
Use default foreground 39 for text that adapts to light/dark mode.

## Clearing and cursor movement

| Output | Effect |
| --- | --- |
| `"\u001B[H\u001B[2J"` | Clear and return to top left |
| `"\u000C"` | Clear (form feed, as in BlueJ) |
| `"\r"` | Return to line start; later text overwrites it |
| `"\u001B[K"` | Clear from cursor to line end; 1K to cursor, 2K whole line |
| `"\u001B[J"` | Clear from cursor onward; 1J up to cursor |
| `"\u001B[3;5H"` | Move to row 3, column 5 (one-based) |
| `"\u001B[2A"` | Move up two rows; B down, C right, D left |
| `"\u001B[s"`, `"\u001B[u"` | Save/restore cursor |
| `"\b"` | Back one column |
| `"\t"` | Next tab stop, every eight columns |

```kotlin
for (percent in 0..100 step 10) {
    print("\rLoading: $percent %")
    Thread.sleep(200)
}
println()
```

## Large and small text

The [kitty text sizing protocol](https://sw.kovidgoyal.net/kitty/text-sizing-protocol/)
uses `ESC]66;options;text BEL`. Options are colon-separated:

| Option | Meaning | Values |
| --- | --- | --- |
| s | Scale height/width; occupies s rows | 1–7, default 1 |
| n, d | Fractional scale n/d | 0–15, n < d |
| w | Width in cells times s; 0 uses character count | 0–7, default 0 |
| v | Vertical alignment: top/bottom/center | 0/1/2, default 0 |
| h | Horizontal alignment: left/right/center | 0/1/2, default 0 |

```kotlin
print("\u001B]66;s=2;Title\u0007\n\n")
```

The cursor stays in the top occupied row beside the text, so emit s newlines
to continue below it. ANSI styles also apply to sized text. Terminals without
kitty sizing support may omit this text; it is not portable ANSI styling.

## Differences from a fixed-screen terminal

The screen is all retained output since clearing, with no fixed height; row 1
is its first row. 2J clears and moves to top left. Writing/erasing a sized-text
anchor removes the whole block; writing in rows below can cover it.

Blink, window titles, old DEC double-height sequences and other unsupported
control sequences are ignored. The terminal bell (`\u0007`) plays a beep and is
not shown. Output is bounded: styles enabled only in a
discarded prefix may be lost when very large amounts of text are printed.

```kotlin
print("\u0007")
```
