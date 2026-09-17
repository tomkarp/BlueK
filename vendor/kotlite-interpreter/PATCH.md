# BlueK Kotlite patch

This directory vendors the interpreter source from the BlueK Kotlite fork
at commit `1cf1eeaa19fb5ebfb8624b07bfeb39ff8e32135a` (based on upstream
commit `c78dbc5bd0938431296c728617aa09fda4849c45`, version 1.1.2).

The corresponding fork is https://github.com/tomkarp/kotlite.

It is kept as a source dependency so BlueK can apply small, reviewable
browser-session fixes without replacing Kotlite with a separate interpreter.
The upstream MIT license is included in `LICENSE`.

The fork also reports secondary constructors explicitly as unsupported instead
of exposing the parser's generic unexpected-token error.

It also resolves unqualified calls to inherited member methods through the
implicit `this` receiver. This keeps ordinary Kotlin spelling such as
`move(1)` working inside subclass methods; the upstream resolver required an
explicit `this.move(1)` in that case.

BlueK adds `ClassInstance.readBackingPropertyByDeclaredName`, a passive
inspection hook that reads a backing field without invoking a student-defined
getter. This is needed to display ordinary fields and properties with only a
custom setter in the BlueK object inspector.

BlueK's persistent REPL retains immutable analysis source and records property
retirement boundaries. `ReplAnalyzer` translates those boundaries to top-level
analysis steps; `SemanticAnalyzer` retires declared names and their transformed
symbol mappings only after older source has been analyzed. This preserves
symbol identities and old alias initializers while allowing name reuse without
reexecuting history.

Lambda captures include global property holders, which may outlive a retired
REPL name. Callback execution carries the captured symbol table as well.
`reachableRuntimeValues` provides passive, identity-based traversal of fields,
captures and standard native containers. Opaque delegated values can expose
their owned references through `retainedRuntimeValues`; iterable iterators
use this to retain their source. The host uses this graph to invalidate UI
handles, not to implement the JavaScript garbage collector.

Coverage: `npm run test:references`, `npm run test:runtime-state`,
`node scripts/smoke-kotlite-browser.mjs` and `tests/gui/references.spec.ts`.
