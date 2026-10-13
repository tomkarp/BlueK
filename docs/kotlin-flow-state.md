# Definite assignment and nullability validation

## Scope and reference

This audit targets small school projects: local val/var initialization,
constructor init blocks, normal and exceptional branches, loops, nullable
locals and properties, simple lambdas and the standard scope functions.
It does not establish full Kotlin compatibility or a percentage for arbitrary
student programs. Remaining language limits are in [Kotlin support](kotlin-support.md).

Reference: Kotlin/JVM 2.2.21 with Temurin OpenJDK 21+35-LTS. BlueK uses Kotlite
1.1.2-bluek.1, stdlib 1.1.0 and Kotlin/JS 2.2.21; bundle checks use Node 22.12.0.
The independently tested baseline is clean revision
`b98dbe4aea9e7ae76cd1756a67c47c21119564bc`, bundle SHA-256
`15077b1a07a3cc0bdd05fcd7356cb348943dd0b72a727c6eda712a9416ad528e`.
The final checked bundle has SHA-256
`0fc85fe039d1dd572930abd18b9de623de9ddbebf5598c427b501abf0caece13`.
The original 62-case matrix was compiled and run against that unchanged bundle
before interpreter edits. Additional boundaries were compared with the same
frozen baseline bundle and official compiler. Of 118 baseline examples checked,
56 differed in compilation acceptance or execution results. Two further cases
check suspension and all five scope-function contracts after the confirmed
causes were repaired.

Classes and main are separate project files. Invalid programs are rejected
without running main; accepted programs execute and their output is compared.
The shared self-written fixtures are `scripts/flow-state-cases.mjs`.
The reference comparison covers all 120 final cases (96 + 11 + 3 + 4 + 1 + 1 + 4
fixtures across the recorded runs). Diagnostic wording may differ minimally;
acceptance and execution must agree. BlueK's separate class/functions card
format remains distinct from Kotlin language semantics.

## Confirmed defects and changes

| Area | Baseline difference | Corrected rule |
| --- | --- | --- |
| Nested guards and Nothing properties | Rejected valid initialization and nullable reads after nested return/throw/try guards or a Nothing getter | Reuse analyzed AST completion; merge only continuing paths |
| Try/catch/finally | Accepted reads when a catch could bypass initialization; lost guaranteed non-null assignments | Exception entry may precede a write; join normal alternatives and apply finally on normal and pending jump paths |
| Loops | Rejected even a val initialized once immediately before break; accepted some uninitialized var reads after a possibly skipped loop | Track break/continue and normal exits; reject val writes on reachable back edges and require initialization at all continuing exits |
| Init blocks | Rejected complete val assignments in if/when alternatives but accepted a missing assignment | Track backed val/var properties through ordered init blocks; analyze member bodies independently |
| Scope functions and captured cells | Rejected legal local initialization in run; some accepted callbacks failed while capturing a declared but uninitialized var | Trusted Core exactly-once metadata is separate from inline permission; captures share an empty cell, without prematurely reading it |
| Unmodified captures | Rejected a simple lambda using a narrowed local var despite no mutation | Retain stable facts when lexical AST write analysis finds no interfering write; escaping writers/later root assignments invalidate them |
| Property stability | Accepted null smart casts on implicit mutable/custom-getter properties and mutable global roots; rejected stable this/property chains | Require stable roots and val properties for null and type checks; reassigning a root invalidates its paths |
| Conditions and aliases | Rejected identity null checks, stable local Boolean predicates and safe-call equality guards | Keep versioned predicate facts and narrow stable subjects when equality implies a non-null value |
| Alternative facts | Rejected valid reads in an unchanged alternative; a development regression retained a stale cast after conditional reassignment | Reset each alternative's input and keep only facts shared by every continuing path, including exhaustive when |
| Global project properties | Accepted ordinary project-file val/var declarations without an initializer | A vendor AST file rule requires an initializer or valid lateinit; REPL synthetic externally populated bindings retain their separate role |

No source-text patterns implement these rules. `FlowWrites` visits AST nodes
and respects local declarations and parameter shadowing. Core contracts come
from the trusted native module, not a student's function name. An inline
student function without a calls-in-place contract cannot initialize its caller.
A safe call on a nullable receiver can skip its callback. Initializing a member
val inside a lambda remains rejected, as in Kotlin.

Expression-bodied functions and lambdas retain their implicit results; declared
block functions still require explicit returns on continuing paths. Native
suspension, call entry/leave and replay rules remain unchanged. A regression
suspends before and after first assignment inside run.

## Hypotheses not confirmed

The official compiler also rejects a nullable var read after assignment inside
run, a smart cast before mutation in a do-loop even with a literal false
condition, and definite initialization based solely on `if (true)` without an
else. These cases are negative regression fixtures; BlueK does not grant more
permission than Kotlin for them. The curriculum's old blanket rejection of an
unmodified var capture was itself over-restrictive; it now tests both the valid
case and a later-write rejection.

## Reproduction and evidence

- `npm run test:flow-state`: the real checked-in session, analysis phase/error
  severity for rejection, no effects on rejection and exact output for accepted
  split projects.
- `npm run test:flow-state:kotlin`: the same files with the installed kotlinc;
  prints its version, compiles and runs accepted jars.
- `node scripts/audit-flow-state.mjs only=case-id,...`: a selected regression.
  `--reference` uses Kotlin; `--audit` records outcomes without stopping at
  acceptance differences. `BLUEK_BUNDLE` can select a frozen baseline bundle.
- `tests/gui/control-flow.spec.ts`: English/German browser compilation,
  diagnostics/main disabled on invalid input and execution on valid projects.

Final suite counts, initial failures and deployment results belong in
[the regression checklist](regression-checklist.md), RT-117/118. Automated
Chromium evidence does not replace user acceptance in Safari.

On the final bundle, all 120 flow-state fixtures and 31 affected Chromium cases
passed. The official comparison checked the same accepted/rejected programs and
execution outputs. Curriculum, runtime-state, references, testing, project-format,
Codepad flow, language suites and the interpreter performance thresholds passed.
The expanded stdlib surface passed 274 supported operations, four known-gap
checks and 19 diagnostic cases. Builds and typecheck passed.

The broad corpus command also passes its regression criterion: all 832 saved
baseline entries, including both formerly failing examples, now pass. Of 2,933
corpus tests (2,453 in scope), 843 pass, 14 return wrong results, 1,592 report
errors and four time out. There are 11 passes beyond the saved baseline, six more
than the original bundle's 837 passing results. This command checks preservation
of the saved passing set; remaining corpus differences are not claimed repaired.
A competing-load run timed out on three baseline entries; isolated reruns,
including the final bundle, passed them. The baseline was not rewritten.
