# Terminal playing-card fonts

BlueK Cards English and BlueK Cards German are modified subsets of **Noto Sans
Symbols 2 Regular**, Copyright 2022 The Noto Project Authors
(https://github.com/notofonts/symbols), distributed under **SIL OFL 1.1**.
The complete, unchanged upstream copyright notice and license are in `OFL.txt`.
Both derived fonts remain under that license, independently of BlueK's code.

Both fonts use thinner court artwork: a two-unit inset on filled outlines opens
white gaps and reduces fine strokes by four font units. This applies only to the
central jack/knight/queen/king artwork, with full opacity. Card frames, corner
suit marks and rank labels retain their original contours. German additionally
replaces the two corner indices of all four jacks and queens with newly drawn
B and D outlines. Both subsets have new
family, full, unique and PostScript names and compact terminal line metrics.
Only spans containing playing cards select these fonts, so normal text metrics
are unaffected. No Noto endorsement is implied.
The font name-table license field and BlueK's HTML metadata include the complete
copyright notice and OFL, including in standalone/offline exports.

Source downloaded on 2026-11-05:
https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf

SHA-256: `7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21`

To regenerate, download that source, create a temporary Python environment with
`fonttools==4.65.0`, `brotli==1.2.1` and `skia-pathops==0.9.2`, then run:

```sh
python scripts/build-card-fonts.py /path/to/NotoSansSymbols2-Regular.ttf
```

The generator rejects other source checksums. Generated WOFF2 files are checked
in; ordinary builds require neither Python nor network access. The shared Svelte
component embeds both fonts as data URLs and selects them using the terminal's
inherited `lang`. Their character maps and CSS Unicode ranges cover playing
cards only; normal text uses the existing monospace fallback. Fonts are
monochrome and inherit ANSI text colors, as other terminal characters do.
