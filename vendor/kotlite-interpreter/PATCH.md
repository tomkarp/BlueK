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
named below. An implementation overview is in `docs/kotlite.md`.

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
(`CheckpointHook(isDue, yield)`) is asked once per `while`, `do-while` and
`for` iteration: `isDue` is a cheap synchronous check, and only when it answers
true does the loop suspend in `yield` (BlueK: after a time slice, not after a
fixed number of iterations). `Interpreter.runImmediately`/`eval()` remain as a synchronous
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
use this to retain their source. A host passes `hostRetained` for values it
keeps alive outside any field (BlueK: the actors of a BluePlay world). Visited
values are tracked in an identity set (`IdentitySet`, a JavaScript `Set`), so
the traversal is linear; the result answers membership by identity. The host
uses this graph to invalidate UI handles, not to implement the JavaScript
garbage collector.

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

Call and lookup costs (BluePlay with many actors). All of these keep the
observable behaviour; they remove work per call, block, property access or
type check:

- `SymbolMap` replaces the hash maps of scopes, objects (`ClassInstance`
  member values) and classes (member tables, interpreter member functions):
  up to eight entries are searched linearly in two small arrays, larger
  tables add a `StringIndex` (a JavaScript `Map`, which caches string hashes;
  Kotlin/JS hashes a string on every lookup). Insertion order is kept.
- A member call binds its receiver once (`SymbolTable.bindReceiver`) to
  `this`, `super` and `this/<Class>` of the class hierarchy; the names come
  from `ClassDefinition.receiverNames` per class. All property lookups of a
  scope consult this binding after the scope's own table, as before for the
  same names. Transformed-symbol tables are no longer filled at runtime (only
  the analyzer reads them).
- Native functions without function-typed, vararg or default parameters
  (`CustomFunctionDeclarationNode.needsCallScope`) are called without receiver,
  parameter and type-alias bindings; they still get a stack frame for the call
  depth and stack traces. Natives that call lambdas or evaluate defaults keep
  the full path.
- `evalFunctionCall` builds type-parameter tables only when there are type
  parameters, skips the runtime check of a `Unit` result of a `Unit` function,
  passes the argument array as a list view and keeps the call's single return
  target in fields instead of a map. Already evaluated arguments travel in an
  array (`ArgumentValues`) instead of a map per call.
- `CallStack.isInsideClassCode()` is a counter. New scopes find their root
  scope through the parent; primitive types and `Any`/`Any?` exist once per
  interpreter and are read from the root scope; `PrimitiveValue` uses it
  directly.
- AST nodes keep runtime resolutions keyed by the class they were made for:
  the member slot of a property access (`ClassInstance.MemberSlot`: part of
  the inheritance chain and key), the member access an implicit-owner
  reference stands for and the iterator calls of a `for` loop per runtime
  type; a loop resolves the type of its variables once per run instead of per
  iteration. Accessor calls are built once per `PropertyAccessorsNode`. A
  block that declares no names runs in the enclosing scope.
- Object type checks (`isAssignableFrom`, `isCastableFrom`) compare the
  precomputed names and allocate nothing for types without arguments;
  `copyOf(isNullable)` returns a type created once per type and nullability.
  Types of classes without own type parameters but with generic ancestors
  (e.g. `IntRange`) are cached per root scope like concrete generic types.

Coverage: the complete `npm run test:regression`, in particular
`npm run test:generics`, `npm run test:kotlin-surface`,
`scripts/smoke-curriculum-kotlin.mjs` (natives with default parameters that use
`this`), `scripts/smoke-kotlite-browser.mjs` and the BluePlay suites;
measurements with `node scripts/benchmark-blueplay.mjs`.

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

Content equality of library values (RT-52): `DelegatedValue` inherited identity
equality from `ClassInstance`, so `listOf(1) == listOf(1)`, `Pair(1, 2) ==
Pair(1, 2)` and `setOf(1 to 2, 1 to 2).size == 2` disagreed with Kotlin, and a
pair printed as `Pair()`. `DelegatedValue.equals`/`hashCode` now delegate to
the wrapped Kotlin `List`, `Set`, `Map` or `Pair` (whose elements compare with
the interpreter's `equals`, including student overrides), and
`convertToString` prints a pair as `(1, a)`. Other host values (iterators,
opaque wrappers) keep identity. The `equals`/`hashCode`/`toString` members of
`Any` call `DelegatedValue.anyEquals`/`anyHashCode`/`anyToString` instead of
going through `ClassInstance`: library classes can have exactly these members
as special functions, so dispatching back would recurse endlessly (first
attempt: `Pair(1, 2) == null` ended in a `StackOverflowError`). Explicit
`listOf(x).toString()` now also uses the elements' own `toString()`, as string
templates already did. Coverage: `node scripts/smoke-curriculum-kotlin.mjs`
(RT-52), `npm run test:runtime-state` (passive inspector text of pairs) and
GUI-90 in `tests/gui/regressions.spec.ts`.

`super` calls that reach `Any` (RT-53): an object consists of one
`ClassInstance` part per class, linked by `parentInstance`, and `super`
evaluates to a part. `Any.equals` compared that part with `other`, so a class
with `override fun equals(other: Any?) = super.equals(other)` was not equal to
itself; `super.hashCode()` differed from `hashCode()` and `super.toString()`
gave `Any()`. A part now knows the part of its subclass (`childInstance`, set
when the subclass part is created), and `ClassInstance.wholeInstance()` returns
the object. `AnyClass.anyEquals`/`anyHashCode`/`anyToString` hold the `Any`
semantics once (whole object, identity, `Name()` without calling a student
override; content equality for `DelegatedValue`), used by the `Any` members and
by hosts: in a class without superclass, `super.toString()` resolves to BlueK's
`Any?` extension with the `Any` part as receiver, which then uses these
functions. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-53).

Exceptions as objects (RT-54): `ThrowableValue` attached the static
`ProvidedClassDefinition`, which is never attached to an analyzer or
interpreter, so `IllegalStateException("x").toString()` and `super.toString()`
in an exception subclass failed with "memberFunctionsForSA not initialized",
and `Exception("a", IllegalStateException("b"))` rejected the cause (the static
definition knows no supertypes). It now uses the registered copy from the
symbol table, as `DelegatedValue` does. `ClassInstance.throwablePart()` finds
the `Throwable` part of an object, also of a student subclass; the `message`,
`cause` and `name` properties, `stackTraceToString()` and the constructors'
`cause` use it (`cause` returns the whole object). `ClassInstance.convertToString`
prints an object with a `Throwable` part like Kotlin's `Throwable.toString()`
without package (`MyEx: x`, `LeerEx`). `ThrowNode` used to throw a new
`ThrowableValue` copy carrying only the class, message and stack trace, so in
`catch (e: KontoException)` the student's fields were missing and `e` was not
the thrown object; it now throws the object's own `Throwable` part, and
`TryNode` matches and binds `wholeInstance()`. `CatchNode.eval` takes a
`ClassInstance`. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-54)
and the RT-38 cases there.

`break`/`continue` in `for` (RT-55): `ForNode.eval` did not catch
`NormalBreakException`/`NormalContinueException` (already upstream), so every
`break` or `continue` in a `for` loop ended the program with
"NormalContinueException: Continue"; `while` and `do-while` caught them. The
loop now catches them like `while`, and the loop variables are undeclared after
a `continue` as after a normal iteration. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-55).

`when` without `else` (RT-56): upstream required `else` in every `when`.
`WhenNode.visit` now accepts a missing `else` and sets `isExhaustive`: true with
`else` or when the regular conditions cover every value of the subject (all
entries of an enum via `MemberType.Enum` navigation, `true` and `false`, plus
`null` for a nullable subject). A non-exhaustive `when` has type `Unit`, and
`WhenNode.eval` returns `Unit` when nothing matches. `requireWhenValue` rejects
it, with Kotlin's message, where its value is used: property initializer,
assignment, `return`, call argument and expression body. Other value positions
(e.g. an operand) are not checked; there `Unit` usually causes a type error.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-56).

Overrides without return type (RT-57): `override fun toString() = "…"` (also
`equals`, `hashCode`) failed with "Cannot infer return type of function
toString", because `ClassDefinition.attachToSemanticAnalyzer` looks up these
special functions, which needs their return type, before the bodies are
analyzed. An override without declared return type now gets the overridden
function's resolved return type as `inferredReturnType` up front;
`FunctionDeclarationNode.visit` then checks that the expression body fits it
(`override fun toString() = 5` is a type mismatch, as in Kotlin) and replaces it
with the body type. Coverage: `node scripts/smoke-curriculum-kotlin.mjs`
(RT-57).

Map entries (RT-58): the stdlib's `MapEntry` values are `DelegatedValue`s
around a Kotlin `Map.Entry` and printed as `MapEntry()`. `DelegatedValue` now
prints them as `a=1` and includes them in content equality (key and value), as
for lists and pairs (RT-52). BlueK's `Map.entries` (`BlueKStdlibModule`) wraps
copies of the entries, because an entry of Kotlin/JS's `LinkedHashMap` throws
`ConcurrentModificationException` once the map changes. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-58) and
`node scripts/smoke-kotlin-surface.mjs`.

Double output (RT-60): `DoubleValue.convertToString` printed Kotlin/JS's
format (`100000000000000000000.0`, `1e-7`; whole numbers only got `.0`
appended). `DoubleValue.kotlinJvmText` now follows Kotlin/JVM's
`Double.toString()`: plain from 10^-3 up to below 10^7, otherwise
`1.2345678E7` / `1.0E-4`, keeping JavaScript's shortest round-trip digits.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-60).

`NullPointerExceptionValue` (RT-61): the default message was the text
`"null"`, so `null!!` printed `NullPointerException: null` and `e.message`
was the string "null". The default is now `null`, as in Kotlin. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-61).

`DelegatedValue` also prints a Kotlin `Triple` as `(1, a, b)` and compares it
by content, and prints a `StringBuilder` as its content (RT-62). The classes
themselves (`Triple`, `StringBuilder`, `Random`) and `buildString` are BlueK's
(`BlueKStdlibModule`). Coverage: `node scripts/smoke-kotlin-surface.mjs` and
`node scripts/smoke-kotlite-browser.mjs` (RT-62).

Implicit receivers (RT-63): an unqualified call `f(...)` only searched callables
without receiver and members of the implicit receiver, so `liste.apply { add(1) }`,
`"abc".run { uppercase() }` and `gruss()` for `fun Hund.gruss()` inside `Hund`
failed. When no such callable matches, `FunctionCallNode.visit` now analyzes the
call again as `this.f(...)` (`visitThroughImplicitReceiver`) and runs it via
`resolvedInvoke`, like `f.invoke(...)`; a failed attempt restores the scope and
reports the original error. Calls that resolved before resolve the same; a
matching top-level function therefore still wins over an extension of the
receiver (Kotlin prefers the receiver). `copyReceiverIntoCurrentScope` also
declares extension properties of the receiver's supertypes (`size` of `List` for
a `MutableList`), closest first, but only those whose type uses none of their
type parameters (otherwise "Unknown type T"). Only the innermost `this` is
tried. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-63).

`data class` (RT-64): `ClassModifier.data`; `data` is a modifier only directly
before `class` (`Parser.isDataClassModifier`, used by `modifiers()`,
`declaration()` and `statement()`), so `val data = ...` stays valid.
`Parser.dataClassMembers` checks Kotlin's rules (at least one primary
constructor parameter, only `val`/`var` parameters, no `open`/`abstract`/`enum`)
and appends the generated members as Kotlin source parsed with a sub-parser:
`toString()` (`Punkt(x=1, y=2)`), `equals()` (`this === other`, `is Name<*>`,
property `==`), `hashCode()` (`31 * result + p.hashCode()`), `componentN()`
(without `operator`, which Kotlite rejects for these names) and
`copy(p = this.p, ...)`. Members the class declares itself are not generated.
The source starts on the class's line so messages point there.
`FunctionDeclarationNode.isGenerated` marks them; BlueK's manifest hides them.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-64) and the RT-64
browser test in `tests/gui/regressions.spec.ts`.

Destructuring (RT-65): the parser rewrites destructuring into plain nodes.
`val (a, _, c: Int) = e` (also `var`, in `statement()`) becomes a hidden
property `<destructuring line:col>` holding `e` and `val a = <hidden>.component1()`
per named component, wrapped in a parse-only `DestructuringDeclarationNode` that
`statements()`, `script()` and `controlStructureBody()` flatten (the analyzer,
interpreter and code generator reject it if it ever arrives). The hidden name
contains `<` (no Kotlin name does) and the position, so Codepad inputs do not
collide. `for ((k, v) in e)` and lambda parameters `{ (k, v) -> }` get a hidden
loop variable or parameter and the component properties at the start of the
body; a lambda starting with a parenthesized expression still falls back to no
parameters. `propertyDeclaration` (class members) rejects destructuring as
Kotlin does. `DelegatedValue` prints and compares Kotlin's `IndexedValue`;
`componentN` for built-in types and `withIndex()` are BlueK's
(`BlueKStdlibModule`). Coverage: `node scripts/smoke-curriculum-kotlin.mjs`
(RT-65) and `node scripts/smoke-kotlin-surface.mjs`.

`vararg` in extension functions (RT-66): an extension function is registered as
a copy (`FunctionDeclarationNode.copy`, `CustomFunctionDeclarationNode.copy`),
and the copy lost `isVararg`, so `fun String.f(vararg a: Int)` and library
extensions such as BlueK's `String.format` accepted exactly one argument. Both
copies keep `isVararg` (and `isGenerated`). Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-66) and
`node scripts/smoke-kotlin-surface.mjs` (`format`).

Objects and companion objects (RT-67): the parser reads `object Name [: …] { … }`
and `companion object [: …] { … }` into a `ClassDeclarationNode` with
`isObject`; the companion becomes `companionObject` of its class, named
`<Class>.Companion` like the implicit companion class Kotlite already declared
for enums and `fun X.Companion.f()` (which a class with a declared companion and
an object no longer get). `ClassDefinition.isObjectDeclaration` forbids `Name()`;
the interpreter creates the single instance on first use through
`evalCreateClassInstance` and keeps it in `ClassDefinition.objectInstance`, set as
soon as construction starts and cleared again if it throws. Code refers to it as
`object/<Class>` (`OBJECT_REF_PREFIX`): the analyzer sets that as
`transformedRefName` of an object's name and as owner of companion members, and
`VariableReferenceNode.eval` resolves it; lambdas do not capture it. Inside a
class (and its subclasses) companion members are found by plain name through a
scope that `declareClassesAhead` puts around the class scopes; it is filled from
the analyzed companion class scope (`SymbolTable.declareObjectMembersFrom`) when
code of the class first looks up one of the companion's names (new hook
`SemanticAnalyzerSymbolTable.beforePropertyLookup`, plus `beforeFunctionLookup`).
A qualified access before the class is analyzed analyzes the class first. For a
class with a companion, constructor properties get their declared types before
default arguments are analyzed. Private members are shared between a class and
its companion (`canAccessPrivateMembersOf`). Objects print as their name.
`const` is accepted (`PropertyModifier.const`) and checked like Kotlin (top
level, object or companion; `val`; primitive or `String`; constant initializer).
A class name alone evaluates to its companion; `X.Companion` parses as a type
(for Codepad result bindings). Unrelated fix found on the way: calls on the
companion of a generic class (`Box.von(5)`) converted `Class<Box>` without type
arguments and failed; the call analysis now unboxes the companion type.
Rejected with own messages: named companions, nested objects/classes, local
objects and object expressions. Coverage: `node scripts/smoke-curriculum-kotlin.mjs`
(RT-67) and the RT-67 browser test in `tests/gui/regressions.spec.ts`.

Member functions without return type (RT-68): `FunctionDeclarationNode.returnType`
threw `CannotInferTypeException` until the function's own body was analyzed, so
`fun a() = b(); fun b() = 1` in a class, a property initializer calling a later
method, or another class/companion calling it during the class's analysis failed.
After `attachToSemanticAnalyzer`, `visitClassBody` gives every such member function
of a class declared ahead a `returnTypeInference` hook; the `returnType` getter
runs it once, which analyzes the function in the class's member scope via
`analyzeAtTopLevel`, and the member function loop skips it afterwards. Function
owners are declared before the hooks (they were declared after the property
loop), so a method analyzed early is still called through `this`. A function
whose type depends on itself fails with "…, because it depends on itself"
(`isInferringReturnType`); an error in an early analyzed body is rethrown in the
function's turn, even if the code that needed it caught it. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-67, RT-68).

Implicit `this` calls in lambdas (RT-69): an unqualified call of a member function
that `findAllMatchingCallables` found through the implicit receiver (and not in
the class scope, e.g. because it is declared further down or inherited) had no
owner, so the interpreter read `this` at call time. In a lambda run by a library
function (`listOf(1).map { f() }`) the dynamic scope chain yields that function's
receiver (the list) and the call failed with "Function `f` not found on implicit
receiver". The analyzer now gives such a call the owner `this/<Class>` of the
enclosing class and records it for the lambda's captures, like member property
accesses. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-69).

Line break after `=` (RT-70): `propertyDeclaration` and named value arguments did
not skip newlines after `=`, unlike Kotlin's grammar (`'=' {NL} expression`), so
`val symbol =` followed by the `when` on the next line (as BlueK's formatter
writes long values) was "Unexpected token NewLine". Both now call `repeatedNL()`.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-70) and the RT-70
browser test (format, then compile).

Stack traces (RT-71): `CallStack.getStacktrace` printed each function-call record
with its own call position (`pruefe (<BlueK project>:11:22)`), one frame off from
Kotlin, and native exceptions had no frames. Frames now follow Kotlin: innermost
first, each frame (`ActivationRecord.frameName`: `Karte.wert` with the declaring
class for members, `Karte.<init>` for constructors, `<lambda>`) with the position
its code has reached; a new exception object starts where it is created (the
constructors creating it are skipped), native frames (`isNative`) have no
position, and a trailing top-level frame carries the position of top-level code.
Hosts format lines through `Interpreter.stackFrameFormatter` (default
`name(file:line)`). Host exceptions record the stack when they leave the first
frame (`recordHostException` in both call paths, using `statementPosition`, the
statement the innermost function reached); `toValue()` attaches it.
`stackTraceToString()` returns the `printStackTrace()` text (`MyEx: x` plus one
`    at …` line per frame) like Kotlin. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-38, RT-71).

Number literals (RT-74): `Lexer.readNumber` follows Kotlin's grammar: `_` between
digits, hex (`0x…`) and binary (`0b…`) integers, fractions, exponents (`1e10`,
`2.5E-3`, also without fraction) and the `L` and `f`/`F` suffixes. An integer
literal without `L` is an Int if it fits (also for hex: `0xFFFFFFFF` is a Long),
else a Long, as before for decimal literals. Malformed literals (`1_`, `0x`)
are lexer errors. `readInteger` and the `compareString` check are gone.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-74).

Calling properties of a function type (RT-75): `objekt.f()` for `val f: () -> Int`
was "unknown member", and `f()` inside the class (resolved as a property with
owner `this/<Class>`) failed at runtime because the owner call took the member
function path. When the member-function lookup of `objekt.f(…)` fails, the
analyzer now checks for a non-nullable function-typed property `f` (nullable only
through `?.`), checks the arguments against its function type and marks the call
`CallableType.Property`; the interpreter reads the property from the evaluated
subject and calls the lambda (`FunctionCallNode.eval`, navigation branch, also
used by owner calls). `objekt.f.invoke()` is rewritten to `objekt.f()` when the
subject is a plain name (it is analyzed twice). Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-75).

Covariant override return types (RT-76): `visitClassBody` required an override's
return type to equal the overridden one; like Kotlin it now only needs to be a
subtype (`override fun nachwuchs(): Hund` for `open fun nachwuchs(): Tier`, also
for interface functions and for inferred types such as `override fun alter() = 3`
for `open fun alter(): Any`). Coverage: `node scripts/smoke-curriculum-kotlin.mjs`
(RT-76).

Reachability of objects with overridden properties (RT-77):
`ClassInstance.getAllMemberProperties` merged the properties of all parts of an
object with the strict `merge`, but an overridden property is in both parts, so
`reachableRuntimeValues` (BlueK's reference check after each Codepad command)
threw "Duplicate key while merging maps". It is replaced by
`getAllMemberPropertyAccessors`, a list of the accessors of every part.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-77).

Enums (RT-78): entries printed as `Farbe()`; `name`, `ordinal` and `values()` were
missing; members after `;` were a parse error (`enumClassBody` checked `;` as a
`Symbol`, but the lexer emits `Semicolon`, and it never parsed members); and
`Farbe("X")` created a new entry. Now `ClassInstance.enumName`/`enumOrdinal` are
set when the entries are created and `convertToString` returns the name (an own
`toString()` still wins); `name` and `ordinal` are extension properties of the
enum type, declared like `entries` (and, with owner `this/<Enum>`, in the class
scope for plain use inside the class); `values()` joins `valueOf` in the implicit
companion and returns a List (BlueK has no arrays). Inside an enum class its
entries can be named without the class (`enum/<Enum>/<ENTRY>`, `ENUM_REF_PREFIX`,
also for `when` exhaustiveness). Constructor calls of an enum class are rejected
("Enum types cannot be instantiated"). Entries with a body and a companion object
in an enum class are rejected with own messages. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-78).

Interfaces with default functions and properties, abstract properties (RT-79):
interface functions may have a body (`functionDeclaration(isBodyOptional = true)`
parses one if `=` or `{` follows; such a function is open but not abstract);
interface properties without initializer or accessors are abstract and open;
`abstract val` is accepted in abstract classes (no initializer or accessors).
`ClassDefinition.addProperty` no longer rejects interfaces, overriding an
interface property needs `override`, and a concrete class must implement every
abstract property of its superclasses and interfaces, also as a constructor
property ("Class `Hund` is not abstract and does not implement the abstract
property `laut`"). A member call binds `this/<Interface>` for all interfaces of
the receiver's class hierarchy (`ClassDefinition.receiverNames`), so default
functions reach the object's members. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-79).

`protected` and `internal` (RT-80): both were parse errors. `protected` is a
property and function modifier (`PropertyModifier.protected`,
`FunctionModifier.protected`, also on constructor properties); qualified access is
allowed from the declaring class, its subclasses and their companions
(`canAccessProtectedMembersOf`, `ClassDefinition.isProtectedMemberProperty`).
`internal` is accepted and dropped, since a BlueK project is one module. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-80) and
`node scripts/smoke-kotlite-browser.mjs`.

`lateinit var` (RT-81): accepted for class properties (`PropertyModifier.lateinit`)
with Kotlin's rules (only `var`, no initializer or accessors, not nullable, not a
primitive type) and without the "must be initialized" check. Reading any property
before its first assignment throws `UninitializedPropertyAccessException`
(`RuntimeValueHolder.read`, previously a host NullPointerException without
message); member reads rethrow it with Kotlin's message "lateinit property x has
not been initialized" (`ClassDefinition.isLateinitMemberProperty`). The class is
registered as a standard exception, catchable by name. Passive reads for
inspectors (`readBackingPropertyByDeclaredName`) return null for unassigned
properties. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-81).

Uncaught exceptions (RT-82): `Interpreter.stacktraceOf(e)` returns the Kotlin
stack trace of an exception that left the program (the thrown object's trace, or
the recorded trace of a host exception such as `NumberFormatException`), so
BlueK can print `Exception in thread "main" …` like Kotlin. Coverage:
`node scripts/smoke-runtime-state.mjs` and the browser test RT-82.

Secondary constructor delegation (RT-83): `constructor(...) : this(...)` was rejected,
and so was any secondary constructor next to a primary one. The parser reads the
delegation (`ClassSecondaryConstructorNode.delegationArguments`, body optional) and
builds `delegationCall` as `ClassName<T>(arguments)`; with a primary constructor a
secondary one must delegate ("Primary constructor call expected"), constructors with
the same parameter types conflict, and `: super(...)` gets its own message. The
analyzer visits the delegation in the constructor's parameter scope and reports
cycles ("There's a cycle in the delegation calls chain"). Constructor candidates are
the primary constructor (index null) plus the secondary ones. The interpreter binds
the parameters (with defaults), creates the object through the delegation, then runs
the body. Overload resolution prefers, like Kotlin, a candidate that needs no default
values (`f(1)` with `f(a)` and `f(a, b = 2)`). Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-83), `node scripts/smoke-kotlite-browser.mjs`
and the browser test RT-83.

Comparable enums (RT-84): like Kotlin's `Enum`, every enum class implements
`Comparable<E>` with a generated `compareTo` by `ordinal` (`Parser.enumClassMembers`,
marked as generated), so `<`, `compareTo`, `sorted()`, `maxOrNull()` and `a..b` work.
Declaring `compareTo(other: E)` in an enum is an error (final in Kotlin). Enum classes
may now implement interfaces; only extending a class is rejected ("Enum class cannot
inherit from classes"). Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-84).

Labeled loops (RT-85): `outer@ for`, `outer@ while` and `outer@ do` were parse errors,
and so were `break@outer` and `continue@outer`. The parser sets `label` on the loop
node and the jump's `returnToLabel`; the analyzer rejects a label that no enclosing
loop has ("There is no loop with the label `x`"). `NormalBreakException` and
`NormalContinueException` carry the label, and a loop handles only unlabeled jumps
and its own. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-85).

Sealed classes (RT-86): `sealed` was rejected. It is now a class modifier
(`ClassModifier.sealed`); a sealed class is also abstract, and `sealed interface` is
allowed. A `when` on a sealed type is exhaustive without `else` when its `is` tests and
`object` entries cover every subclass declared in the project, recursively for sealed
subclasses (`WhenNode.coversSealedClass`). As a BlueK project is one module, subclasses
may be in any file. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-86).

`.5` (RT-87): the lexer reads a `.` followed by a digit as the start of a number, like
Kotlin's DoubleLiteral; `1..5` stays a range because `..` is not followed by a digit.
The bit operations of RT-87 are BlueK stdlib functions. Coverage:
`node scripts/smoke-kotlin-surface.mjs`.

Local and top-level `lateinit var` (RT-88): the analyzer no longer restricts `lateinit`
to class properties. `SymbolTable.read` throws `UninitializedPropertyAccessException`
for a declared variable without a value (was "has not been declared"), and the
interpreter remembers lateinit declarations (`lateinitRefNames`) to rethrow it with
Kotlin's message "lateinit property x has not been initialized". Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-88).

Function references (RT-89): `::f`, `Typ::f`, `name::f` were parse errors. The parser turns
them into a `LambdaLiteralNode` with `referenceReceiver`/`referenceName` and a placeholder
body; `SemanticAnalyzer.buildFunctionReference` creates the parameters from the expected
function type (or from the only function `f` for `::f` without one) and the call:
`f(p…)`, `p0.f(p…)` or `p0.property` for a type receiver, `name.f(p…)` for a variable. The
argument count check of lambda arguments skips references. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-89).

`this` in lambdas (RT-90): lambda arguments of member and extension calls were created after
`this` became the call's receiver, so `liste.map { this.f(it) }` used the list as `this`.
`evalClassMemberAnyFunctionCall` now evaluates lambda arguments in the caller's scope like the
other arguments, and a lambda without receiver keeps the `this` of the place where it is
created, also for nested lambdas. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-90).

Lambdas without `this` (PERF-06): the RT-90 capture of `this` looked it up with
`runCatching { getPropertyHolder("this") }`. A lambda at the top level has no `this`, so
every such lambda created and caught an exception (twice the creation time), and the catch
could also swallow a host stack overflow. `SymbolTable.findPropertyHolder` returns null
instead; `getPropertyHolder` uses it. Coverage: `node scripts/benchmark-interpreter.mjs`
(case "lambda creation") and `node scripts/smoke-curriculum-kotlin.mjs` (RT-90).

Nested classes (RT-91): a class, enum, interface or object in a class body was rejected. The
parser names it `<Outer>.<Name>` (`ClassDeclarationNode.outerClassName`) and lists it after
its outer class at the top level (`nestedClasses`, `flattened()`), so the analyzer and the
interpreter treat it like any top-level class. Because a simple name inside the outer class
may come before the nested declaration, `script()` parses again when it found nested classes,
now knowing all of them (`Parser.nestedClasses`); a project without nested classes is parsed
once as before. Inside the outer class (and its nested classes) `Knoten` becomes
`Liste.Knoten`, outside `Liste.Knoten` is a variable reference or type (`typeReference`
accepts `.Name` with a capital letter). `private` nested classes are rejected outside their
outer class; a nested data class prints its simple name. Classes in local classes or objects
stay unsupported. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-91).

Inner classes (RT-92): `inner class` gets a hidden first constructor property `this/<Outer>`
(type `<Outer><*>`), and the parser passes `this` (or, in another inner class, `this/<Outer>`)
as first argument of every constructor call; outside the outer class's code the call is
rejected like in Kotlin. The analyzer pushes a scope that provides the outer class's members
on lookup, owned by `this/<Outer>` (`SymbolTable.declareObjectMemberFrom`), and the outer
type parameters by their bounds. The interpreter keeps `ClassInstance.outerInstance` and
binds the outer object's `this/<Class>` names in member calls and initializers
(`bindOuterReceivers`); generic resolutions of the outer object apply too. `this@Outer`
becomes `this` or `this/<Outer>`. `inner` is a modifier only before `class` or another
modifier, like `data`. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-92).

Generic classes (RT-93): three faults, all present since the first BlueK commit.
Property initializers ran without the class's type arguments (`init` blocks had them), so
`val elemente = mutableListOf<T>()` failed with "Cannot resolve type T"; constructClassInstance
now declares the type aliases and their resolutions in the initializer scope. Assigning a
property checked `List<T>` without resolving `T` inside type arguments (`ClassInstance.
resolveTypeParameter` now resolves nested arguments), so `class Box<T>(val inhalt: List<T>)`
failed. And the return type of a call through a receiver (`liste[0]`, `get`) was resolved
twice, the second time with the function's own type parameters, which also replaced a caller's
type parameter of the same name: `T` in `List<List<T>>[0]` became `List<List<T>>`; type
parameters already resolved through the receiver are skipped now. Calls such as `emptyList()`
also take their expected type from the left side of `?:`, `return` and expression bodies
(was: declarations only). Return type mismatches name the type arguments. Coverage:
`node scripts/smoke-curriculum-kotlin.mjs` (RT-93), `node scripts/smoke-kotlin-surface.mjs`.

Early type arguments from the expected type (RT-95): a generic call whose type parameters
appear only in its return type (`compareBy`, `reverseOrder`, `emptyMap`) now unifies the
expected type with the declared return type before the lambda arguments are analyzed, so
`val c: Comparator<Person> = compareBy { it.alter }` gives `it` the type `Person` instead of
`Any`. Explicit type arguments and types inferred from other arguments take precedence.
A call nested in an argument (`sortedWith(compareBy { it.alter })`) still gets no expected
type, because arguments are analyzed before the outer overload is chosen; there `compareBy<Person>`
is needed. Coverage: `node scripts/smoke-kotlin-surface.mjs` (RT-95).

Library classes with a concretely typed superclass (RT-96): for an extension function on a
class with a superclass, `copyReceiverIntoCurrentScope` looked up the superclass's type
arguments in the resolutions of the class itself. That only worked while both used the same
type parameter names (`MutableList<T> : List<T>`); BlueK's `IntArray : List<Int>` failed with a
NullPointerException when the session started. It now reads the resolutions of the superclass.
Coverage: `node scripts/smoke-kotlin-surface.mjs` (RT-96).

Assignment targets, `public`, exception hierarchy (RT-97), found by running official Kotlin
codegen box tests (`scripts/conformance-kotlin.mjs`):
- `a[i]++` and `--a[i]` had no write path (`UnsupportedOperationException`); the analyzer now
  builds the `set` call (`UnaryOpNode.assignFunctionCall`). `liste[0].punkte += 1` and
  `f().x += 1` failed with a NullPointerException, because the receiver of a compound
  assignment was not analyzed before its type was asked for; `visitAssignment` now visits it.
- The target of `=`, `+=` and `++` is evaluated once, before the right side, like in Kotlin
  (`Interpreter.evalTarget`/`readTarget`/`writeTarget`; `FunctionCallNode.eval(replaceSubject)`,
  `NavigationNode.evalOn`/`writeOn`). Before, `a[f()] += 1` called `f()` twice and read and
  wrote different elements: `h[(0..5).random()] += 1` counted 609 of 600 throws.
- `public` is accepted as a modifier without effect, like `internal`.
- `RuntimeException` between `Exception` and `IllegalArgumentException`, `IllegalStateException`,
  `IndexOutOfBoundsException`, `NoSuchElementException`, `ArithmeticException`,
  `UnsupportedOperationException`, `UninitializedPropertyAccessException` and
  `NullPointerException`; new `ClassCastException` (superclass of `TypeCastException`),
  `ConcurrentModificationException`, `AssertionError` and `NotImplementedError` (for `TODO()`),
  the last two `Error`s. The exceptions register before `NullPointerException` and
  `TypeCastException` now, which extend them.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-97), `npm run test:conformance`.

Smart casts by contract (RT-98): `x.isNullOrEmpty()` and `x.isNullOrBlank()` returning `false`
make `x` non-null, as Kotlin's contracts of these functions do (`if (e.isNullOrEmpty()) a else e`,
`if (!l.isNullOrEmpty()) l.size`, `||` chains, `when` without subject); `smartCastsWhenFalse`
treats such a call on a simple name like `x == null`. Reported with a student-style Blackjack
project. Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-98).

Smart casts checked systematically (RT-99): 60 cases Kotlin accepts and 24 it rejects.
- `for (s in liste)` over a list with `null` elements failed at runtime ("Return value's type
  Nothing? cannot be casted to String in function `next`"): the published stdlib records the
  type argument without `?`. `ForNode.eval` lets `next()` return `null`; the analyzer has typed
  the loop variables.
- `x ?: return 0` had the common supertype of `x` and `Int` (`Comparable<Any>`); a fallback
  that never completes gives the type of `x` (`ElvisOpNode.type`).
- Narrowings after a statement (`BlockNode.visit` via `smartCastsAfter`): `x ?: return`, `x!!`,
  `x as T`, `requireNotNull(x)`, `checkNotNull(x)`, `require(…)`, `check(…)`, and a non-null value
  assigned to or declared for a nullable variable (`var s: String? = "a"; s.length`).
- `if` joins the narrowings at the end of both branches (`if (s == null) s = "neu"`); a branch
  that never completes contributes the other branch's end state, not its condition, which also
  fixes `if (s != null) { s = null } else { return }; s.length` being accepted.
- `while`/`do-while` left without `break` (tracked per loop in `loopBreaks`) narrow by the negated
  condition: `while (zahl == null) { zahl = … }; zahl + 1`.
- `name.property` narrows like a name when the property is a `val` without custom getter that
  is not open (`propertySmartCastKey`, consulted by `NavigationNode.type`); an assignment to
  `name` voids it.
- `s += "x"` on a smart-cast variable crashed: the analyzer leaves `VariableReferenceNode.type`
  empty where a smart cast applied, and `+=` read it. `+=` concatenates by the value now
  (`null` of a `String?` as "null"), `declaredType()` falls back to the symbol table. Found by
  the official test `strings/kt894.kt` once declarations narrowed.
Coverage: `node scripts/smoke-curriculum-kotlin.mjs` (RT-99), `npm run test:conformance`.

Type arguments from the enclosing call and from a lambda's expected result (RT-100):
- A lambda's last expression gets the lambda's expected return type when that is concrete
  (`getOrPut(k) { mutableListOf() }`, `ifEmpty { emptyList() }`; `LambdaLiteralNode.visit`).
- In the first pass of an enclosing call (`isSkipGenerics`), a call whose type parameters are
  still open and needed by its lambdas' parameters (or by nothing else) answers a provisional
  return type: the open parameters become `<Repeated>` placeholders named with
  `PROVISIONAL_TYPE_PREFIX`. Such placeholders do not take part in inferring the enclosing call's
  type arguments, and match an invariant parameter (`DataType.isConvertibleFrom`). Before its
  second pass the enclosing call gives each call argument the resolved parameter type as expected
  type, which the early unification of RT-95 uses (`sortedWith(compareBy { it.alter })`,
  `sortedWith(reverseOrder())`, `f(mutableListOf())`, `Pair(emptyList(), 1)` with a declared type).
- A `.` call with an expected type whose receiver is a call that stayed provisional resolves
  itself first, derives the receiver's expected type from its own return type and analyzes the
  receiver again (`compareBy { it.a }.thenBy { it.n }`).
- An unrestricted placeholder match broke `mutableListOf(1).add("x")` (accepted), and analyzing
  every chained receiver twice broke `reified T` in `filter { … }.map { it as T }`; both were
  caught by `smoke-curriculum-kotlin` and `smoke-generics-boundaries` and are restricted as above.
Coverage: `node scripts/smoke-kotlin-surface.mjs` (RT-100), `npm run test:conformance`.

## 2026-10-06: portable kotlin.test-Annotationen und Testnamen

- Lexer liest echte Kotlin-Bezeichner in Backticks ohne die Backticks als Teil
  des Namens (insbesondere Testnamen mit Leerzeichen).
- Parser löst `kotlin.test.Test`, `BeforeTest`, `AfterTest`, `Ignore` über
  Einzel-/Wildcard-Imports, Alias oder qualifizierten Namen auf. Andere
  Annotationen, doppelte Annotationen und Annotationen auf Properties/Objekten
  werden abgewiesen. Function-/Class-AST behält Annotationen und Endpositionen
  für Discovery und Quelltexterzeugung im Host. Der Interpreter ignoriert die
  Host-Metadaten bei gewöhnlichen Aufrufen; keine zweite Test-Ausführungsschiene.
- Analyzer ergänzt die bestehenden Smartcast-Regeln für `assertNotNull`,
  `assertTrue`, `assertFalse`. Assertions selbst leben nativ im Browser-Modul.
- Nachweise: `smoke-testing.mjs`, `smoke-kotlin-surface.mjs` und
  `tests/gui/testing.spec.ts`; konkrete Laufresultate in der Regression-Checkliste.

- Die Double-Konformitätsprobe der neuen Assertions fand einen bestehenden
  Fehler im Unary-Operator: `-0.0` wurde als `0 - 0.0` positiv. Double-Unary-Minus
  verwendet jetzt echte Negation; Unary-Plus erhält das Vorzeichen. Nachweis:
  `assertNotEquals(0.0, -0.0)` und generische NaN-Gleichheit in der Stdlib-Probe.

- Der Konformitätslauf fing danach `whenSubjectVariable/ieee754Equality.kt` ab:
  Vergleichsoperatoren verwendeten für Double `compareTo` und ordneten negative
  Null unter positive Null ein. Numerische `<`, `<=`, `>` und `>=` verwenden jetzt
  IEEE-Vergleiche; explizites `Double.compareTo` behält seine totale Ordnung.
  Zusätzliche Proben für beide Nullwerte, NaN und gemischte Int-/Double-Operanden
  in `smoke-kotlin-surface.mjs`, dieselben Null-/NaN-Assertions auch auf der JVM.

- `ScriptNode.sourceRanges` speichert die ursprünglichen Anweisungsgrenzen vor
  dem Auflösen verschachtelter Deklarationen. Fixture-Replay verwendet diese
  Parser-Spannen statt Zeilen und rückt nur die erste Zeile einer Anweisung ein,
  damit mehrzeilige String-Argumente unverändert bleiben. Zwei Fixture-Roundtrips
  und derselbe erzeugte Test auf der JVM sind in `smoke-testing.mjs` abgesichert.

## 2026-10-07: genaue Quellspannen für Zustands-Roundtrips

- Property-AST speichert Deklarationsbeginn/-ende sowie den Initialisierer
  getrennt von Accessoren; Function-AST beginnt vor Modifikatoren und
  Annotationen (auch Alias/qualifizierte Annotationen). Init-Blöcke behalten
  ihre Endposition. Der Host kann gespeicherte Zustände dadurch ohne
  Heuristik für `=` oder Annotationstext ersetzen und erneut erfassen.
- Die Zusatzmetadaten verändern die Ausführung nicht. Nachweis:
  `smoke-testing.mjs` für private Attribute, Getter, Alias-/qualifizierte
  Setup-Annotationen und wiederholten Transfer eines Init-Zustands.

## 2026-10-09: gemeinsamer Obertyp wie in Kotlin (RT-106)

- `superTypeOf` bildet für gleiche Klassen mit verschiedenen Typargumenten die
  kleinste obere Schranke wie Kotlin: gleiche Argumente bleiben, kovariante
  (`List<out T>`) erhalten ihren gemeinsamen Obertyp, alle anderen werden zur
  Star-Projektion. `listOf(40, 40, false)`, `listOf(1, "zwei")`, gemischte
  `setOf`/`mapOf`/`arrayOf`, verschachtelte Listen und `if`/`else` mit
  verschiedenen Typen ergeben `…<Comparable<*>>` statt eines Fehlers mit
  `Comparable<Any>`. `RepeatedType.equals` hält alle Platzhalter für gleich;
  der Vergleich nutzt deshalb zusätzlich den beschreibenden Namen.
- `ObjectType.isConvertibleFrom` akzeptiert für ein Star-Argument jedes
  Argument (wie `isAssignableFrom`). `StarType` und `TypeNode` schreiben `*`
  ohne `?`, damit erzeugter Quelltext (Codepad-Bindungen) gültiges Kotlin bleibt.
- `Pair` deklariert `out A, out B` wie Kotlin, damit `mapOf` mit gemischten
  Schlüssel-/Werttypen passt.
- Ein invariantes Typargument des Empfängers legt seinen Typparameter fest:
  `mutableListOf(1).add("x")` bleibt ein Fehler, statt die Liste über den neuen
  gemeinsamen Obertyp zu verbreitern.
- BlueKs eigenes `Map.containsKey` (RT-59) entfällt: das `Map<K, *>.containsKey`
  der Kotlite-Stdlib passt jetzt und war sonst mehrdeutig.
- Nicht nachgebaut: Kotlins Schnittmengentypen (Kotlite wählt einen Obertyp),
  `Number`, die `out`-Projektion von `mutableListOf(1, "a")` (Kotlin verbietet
  dort `add`) und die Verbreiterung durch einen erwarteten invarianten Typ.
- Nachweis: RT-106 in `smoke-curriculum-kotlin.mjs` (Erwartungswerte mit
  kotlinc geprüft), RT-63 weiterhin abgelehnt, `smoke-kotlin-surface.mjs`.

## 2026-10-09: erwarteter Typ und `Number` (RT-107, RT-108)

- Der erwartete Typ legt abgeleitete Typargumente auch dann fest, wenn die
  Argumente einen engeren Typ ergeben, der in ihn passt:
  `val m: MutableList<Any> = mutableListOf(1, 2)`. Bisher galt er nur für noch
  offene Typargumente (`mutableListOf()`). `propagateExpectedType` reicht ihn
  von Deklaration, Zuweisung, `return` und Ausdrucksfunktion durch `if`/`when`
  und Blöcke an die Aufrufe weiter.
- Passt kein Callable, wird die Auswahl mit offenen Typargumenten generischer
  Argument-Aufrufe wiederholt (vorläufige Typen wie RT-100); der gewählte
  Parametertyp wird dann zum erwarteten Typ des Arguments:
  `g(mutableListOf(1, 2))` für `MutableList<Any>`. Gültiger Code wählt
  unverändert, weil der zweite Versuch nur nach einem leeren ersten läuft.
- `Number` ist ein eingebautes Interface vor `Comparable` in Int, Long, Double
  und Byte, damit der gemeinsame Obertyp von `1` und `2.5` `Number` ist. Die
  Umwandlungen sind native Erweiterungen in `BlueKStdlibModule`.
- Nachweis: RT-107/108 in `smoke-curriculum-kotlin.mjs` (Erwartungswerte mit
  kotlinc geprüft), Number in `smoke-kotlin-surface.mjs`.


## 2026-10-09: qualified math expressions (Issue 22)

`ExecutionEnvironment.installQualified` registers explicit package names for
native top-level function overloads and read-only constants. BlueK supplies
`kotlin.math` from its installed Math module. Qualified functions preserve
native callback/suspension metadata and use the normal call path and depth
accounting. The analyzer resolves dotted AST identifiers to those exports;
constant access evaluates the resolved property without treating a package as
an object. It rejects writes to qualified constants. A property or class with
the package root's name retains ordinary member semantics. Neither source text
nor strings/comments are rewritten, and diagnostics retain source positions.
No general package declarations or import-alias semantics are added.

The obsolete unsupported-qualified-math gap/hint expectations were removed.
Interpreter build and manual browser observations are recorded in the
regression checklist; no new automated tests are claimed.
