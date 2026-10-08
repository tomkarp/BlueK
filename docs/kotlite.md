# Kotlite in BlueK

BlueK runs student Kotlin with [Kotlite](https://github.com/sunny-chung/kotlite),
Sunny Chung's MIT-licensed Kotlin Multiplatform interpreter.
[Language support](kotlin-support.md) and [stdlib coverage](kotlin-surface.md)
are user references; this page records implementation contracts.

## Sources and build

| Component | Source used in the bundle |
| --- | --- |
| Interpreter | `vendor/kotlite-interpreter/`, upstream 1.1.2 (`c78dbc5`) plus BlueK changes |
| Standard library | Binary `kotlite-stdlib` 1.1.0 from Maven Central |
| Session/host extensions | `kotlite-browser/` |

`kotlite-browser/settings.gradle.kts` includes the vendored interpreter as a
Gradle composite build. It substitutes every
`io.github.sunny-chung:kotlite-interpreter` dependency, including the stdlib's
transitive dependency. The historical `tomkarp/kotlite` GitHub fork is not the
source used by BlueK. Record local interpreter changes in
[PATCH.md](../vendor/kotlite-interpreter/PATCH.md); upstream CHANGELOG remains
unchanged. Preserve binary API compatibility with stdlib 1.1.0.

The build compiles the tools to Kotlin/JS. Student code is never translated to
JavaScript/bytecode: lexer → parser → semantic analyzer → AST interpreter.
Objects are `ClassInstance` inheritance chains; native library values use
`DelegatedValue`. Host functions/classes register through `ExecutionEnvironment`,
`CustomFunctionDefinition`, `ProvidedClassDefinition` and `LibraryModule`.

## Persistent sessions

Kotlite has no public REPL. `KotliteSession` keeps one interpreter and
`analysisSource`; `ReplAnalyzer` reanalyzes accumulated source and evaluates
only new nodes. Asynchronous `startEvaluate`, `startLoadProject`, `startCreate`
etc. run coroutine evaluation with continuation callbacks. Synchronous
`evaluate`, `load`, `create`, `bind` disable checkpoints and reject suspension.

History, source-unit boundaries, symbol release, handles and lifetime are
binding contracts in [architecture.md](architecture.md#incremental-analysis).
Never reorder accumulated history or rerun old constructors to repair analysis.

## Forward declarations

Classes are declared before analysis (`declareClassesAhead`); their existing
`ClassDefinition` identities are completed in place. This must not consume
symbol numbers. A class is analyzed on demand when members are needed, after
its supertypes; restore the interrupted analyzer context afterward.
`ReplAnalyzer` orders classes before functions and remaining statements.
Enum entries with nonliteral arguments remain at their source location so
previous top-level initializers are available.

Expression-body method return types are inferred on demand in the declaration's
class scope (`returnTypeInference`, `attachToSemanticAnalyzer`,
`analyzeAtTopLevel`). Type inference depending on itself requires an explicit
return type. While a class is being analyzed, only already analyzed properties
are available. Inheritance cycles are errors. Deep on-demand analysis chains
can still overflow the host stack.

Top-level functions/properties also resolve on demand within their source unit
only. Later codepad inputs cannot retroactively change earlier overloads or
symbols. Top-level property initialization remains in file order: direct early
reads fail analysis, indirect ones fail at runtime without fabricating a value.

Objects/companions instantiate lazily once per declaration. Their members use
the actual class definitions and shared identity; retain the documented
companion-initialization/default-argument limitations in
[kotlin-support.md](kotlin-support.md#classes-and-declarations).

## Suspension and native callbacks

The fork evaluates AST nodes with `suspend` functions. Loop checkpoints, input
and `Thread.sleep` can return control to the worker without losing interpreter
scopes. A host function that pauses **must check `Interpreter.canSuspend`
before suspension**. If false, throw `InterpreterStateException`; no student
`catch`, including Throwable, may catch it (RT-37/RT-38).

The binary stdlib invokes lambdas synchronously. `ReplayableNativeCall` and
`StdlibReplayMetadata` allow supported functions to exit when a callback
suspends, then replay the native operation using recorded callback results.
Each student's callback, output and exception executes once; only native
computation repeats. Recorded results live until that native call completes.

Do not replay native code that mutates its receiver between callbacks.
`MutableList.removeAll`/`retainAll` are excluded and replaced with suspendable
patches that evaluate predicates before mutation. `count` is also patched.
Add new unsafe operations to the exclusion metadata and supply a proper
suspendable implementation with `ExecutionEnvironment.patchFunction`.

Ordinary loops yield after a synchronous 10 ms budget check. Loops inside
synchronous native callbacks do not yield; patched suspendable functions are
exempt from that restriction. `toString`, `equals`, `hashCode`, `compareTo`,
BluePlay callbacks and other non-replayable callbacks reject input/sleep before
pausing. Reset/Stop invalidate waiting continuations with their worker/session.

Native exceptions map into interpreted standard classes for typed catch. Other
unmapped host exceptions require Throwable catch. Interpreter faults bypass
student catches and must not be translated into ordinary program exceptions.

## Call depth and exceptions

Every interpreted function, method, accessor, lambda and constructor uses
`enterCall`/`leaveCall`. Depth 1,000 raises `StackOverflowError`, catchable as
Error/Throwable, not Exception. Asynchronous execution uses `stackResetHook`
every 32 calls, continuing on an empty JS stack via microtask. Synchronous
APIs/callbacks cannot do this; `isHostStackOverflow` maps host overflows.

Self-recursive property accessors are marked at `PropertyDeclarationNode` and
published as warnings; only errors block compilation (RT-43).

`CallStack.getStacktrace` captures frames innermost first, using reached source
positions, declaration class and `<init>` for constructors. Exception creation
starts its own trace; native exceptions record at the first interpreted call
before frames unwind (`hostExceptionTrace`, `statementPosition`).
`Interpreter.stackFrameFormatter` maps merged source into project files/lines
or Codepad/BluePlay/Kotlin library labels. Ordinary uncaught exceptions end the
current call without rollback and preserve usable state (RT-82).

## Remaining technical debt

- Full history is reanalyzed on each interactive action; no incremental symbol
  table. On-demand cross-class inference is incomplete.
- Call scopes attach to caller scopes. Global lookup traverses the caller
  chain, giving deep recursion quadratic costs; this motivates the 1,000 limit.
  Lexical call-parent scopes require careful changes to name resolution.
- The binary stdlib's synchronous callbacks require replay. Callback mutations
  of iterated collections are not comprehensively detected. A vendored,
  suspendable stdlib could remove this boundary.
- Only documented native exception classes have typed mapping.
- Generic-supertype metadata and specialization need broader checking.

Detailed change provenance stays in `PATCH.md`, behavior cases in executable
tests, and actual runs in [regression-checklist.md](regression-checklist.md).
