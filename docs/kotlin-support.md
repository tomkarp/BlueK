# Kotlin support and limitations

BlueK interprets a subset of Kotlin, extended from Kotlite. This is not full
Kotlin/JVM compatibility. This reference describes the checked-in interpreter
as of **18 October 2026**. See also the [standard library](kotlin-surface.md),
[tests and saved state](testing.md) and [implementation notes](kotlite.md).

## Project files

A file contains one class, interface or enum, or top-level functions and
properties. Top-level statements are compile errors in project files but are
allowed in the codepad. Imports must be from `kotlin.*`; `java.*` and `javax.*`
are rejected with a file and line diagnostic. Top-level properties need an
initializer, including nullable properties (`var text: String? = null`);
`lateinit var` follows Kotlin's restrictions. Available `kotlin.math` top-level
functions and constants can also be qualified directly, such as
`kotlin.math.abs(-3)`, `kotlin.math.sqrt(16.0)` and `kotlin.math.PI`. Other
package-qualified library expressions and package declarations are not supported.

## Supported language features

- Primary constructors **with `init` blocks in the same class**; secondary
  constructors, including `constructor(...) : this(...)` delegation.
- Inheritance with `open`, `abstract`, `override` and `super`; interfaces with
  default methods and abstract properties. Conflicting inherited methods require
  an override; a shared diamond or a more specific override is selected without
  depending on interface order. `super<Interface>.method()` calls the selected
  immediate supertype implementation while keeping the actual object as `this`.
  See [interface comparison](kotlin-interfaces.md). Sealed classes/interfaces and
  exhaustive `when` over their subclasses.
  Missing `override` on a method uses the Kotlin 2.2.21 compiler's diagnostic
  wording, naming the method and its declaring supertype. Other diagnostics
  may still differ from the Kotlin compiler.
- Nested classes, enums, interfaces and objects; inner classes with access to
  the enclosing object and `this@Outer`.
- Classes referring to each other across files regardless of declaration
  order. Functions and properties can also be referenced before their
  declaration, subject to initialization order below.
- Generic classes and functions, `inline`, `reified`, `noinline`, `crossinline`,
  extension functions, operator overloads, lambdas and scope functions.
- Non-Unit functions with block bodies require an explicit return on every
  continuing path. Throwing exceptions, non-null `Nothing` expressions and
  loops without a reachable exit can prevent normal completion. Expression
  bodies and lambdas retain their implicit result. If-conditions must be
  non-null Boolean expressions; abrupt return/throw expressions remain valid.
  [Control-flow comparison and regression evidence](kotlin-control-flow.md).
- Data classes with `toString`, `equals`, `hashCode`, `copy` and `componentN`.
- Ordinary objects without a custom `toString` use BlueK's
  `<object> : ClassName` representation. This default format is platform-specific
  in Kotlin; BlueK uses a readable marker instead of a hash code or a constructor
  expression. Interface displays translate the marker and omit a repeated type
  in inspector property cells. Custom and data-class text stays unchanged.
- Objects, companion objects and `const val`; enums with constructors, members,
  `name`, `ordinal`, `values`, `valueOf`, `entries` and ordering comparisons.
- Destructuring in declarations, loops and lambda parameters, including
  `withIndex` and map entries.
- Custom getters/setters with `field`, `private set`, visibility modifiers,
  default/named arguments, `vararg`, and `lateinit var` in class, local and
  top-level declarations.
- Delayed local `val` and `var` initialization, including alternative assignments
  in `if`/`else`, exhaustive `when`, exceptions and non-repeating loop paths.
  Reads require initialization on every continuing path; possible `val`
  reassignment is rejected. Backed member properties without an initializer
  must be initialized on every continuing path through ordered `init` blocks.
  [Definite-assignment and nullability comparison](kotlin-flow-state.md).
- Nullability, safe calls, Elvis expressions, standard exceptions and smart
  casts after type/null checks, contracts, assignments and supported loops.
- List/Map/Set, ranges, arrays, loop labels, `break`/`continue`, and statement
  `when` without `else`; exhaustive enum/Boolean `when` expressions.
- Numeric exponents, hex/binary literals, digit separators, `.5`, and Int/Long
  bit operations. `Float` is represented as `Double`.

## Remaining language limitations

### Classes and declarations

- Object expressions (`object : Type { ... }`), named companion objects,
  `fun interface` and `typealias` are unsupported.
- Secondary-constructor delegation to `super(...)` is unsupported; `this(...)`
  delegation works.
- Companion `init` runs on first companion access, rather than construction of
  the first instance of the enclosing class.
- During constructor default-argument analysis, a class's companion can see
  constructor properties only. During initializers it also sees methods and
  properties already analyzed.
- Extension properties with getters and interface properties with a getter or
  initializer are unsupported. Abstract interface properties work.
- Inner-class instances can be created inside the enclosing class, but not
  using `outer.Inner()` from outside. Inner classes have no secondary
  constructors; types such as `Stack<String>.Cursor` cannot be written.
  Classes inside local classes or objects are unsupported. A nested class must
  qualify outer companion members with the outer class name.
- Enum entries with individual bodies and companion objects inside enums are
  unsupported. `values()` returns a list rather than an array.
- Destructuring at project top level is accepted, although Kotlin only allows
  it locally. User `componentN()` methods work, but cannot be declared
  `operator`.
- `internal` behaves as `public`: a BlueK project is one module.

### Calls, inference and smart casts

When a call has one concrete matching signature but an incompatible argument,
the error uses Kotlin 2.2.21's argument type mismatch wording, naming actual and
expected types and pointing at the argument. Diagnostics for unsuccessful
overloads or generic inference may still differ from the Kotlin compiler.
Missing call names use Kotlin 2.2.21's `unresolved reference '<name>'.` at the
function/method name. Reachability follows lexical scope and the actual receiver;
a method on a different class does not turn a missing call into an argument error.

- Callable references accept a name before `::` (`::f`, `String::length`,
  `items::add`, `::Card`), but not expressions such as `Calculator(10)::times`.
- Function-valued properties can be called as methods, but explicit `.invoke()`
  requires a named receiver (`k.f.invoke()`, not `K(4).f.invoke()`).
- Type arguments are inferred from the arguments and from the expected type, as
  in Kotlin: declarations, assignments, returns, Elvis expressions, `if`/`when`
  branches, expected lambda results and parameters of the enclosing call
  (`val m: MutableList<Any> = mutableListOf(1, 2)`, `g(mutableListOf(1, 2))`
  for a `MutableList<Any>` parameter).
- Values of different types get a common supertype as in Kotlin:
  `listOf(40, 40, false)` and `listOf(1, "two")` are `List<Comparable<*>>`,
  `listOf(1, 2.5)` is a `List<Number>`. `Number` is the supertype of Int, Long,
  Double and Byte with toInt/toLong/toDouble/toFloat/toByte. Kotlin's
  intersection types are reduced to one type (Number before Comparable): Kotlin
  infers `Comparable<*> & Serializable` for `listOf(1, "two")`, BlueK only
  `Comparable<*>`.
- Smart casts support local names, `this.property` and chains of stable `val`
  properties. Null/type guards, stable Boolean aliases and safe-call equality
  with non-null values can narrow receivers. Reassigning a root invalidates its
  property paths. Mutable, open and custom-getter properties, and mutable global
  roots, are not stable smart-cast targets. Guards can retain several independent
  interface/class bounds, including their generic members and inferred local
  copies. `this is Type` in extensions, `is T` for type parameters, general
  intersection-type inference, other safe-call conditions and
  inference from later loop iterations remain limited. Use explicit casts or a
  local snapshot when needed.
- A matching top-level function can win over an implicit receiver function,
  unlike Kotlin. Supertype extension properties on implicit receivers are found
  only if their types contain no type parameters.
- Non-local `break`/`continue` across lambda boundaries are unsupported.
- The built-in scope functions (`run`, `with`, `let`, `also`, `apply`) carry their
  trusted exactly-once contracts for local initialization. A nullable safe call
  may skip its lambda. Merely declaring a function `inline` does not grant a
  calls-in-place contract; user-defined contracts are unsupported. Escaping
  callbacks do not initialize their caller's locals during analysis. Simple
  lambdas may use a narrowed local `var` when its binding is not changed inside
  the lambda or afterward; mutable captures and loop writes invalidate unsafe
  narrowings. Assigning to a `val` outside a loop requires that no path can
  revisit that assignment and that every continuing loop exit initializes it.
  A `for` range does not establish that the loop must execute.
  [Generic/inline implementation details](kotlite-generics.md).

### Types and initialization

- `Short`, the spread operator `f(*array)` and `String(charArray)` are missing.
  Arrays also count as lists, and printing them displays contents rather than
  the JVM identity string. Use `chars.concatToString()`.
- Top-level properties initialize in file order. Reading a later property
  directly in an initializer fails analysis; doing so indirectly through a
  function or class fails at runtime with “used before it is initialized”.
  Kotlin/JVM can initialize another file on demand.
- Mutually recursive top-level expression-body functions require a return type
  on the first analyzed function. Member functions without explicit return
  types may be called before declaration unless their own type is recursive.
- More standard-library gaps and behavioral differences are listed in
  [kotlin-surface.md](kotlin-surface.md).

## Waiting, exceptions and runtime

`readln` and `Thread.sleep` can suspend in supported library lambdas. They
cannot pause inside `toString`, `equals`, `hashCode`, `compareTo` or other
non-replayable synchronous callbacks. Such attempts raise an interpreter fault
that student `catch` cannot handle. Other thread APIs are unsupported.

Native library exceptions are mapped to Kotlin classes for `NumberFormatException`,
`IllegalArgumentException`, `IllegalStateException`, `IndexOutOfBoundsException`,
`NoSuchElementException`, `ArithmeticException`, `ConcurrentModificationException`,
`NotImplementedError` and `AssertionError`. Other unmapped library exceptions
require `catch (e: Throwable)`. Standard hierarchy distinctions between
`Exception`, `RuntimeException` and `Error` are preserved.

Stack traces include function, project filename and line, innermost first.
Library calls use “Kotlin library”; codepad-declared functions use “Codepad”.
Package names and columns are omitted. Uncaught `main`/`act` exceptions also
appear in the terminal. An ordinary uncaught program exception ends the call
without rollback; objects remain usable. Interpreter faults require reset.

Recursion is limited to 1,000 nested calls and raises a catchable
`StackOverflowError`; synchronous callbacks can reach a lower host-stack limit.
Self-recursive property accessors produce compile warnings. Only error
severity prevents execution.

Every interactive action reanalyzes previous session source, so long sessions
become slower. Cooperative yielding occurs in ordinary loops after roughly
10 ms of work. Long recursion and synchronous library-callback loops yield
only when finished; Stop still terminates the worker.

## BluePlay and tests

[BluePlay](blueplay.md) follows the pinned BlueJ student API, excluding
JVM/AWT internals and file access. Missing image resources raise a runtime
error. Actor membership and collision use identity, independent of student
`equals`. Inspectors automatically evaluate properties, including `Actor.world`,
which throws if the actor has no world.

[Testing](testing.md) supports four `kotlin.test` annotations and seven basic
assertions. Test inheritance, parameterized tests and additional assertion
variants are unsupported. Saved state repeats constructors and actions;
it does not serialize arbitrary graphs or BluePlay simulations.
