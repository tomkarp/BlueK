# BlueK Kotlite patch

This directory vendors the interpreter source from the BlueK Kotlite fork
at commit `1cf1eeaa19fb5ebfb8624b07bfeb39ff8e32135a` (based on upstream
commit `c78dbc5bd0938431296c728617aa09fda4849c45`, version 1.1.2).

The corresponding fork is https://github.com/tomkarp/kotlite.

It is kept as a source dependency so BlueK can apply small, reviewable
browser-session fixes without replacing Kotlite with a separate interpreter.
The upstream MIT license is included in `LICENSE`.
