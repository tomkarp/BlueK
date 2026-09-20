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

Runtime performance (BluePlay simulation): symbol tables allocate their maps
only on first write and read nullable fields directly; `by lazy` is avoided
because Kotlin/JS creates a property reference on every delegated access.
Unparameterized type names resolve without visit caches. Non-generic class
types are shared per `ClassDefinition` and revalidated by hierarchy identity;
types with concrete arguments (e.g. `List<Invader>`) are cached per
interpreter root scope, because built-in class definitions are process-wide
singletons. Such types also keep their `ClassMemberResolver`, which memoizes
resolved member signatures. Member calls initialize `this` bindings directly,
`for` loops look up iterator functions once, and runtime member names resolve
without scanning all members. Types involving type parameters use the
original resolution path.

Coverage: `npm run test:generics` (including a cache case for alternating
concrete arguments, nullability and a type parameter shadowing a class),
`npm run test:references`, `npm run browser-smoke` and
`node scripts/benchmark-blueplay.mjs`.

`ReplAnalyzer` retries forward class references by moving the referenced
class directly before the top-level declaration whose analysis needed it
(error position, or the subclass naming a missing superclass), instead of to
the front of the script. Dependencies of the moved class therefore stay in
front of it; a nullable member type (`Cannot resolve type X?`) is recognized
as a missing class as well. Coverage: forward-reference cases in
`scripts/smoke-kotlite-browser.mjs` and the file-order case in
`scripts/smoke-space-invaders.mjs`.

Language coverage for school material (inf-schule "OOP mit Kotlin"):
`private` member functions (callable only from their class, checked in the
semantic analyzer; private properties are now checked there as well), import
directives (`ScriptNode.imports`; hosts decide which are available), standard
exceptions (`IllegalArgumentException`, `IllegalStateException`,
`NumberFormatException`, `ArithmeticException`, `IndexOutOfBoundsException`,
`NoSuchElementException`, `UnsupportedOperationException`), type-argument
inference from a declared property type (`val k: MutableList<K> =
mutableListOf()`), Kotlin output formats (`6.0`, `[1, 2]`), `Float` approximated
by `Double` including `1.5f` literals, string templates that end at the first
non-identifier character with a literal lone `$`, property accessors analyzed
in the class scope (they see later properties, never constructor parameters),
a compile error for class properties without value (unless an init block
exists), member-call arguments evaluated in the caller's scope (positional,
non-vararg, non-lambda arguments), and "No matching function" messages that name
the argument types. Coverage: `node scripts/smoke-curriculum-kotlin.mjs`.

`Parser.propertyDeclaration` only consumes a `private` token after a property
when an accessor (`get`/`set`) follows it; previously the lookahead for
`private set` swallowed the `private` modifier of the next class member, so
only the first property of a class was private. `Parser.semis` also skips the
line breaks after a semicolon, so class members may end with `;`. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs`.
