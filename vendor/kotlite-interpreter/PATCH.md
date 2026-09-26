# BlueK Kotlite patch

This directory holds the Kotlite interpreter source with all BlueK changes
(version `1.1.2-bluek.1`). It is based on upstream
https://github.com/sunny-chung/kotlite at commit
`c78dbc5bd0938431296c728617aa09fda4849c45` (version 1.1.2). The upstream MIT
license is included in `LICENSE`; `CHANGELOG.md` is upstream's changelog and
does not list BlueK changes.

**This directory is the source of truth.** The GitHub fork
https://github.com/tomkarp/kotlite only contains the first three changes
(up to commit `1cf1eeaa19fb5ebfb8624b07bfeb39ff8e32135a`: builtin extensions
across repeated analysis, private properties, backing fields in custom
accessors). Everything else below exists only here. The fork is not part of
the build.

`kotlite-browser/settings.gradle.kts` includes this directory as a Gradle
composite build. Gradle therefore substitutes it for every dependency on
`io.github.sunny-chung:kotlite-interpreter`, including the transitive 1.1.0
dependency of the binary `kotlite-stdlib` 1.1.0 from Maven Central. No
upstream interpreter ends up in the BlueK bundle. Because that stdlib was
compiled against the upstream API, signatures it uses must stay compatible.
Upstream tests are not vendored; coverage comes from the BlueK smoke tests
named below. An overview in German is in `docs/kotlite.md`.

It is kept as a source dependency so BlueK can apply small, reviewable
browser-session fixes without replacing Kotlite with a separate interpreter.

## Changes

Suspendable execution: every AST node evaluates through `suspend` functions,
so a running program can pause without blocking the worker.
`CustomFunctionDefinition.suspendExecutable` lets host functions suspend
(BlueK's `readln`, `readLine`, `readlnOrNull`). `Interpreter.checkpointHook`
is called once per `while`, `do-while` and `for` iteration; the host decides
when to yield. `Interpreter.runImmediately`/`eval()` remain as a synchronous
compatibility boundary and fail if execution suspends there, except inside
replayable library code (below); this is also the path of
`LambdaValue.execute`, used by the binary stdlib's callbacks.
`Thread.sleep(Int/Long)` (`ThreadClass`) calls a suspending
`ExecutionEnvironment.sleepHandler` injected by the host.
`ExecutionEnvironment.patchFunction` replaces a registered library function
(BlueK uses it for suspendable `Iterable<T>.count { }` and
`MutableList<T>.removeAll`/`retainAll { }`, and for a bounds-checked
`String.substring`, RT-39). Coverage:
`node scripts/check-interactive-core.mjs`, `npm run test:runtime-state`.

Suspending library callbacks (RT-37): the binary stdlib calls lambdas
synchronously through `LambdaValue.execute`, i.e. `runImmediately`.
`CustomFunctionDefinition.isReplayable` marks library code that is
deterministic and has no side effects of its own before it returns;
`StdlibReplayMetadata` sets it for every stdlib function with a function-type
parameter (modules `Core`, `Collections`, `Text`, `Byte`) except the in-place
`MutableList<T>.removeAll`/`retainAll`. `CustomFunctionDeclarationNode.execute`
runs such code through `Interpreter.callReplayable`. There `runImmediately`
records every callback outcome (`ReplayableNativeCall`). If a callback
suspends, `AbandonedNativeCall` (a `Throwable`, not an `Exception`) unwinds the
library code while the callback's own coroutine stays suspended with its
scopes on the call stack. When the callback completes, the library code runs
again from the start and receives the recorded outcomes, so interpreted code
(and its side effects, output and exceptions) runs exactly once.
`Interpreter.checkpoint()` does nothing inside any synchronous callback, so a
loop there never yields; this avoids replaying on every scheduler slice and
covers `toString`/`equals`/`hashCode`/`compareTo` callbacks, which are not
replayable. `Interpreter.canSuspend` is false while such a non-replayable
callback (or a legacy synchronous `eval`) is on the stack; hosts check it
before suspending for input or sleep and report an error (an
`InterpreterStateException`, see RT-38 below) instead of leaving a
continuation behind. A callback that adds to or removes from the collection
a replayed call iterates (a `ConcurrentModificationException` in Kotlin) is
not detected; the replay then continues on the changed collection. Coverage: RT-37 in
`scripts/smoke-kotlite-browser.mjs` (suspended and buffered runs of the same
cases must agree) and `npm run test:runtime-state`.

Generics, `inline` and `reified`: explicit and inferred type arguments reach
`CallableNode.execute(..., typeArguments)` and host functions
(`CustomFunctionDefinition.typeParameters`, `TypeParameter.isReified`,
`FunctionModifier.inline`, `extraTypeParameters`). Reified type parameters are
available in `is`/`!is`/`as`; `noinline` and `crossinline` are checked; every
call gets its own return token so non-local returns from inline lambdas work
with recursion and suspension, bypass `catch` and still run `finally`.
`List`, `Collection` and `Iterable` are covariant. `DataType.acceptsRuntimeType`
(`RuntimeTypeCheck.kt`) is the shared runtime type check;
`GenericCollectionsModule` provides `filterIsInstance`; `StdlibInlineMetadata`
adds inline metadata the binary stdlib lacks. Details in
`docs/kotlite-generics.md`; coverage: `npm run test:generics`.

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

Exceptions from host code (RT-38): a Kotlin exception thrown by a native
function, e.g. the `NumberFormatException` of the binary stdlib's
`"x".toInt()`, used to match only `catch (e: Throwable)`. `TryNode.eval` now
converts it with `Throwable.toValue()`: `StandardExceptionValue.classNameOf`
maps `NumberFormatException`, `IllegalArgumentException`,
`IllegalStateException`, `ArithmeticException`, `IndexOutOfBoundsException`
and `NoSuchElementException` (including host subclasses) to the interpreter's
class of the same name, and the `catch` clauses are matched by type as for
interpreted exceptions. Other host exceptions stay plain `Throwable`s;
`UnsupportedOperationException` is left out on purpose because the interpreter
throws it for its own unsupported paths. Host exceptions carry no Kotlite
stack trace. Integer `/` and `%` by zero (`NumberValue.div`/`rem`, also `/=`
and `%=`) throw `ArithmeticException("/ by zero")`; Kotlin/JS itself yields `0`
for `Int` and throws a plain `Exception` for `Long`. The interpreter's own
state failures (suspension at the synchronous boundary, a mismatched call
stack scope in `CallStack.pop`, a missing return target) are
`InterpreterStateException`s instead of plain `IllegalStateException`s:
`TryNode.eval` rethrows them without consulting any `catch` block, like
control flow, so a program cannot hide them; `finally` still runs. With
RT-37, interpreted code no longer reaches these failures. BlueK's host throws
the same exception when `readln()` or `Thread.sleep()` cannot pause
(`canSuspend` is false, or a legacy synchronous call), before suspending: a
limit of BlueK that the program's `catch` must not hide. `AbandonedNativeCall` only unwinds library code between
`runImmediately` and `callReplayable` and never reaches a `TryNode`. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs`, including exceptions from
suspended and replayed stdlib callbacks.

`Parser.propertyDeclaration` only consumes a `private` token after a property
when an accessor (`get`/`set`) follows it; previously the lookahead for
`private set` swallowed the `private` modifier of the next class member, so
only the first property of a class was private. `Parser.semis` also skips the
line breaks after a semicolon, so class members may end with `;`. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs`.
