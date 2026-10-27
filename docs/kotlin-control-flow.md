# Kotlin control-flow validation

## Independently reproduced baseline — 12 October 2026

The baseline was the clean BlueK revision
`d4c83c7f0d5926c33fef6d4a98a97d3b70d988b2`, using the checked-in
Kotlin/JS interpreter bundle with SHA-256
`daf8b088f627da5391db28c96f8816a86d247c279c95c2061fd323c718b3d84b`.
The interpreter is Kotlite `1.1.2-bluek.1` with stdlib `1.1.0`; the browser
build uses Kotlin `2.2.21`. The independent reference compiler was the installed
`kotlinc-jvm 2.2.21`, running on Temurin OpenJDK `21+35-LTS`.
BlueK bundle probes used Node.js `22.12.0`; visible editor tests use Chromium.

Each class case used `Tier.kt` for the class and a separate `Main.kt` containing
`fun main() { println(Tier().istGluecklich()) }`. The condition case used only
`Main.kt`. These are valid BlueK file arrangements. The original snippets were
executed against the unchanged bundle before any interpreter source edits.

| Suspected difference | Official compiler compilation/execution | Baseline BlueK compilation/execution |
| --- | --- | --- |
| Conditional return without a final return | Rejected: `Tier.kt:8:5: missing return statement.`; not executed | Accepted. Codepad `Tier().istGluecklich()` and main both failed at runtime: `Return value's type Unit cannot be casted to Boolean in function istGluecklich`; no output |
| Comparison as the last statement of a Boolean block function | Rejected: `Tier.kt:6:5: missing return statement.`; not executed | Accepted. Codepad returned `false`; main printed `false` |
| `if (zahl)` with `val zahl = 1` | Rejected: `Main.kt:4:9: condition type mismatch: inferred type is 'Int' but 'Boolean' was expected.`; not executed | Accepted. Running main failed with `ClassCastException: Kotlite evaluation failed.`; no output |

All three suspicions were confirmed as language implementation defects, rather
than project-format restrictions. Official compilation failures produce no
runnable program; they were not counted as successful or attempted executions.

After the fix, BlueK rejects all three during semantic analysis with the same
message, file, line and column as Kotlin/JVM 2.2.21. The erroneous functions
are never executed. Corrected split projects compile and run: explicit returns,
expression bodies and lambda results produce `false`; `if (zahl == 1)` prints
`ja`. The rebuilt bundle tested on 13 October has SHA-256
`15077b1a07a3cc0bdd05fcd7356cb348943dd0b72a727c6eda712a9416ad528e`.

## Implementation contract

The semantic analyzer previously left return validation as a TODO and compared
only the function block's final expression type. This permitted implicit block
results and could also reject valid returns followed by unreachable statements.
It visited if-conditions without requiring a non-null Boolean type.

`ReturnFlow` summarizes completion over the analyzed AST. Statements compose
only along continuing paths. Branches, exhaustive when, exceptions, resolved
non-null Nothing expressions, loops and labeled break/continue targets preserve
which paths can reach the end. Every catch is considered a possible exception
path. Finally preserves earlier completion when it completes normally, and
otherwise replaces the pending return/throw/loop jump. A reachable break can
make an otherwise infinite loop complete; an unreachable break cannot.

Declared non-Unit block functions, including nullable Unit functions and block
getters, are rejected when their end can be reached. Each explicit return still
uses the existing return-value type check. Abstract and native functions have
no student body to validate; native placeholder blocks are excluded by callable
kind. Expression-bodied functions and lambdas retain implicit results. Explicit
labeled returns contribute their value type to their actual target lambda,
including jumps across an inner lambda. This prevents a returning outer lambda
from being incorrectly inferred as Nothing and mistaken for a terminating
function call. Declaring a local function/lambda does not execute it. Merely marking
a function inline does not establish an exactly-once calls-in-place contract.

If-conditions require non-null Boolean. Expressions that cannot complete
normally, such as return or throw, remain legal. Bottom-type compatibility
allows non-null Nothing as any required type, while Nothing? remains nullable.
TypeNode conversion preserves this distinction, and the uninhabited Nothing
pseudo-class does not install a runtime special-method table.

The parser records a function block's closing brace and the start of an
if-condition, including the otherwise positionless null literal. The analyzer
uses those positions and the exact Kotlin 2.2.21 messages above. No source-text
pattern checks are used in the implementation.

These rules follow the official [control-flow specification](https://kotlinlang.org/spec/control--and-data-flow-analysis.html),
with concrete acceptance and diagnostic expectations checked against Kotlin
2.2.21 rather than inferred solely from the specification.

## Project-format boundary

Kotlin accepts a class and main together in one source file. BlueK deliberately
rejects that arrangement with a diagnostic explaining that BlueK requires
separate files even though Kotlin allows those declarations together. Splitting the same valid
program into class and functions files works. This is tested separately and
is not treated as a language bug or silently normalized by the comparison.

## Reproducible checks

Shared self-written fixtures live in `scripts/control-flow-cases.mjs`.
`npm run test:control-flow` loads each project through the real bundled session,
checks compilation severity/message/file/line/column, evaluates accepted class
methods in the Codepad, and executes main. Throwing fixtures catch and print
the exception message so both runtimes can compare behavior without depending
on stack trace formatting. Infinite-loop fixtures compile the method but do
not invoke it; main prints a marker instead.

`npm run test:control-flow:kotlin` prints the installed compiler version,
compiles the same files with kotlinc, and executes accepted programs with Java.
Fixture IDs can be passed as arguments to run a subset. The browser cases in
`tests/gui/control-flow.spec.ts` verify the original three diagnostics in English
and German, then correct the source and run the split project successfully.

Final validation results are recorded in [the regression checklist](regression-checklist.md),
under RT-115 and RT-116. Visual acceptance in the user's own Safari application
is separate from these automated checks.

The final bundle passed 71 semantic fixtures plus the project-format boundary;
the same 72 fixtures passed the official comparison in runs of 68, two and two.
All 15 affected Chromium tests passed. Curriculum, generics (49 boundaries and
suspended inline), argument diagnostics, Kotlin surface, runtime state,
references, typecheck and i18n also passed. The interpreter and separate
hosted/player/offline builds completed successfully.

The broad existing conformance command still exits with failure: 2,933 corpus
tests, 2,453 in scope, 837 passing, 14 wrong results, 1,598 errors and four
timeouts. Its two missing baseline passes are `controlStructures/kt12908.kt`
(delayed val initialization inside a loop) and
`controlStructures/returnsNothing/propertyGetter.kt` (definite assignment after
a Nothing property access). Both produce the same errors with the unchanged
baseline bundle; neither is introduced by these changes. The baseline file was
not rewritten to hide them. The final run added no further baseline losses.
This comparison therefore establishes the tested behavior, not full Kotlin
compatibility. These gaps were outside that change. The subsequent
[definite-assignment and smart-cast work](kotlin-flow-state.md) addresses both;
see its final validation results for the current state.
