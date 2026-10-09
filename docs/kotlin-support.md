# Kotlin support and limitations

BlueK interprets a subset of Kotlin, extended from Kotlite. This is not full
Kotlin/JVM compatibility. This reference describes the checked-in interpreter
as of **8 October 2026**. See also the [standard library](kotlin-surface.md),
[tests and saved state](testing.md) and [implementation notes](kotlite.md).

## Project files

A file contains one class, interface or enum, or top-level functions and
properties. Top-level statements are compile errors in project files but are
allowed in the codepad. Imports must be from `kotlin.*`; `java.*` and `javax.*`
are rejected with a file and line diagnostic. Package declarations are not
supported.

## Supported language features

- Primary constructors **with `init` blocks in the same class**; secondary
  constructors, including `constructor(...) : this(...)` delegation.
- Inheritance with `open`, `abstract`, `override` and `super`; interfaces with
  default methods and abstract properties; sealed classes/interfaces and
  exhaustive `when` over their subclasses.
- Nested classes, enums, interfaces and objects; inner classes with access to
  the enclosing object and `this@Outer`.
- Classes referring to each other across files regardless of declaration
  order. Functions and properties can also be referenced before their
  declaration, subject to initialization order below.
- Generic classes and functions, `inline`, `reified`, `noinline`, `crossinline`,
  extension functions, operator overloads, lambdas and scope functions.
- Data classes with `toString`, `equals`, `hashCode`, `copy` and `componentN`.
- Objects, companion objects and `const val`; enums with constructors, members,
  `name`, `ordinal`, `values`, `valueOf`, `entries` and ordering comparisons.
- Destructuring in declarations, loops and lambda parameters, including
  `withIndex` and map entries.
- Custom getters/setters with `field`, `private set`, visibility modifiers,
  default/named arguments, `vararg`, and `lateinit var` in class, local and
  top-level declarations.
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
- In an interface diamond, an ancestor default method can win over a more
  specific subinterface override (`class X : A, K` with `K : A`).
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
- Smart casts support simple names and one-level `name.property` paths for
  eligible `val` properties. They do not support `this.property`, longer paths,
  `this is Type` in extensions, `is T` for type parameters, safe-call conditions,
  intersection types or changes from a later loop iteration. Use explicit casts
  when needed. Mutable/custom-getter properties are not stable smart-cast targets.
- A matching top-level function can win over an implicit receiver function,
  unlike Kotlin. Supertype extension properties on implicit receivers are found
  only if their types contain no type parameters.
- Non-local `break`/`continue` across lambda boundaries are unsupported.
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
