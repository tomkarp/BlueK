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

Nullable for-loop subjects (RT-50): the synthetic `iterator()` navigation
is marked by the analyzer and points at the loop subject (the receiver's
start for calls/navigation). When member resolution requires a non-null
receiver, it reports "Non-nullable value required to call 'iterator()' method
in a for-loop." instead of the generic nullable-call diagnostic at `for`.
Nullable-receiver iterator extensions still resolve normally; errors inside
the subject and ordinary unsafe calls retain their existing messages.
Coverage: `scripts/smoke-kotlite-browser.mjs` (diagnostic/file/line/column,
lists/ranges/strings, safe calls, Elvis/!!/smart casts and a nullable iterator
extension) and the RT-50 browser test in `tests/gui/regressions.spec.ts`.

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

Secondary constructors without a primary constructor or `this`/`super`
delegation are supported (RT-48, needed for BluePlay's three typed Image
constructors). The parser records `ClassSecondaryConstructorNode`; constructor
lookup preserves separate overload candidates and the selected index. Arguments
are evaluated once in the caller, instance initializers run once, and the body
uses the normal member-call path with `enterCall`/`leaveCall`, recursion limits
and suspension. Constructor signatures are read directly from declarations;
looking them up must not force member analysis while a primary constructor's
default values are being analyzed (RT-40). Unsupported delegation and mixing
with a primary constructor have explicit parser errors. Constructors do not
appear as member methods. Coverage: `smoke-kotlite-browser.mjs` RT-48 (overloads,
named/default arguments, once-only side effects, input and sleep), existing
RT-40 curriculum cases, `smoke-blueplay-api.mjs` (three Image constructors).

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

Classes may reference each other in any order, also in a cycle (RT-40):
upstream analyzed top-level declarations strictly in order, so `class Hund {
var herrchen: Mensch? }` and `class Mensch { var hund: Hund? }` could not be
compiled in either order. `SemanticAnalyzer.declareClassesAhead` now declares
every top-level class of the script before any declaration is analyzed: its
`ClassDefinition` (with supertypes, supertypes declared first), the nullable
and companion definitions and the three class scopes. The ordinary analysis
of the class (`visitClassBody`) completes that same definition and those
scopes instead of creating new ones, so types resolved earlier keep their
class identity (`ObjectType.equals` compares definitions by identity).
Declaring consumes no symbol counters, so declarations analyzed before a class
get the same transformed names whatever follows; the persistent REPL relies
on that. A class is analyzed at its position, or earlier on demand when other
code first needs its members (`ClassDefinition.pendingAnalysis`, run by every
member lookup), always after its own supertypes; the analyzer saves and
restores the state of the interrupted declaration (including the accessor
checked for RT-43). On-demand analyses nest: classes that each need the
members of the next one, in reverse file order, nest once per class. In a
Chromium worker a chain of 50 such classes compiles, 60 exceed the host
stack (reported as `StackOverflowError`). Until a class's analysis
attaches its member functions, it has none (`isDeclaredAhead`), as if it were
not declared yet, e.g. for calls in its own constructor default values.
Constructor calls only need the declared parameter types and never trigger
an analysis. Limits: members of a class whose analysis is still in progress
are the ones analyzed so far, so an expression-bodied function without a
declared return type has no type before its own analysis (as before inside
one class); a cycle in the inheritance hierarchy is now reported as such.

At runtime, `Interpreter.ClassDeclarationNode.eval` defers member property
types (`ClassDefinition.deferProperties`) until members are first used, so a
class can be declared before a class its properties name. `ReplAnalyzer` no
longer moves classes after analysis errors; it analyzes in source order and
returns the class declarations first (supertypes before subtypes), then all
other nodes in source order, so a host evaluating the new nodes in order
declares all classes before other code runs. Enum entries are created when
their class is declared, so an enum class with non-literal entry arguments
(which may read top-level properties) keeps its place. Top-level functions
and properties are still analyzed in order. Coverage: RT-40 in
`scripts/smoke-curriculum-kotlin.mjs` (reported variants in both file orders
and as one source, a bidirectional association with inheritance and an
interface, classes declared together in the Codepad, calls in constructor
default values, enums used before their file, an on-demand analysis inside
another class's setter, errors for a missing class and cyclic inheritance), `tests/gui/regressions.spec.ts` (RT-40), the
forward-reference cases in `scripts/smoke-kotlite-browser.mjs` and the
file-order case in `scripts/smoke-space-invaders.mjs`.

Top-level functions (also extension and operator functions) and properties
may be used before their position (RT-45): upstream analyzed them strictly in
order, so `fun main() { hilfe() }` before `fun hilfe()`, or a class reading
`val maximum` of a later file, failed ("No matching function", "`maximum` is
unknown"). `SemanticAnalyzer` still analyzes them in source order, but when
code looks up a name, it first analyzes every pending top-level declaration
of that name (`analyzeTopLevelAhead`), in source order and with the state of
the interrupted declaration saved and restored (`analyzeAtTopLevel`, shared
with the on-demand class analysis of RT-40). Lookups that trigger it are
function lookups reaching the script scope
(`SemanticAnalyzerSymbolTable.beforeFunctionLookup`, set on the script scope
only: `findAllMatchingCallables`, `findFunctionsByOriginalName`,
`findExtensionFunctions`) and variable references that no local or member
shadows. Nothing is declared ahead and no counter is consumed ahead, so
declarations analyzed before get the same transformed names whatever
follows. For the persistent REPL, `ReplAnalyzer.analyze` takes `unitStarts`
(source offsets where the host appended a new source; `SemanticAnalyzer`
gets them as node indices): a lookup only analyzes pending declarations of
the current unit, so a later input (e.g. a new overload) never changes an
earlier unit, and the BluePlay library does not see project functions.

Runtime order: `ReplAnalyzer` returns classes, then top-level function
declarations, then all other nodes in source order, so functions are declared
before any initializer runs, while property initializers keep their order.
A property initializer or top-level statement that reads a later property
directly (not in a function, lambda or class) is a compile error ("`b` is
initialized after this code in file order"); an initializer that needs its
own value, also through a function, reports "`a` is used before it is
initialized" instead of "unknown". The analyzer marks references to script
properties (`VariableReferenceNode.isTopLevelProperty`); when such a read or
write finds no property at runtime, `Interpreter` throws an
`InterpreterStateException` ("`maximum` is used before it is initialized"),
e.g. for `val h = Hund()` before `val maximum = 3` read by `Hund`. Limits:
initializers run in file order (Kotlin/JVM initializes a file on first use),
and an expression-bodied function without a declared return type has no type
while its own analysis runs (mutual recursion needs a declared return type on
the function analyzed first); on-demand analyses nest like those of classes,
so a chain of functions that each call the next, later one compiles with 35
functions in the Chromium worker and overflows the stack at 40
(`StackOverflowError` at compile time; Node: 100 and 200). Coverage: RT-45 in
`scripts/smoke-curriculum-kotlin.mjs` (the reported reproductions and all
forms in both file orders, overloads after the call, Codepad inputs with
forward references and a later overload, initialization-order errors at
compile time and runtime, the BluePlay library unit) and
`tests/gui/regressions.spec.ts` (RT-45).

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

`SemanticAnalyzer.NavigationNode.visit`: `.` on a nullable receiver (`list.add(x)`
with `list: MutableList<T>?`) used to fail with "has no member", which BlueK
rendered as "unknown ... check the spelling". The member lookup now also tries
the non-null type for `.` (as it already did for `?.`); a hit there throws
Kotlin's "Only safe (?.) or non-null asserted (!!.) calls are allowed on a
nullable receiver of type 'T?'." Members of the nullable type itself
(`isNullOrEmpty`) are still found first, and the failure cases are unchanged
apart from the message. Coverage: `node scripts/smoke-kotlin-surface.mjs`.

`Interpreter.enterCall`/`leaveCall` wrap every interpreted call
(`evalFunctionCall`, which also covers methods, accessors and lambdas, and
`evalCreateClassInstance`). At `maxCallDepth` (default 1000) `enterCall`
throws a `StackOverflowError` with the first 64 stack trace entries instead of
letting the host stack overflow (RT-42). `Error` (a `Throwable`) and
`StackOverflowError` (an `Error`) are new standard classes, so
`catch (e: Exception)` does not handle it. Every interpreted call takes many
JavaScript frames, and a browser worker's stack held only about a hundred
nested calls: every 32 calls `enterCall` therefore suspends through the
optional `stackResetHook`, which the host resumes on an empty stack (BlueK: a
microtask). Like `checkpoint`, it does nothing inside synchronous callbacks.
Where the host stack still overflows (recursion inside a stdlib callback or
`toString`), the new expect/actual `Throwable.isHostStackOverflow` (JS:
`RangeError` "Maximum call stack size exceeded", `InternalError` "too much
recursion") lets `StandardExceptionValue.classNameOf` map it to
`StackOverflowError`, so `catch` works there as well. The JS `fullClassName`
no longer uses `!!`: a native JS error has no Kotlin class name, and the
resulting `NullPointerException` used to replace the real error.

The depth needs `SymbolTable` lookups that do not recurse over the parent
chain: `findReturnTarget`, `findTypeAlias`, `findTypeAliasResolution`,
`assign`, `getPropertyTypeOrNull`, `read`, `getPropertyHolder`, `hasProperty`,
`findFunction`, `findClass`, the extension function/property lookups,
`findTransformedSymbol` and `listTypeAliasInAllScopes` are loops with the same
result order. `findTypeAlias` delegates to a parent that overrides it
(`SemanticAnalyzerSymbolTable`); `getPropertyTypeOrNull` keeps the former
order of type alias resolution (declaring scope first, then each scope below
it). The constructor no longer walks the whole parent chain for a cycle check
(a scope under construction cannot be in its own chain). A call's scope still
hangs below its caller's scope, so a global name is searched through all
callers and deep recursion costs time quadratic in its depth; the default
limit stays low for that reason.

`SemanticAnalyzer` records an accessor that uses its own property instead of
`field` (`set(value) { name = value }`, `this.name = value`, `get() = name`):
it calls itself endlessly. `visitAccessor` remembers the property whose
accessor is analyzed; `noteSelfCallingAccessor` compares the scope level where
the name resolved with the accessor's own scopes, so a local variable of the
same name is not reported. The place is stored in
`PropertyDeclarationNode.selfCallingSetter`/`selfCallingGetter`; BlueK turns
it into a compile warning (RT-43). Coverage for RT-42/RT-43:
`node scripts/smoke-kotlite-browser.mjs` and the Playwright test
`RT-42 RT-43 …` in `tests/gui/regressions.spec.ts`.

`SemanticAnalyzer.FunctionCallNode.visit` (member call through a
`NavigationNode`): for `?.` on a nullable receiver upstream searched the
callables for `T` and for `T?` and merged both results. Each search keeps only
the most specific callable, but the merge compared nothing across them, so a
member of `T` and an extension on a nullable supertype were both candidates:
`n?.toString()` with `n: Int?` failed with "Ambiguous function call ... Int.toString(),
Any?.toString()" once BlueK added the `Any?` extensions (RT-44), and
`s?.equals("a")` with `s: String?` was already ambiguous between
`String.equals(Any?)` and the stdlib's `String?.equals(String?, Boolean)`.
The call now uses the first search with a result: `T` (the receiver of `?.` is
non-null, and every callable of `T?` also accepts `T`), with `T?` only as a
fallback, the same order as `NavigationNode.visitMember`. Calls that resolved
before resolve the same; only former ambiguities change. Coverage:
`node scripts/smoke-kotlin-surface.mjs` and `node scripts/smoke-blueplay-browser.mjs`
(`World.kt`: `current.image?.transparency?.toString() ?: "255"`).

Smart casts after type tests (RT-46): `SemanticAnalyzer` narrows the type of a
variable after `x is T`, `x !is T` and null checks, with one mechanism for
both. `smartCastsWhenTrue`/`smartCastsWhenFalse` derive the narrowings of a
condition (`&&`, `||`, `!`, `is`, `!is`, `== null`, `!= null`); `withSmartCasts`
applies them to the code that only runs when the condition held: the right side
of `&&`/`||`, the branches of `if`, the body of `while`, and the entries of
`when` (with or without subject, `is`/`!is`/`null` conditions, `when (val y = …)`
and the `else` after earlier entries did not match). After
`if (x !is T) return` (also `throw`, `break`, `continue`, a `Nothing` call) the
narrowing holds for the rest of the enclosing block; `BlockNode.visit` ends
narrowings made inside it, which previously stayed until the end of the
function. Narrowings are keyed by the variable's transformed name, so a
shadowing declaration is not narrowed, and `VariableReferenceNode.type()` is
the only place that reads them. An assignment voids the variable's narrowings
(`assignmentVersions`), the target of `x = …` has the declared type, and lambdas
only keep narrowings of immutable variables. As in Kotlin a type test narrows
locals, parameters, top-level `val`s and member `val`s without custom getter and
without `open`/`override`; it does not narrow a `var`, a property with getter or
an open property. Null checks stay more lenient and narrow any variable. A test
narrows only to a subtype of the current type (no intersection types, no type
parameters or type aliases). Only the analysis changes: `NavigationNode.eval`
and calls read members from the actual value, as after an explicit `as`.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (accepted forms and the
rejected ones: after `||`, after the block, `var`/getter/open properties,
assignments, lambdas, shadowing), `node scripts/smoke-kotlite-browser.mjs` (null
checks).
