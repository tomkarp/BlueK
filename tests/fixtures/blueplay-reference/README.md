# BluePlay reference fixture

Files of the final BlueJ version of BluePlay (6 September 2026). The library
and student files were copied on 30 September 2026, the collision test in
`tests/` on 18 October 2026, when BlueK became the only maintained version of
BluePlay. `API.md` is the BlueJ version's documentation. License: included MIT
license. All files are unmodified, except that the first step of the download
instructions in `API.md` no longer contains a download link.

These files are an independent external test reference. Do not regenerate
from BlueK's implementation. Three student files run unchanged against the
built-in library; the original library source files supply the independent
signature comparison. `scripts/smoke-blueplay-browser.mjs` repeats the cases of
`tests/CollisionTest.kt` against the built-in library.

The rest of the BlueJ project lives elsewhere in BlueK: its `images/` in
`assets/standard-images/`, its `sounds/` in `assets/standard-sounds/`, the
high-resolution `dev/img/` graphics in `assets/standard-images-originals/` and
its documentation diagrams, adapted to BlueK, in `docs/img/blueplay-*.svg`.
`tests/test-collision.sh` expects the BlueJ layout with `images/` next to the
library files. BlueJ exports use the maintained copy of the library in
`assets/bluej-blueplay/`; this fixture stays unchanged even if that copy is
fixed later.
