# Regression coverage and recorded results

Maintain stable IDs when behavior changes. This is a compact coverage register,
not a claim that every feature has just been retested. Detailed reproduction
steps live in the executable tests; records below summarize actual earlier runs.
User acceptance, helper/runtime checks and real browser checks are separate.

Run affected checks from [DEVELOPMENT.md](../DEVELOPMENT.md). Rebuild the
interpreter after Kotlin changes. Record failures/blockers and distinguish
written tests from executed tests. Browser artifacts: playwright-report/ and
test-results/. Full Kotlin conformance is not implied by any passing suite.

## Coverage register

GUI-74 and GUI-80 each have two historical meanings, also in test titles.
Keep those IDs stable and cite the description. Missing numbers are not new IDs
available for reuse. “Recorded” refers to the prior evidence, not this docs edit.
Unless explicitly stated, visual user acceptance remains pending.

| ID | Behavior | Recorded evidence / remaining acceptance |
| --- | --- | --- |
| GUI-01 | Project templates, demo grouping and order | Recorded browser pass; `test:blueplay-demos` |
| GUI-02 | Parameterless creation still asks for an object name | Recorded automated pass |
| GUI-03 | Inspector computed property values | Recorded browser pass; user confirmation recorded |
| GUI-04 | Inspector getter refresh after field/codepad changes | Recorded browser pass |
| GUI-05 | Codepad Enter/history/focus after output | Recorded browser pass |
| GUI-06 | Terminal splitter geometry, icons and full height | Recorded browser pass |
| GUI-07 | Codepad result handles for primitives, Strings and objects | Recorded browser pass |
| GUI-08 | Editor initial focus, rename and shared close control | Recorded browser pass |
| GUI-09 | Bench/codepad splitter does not jump on initial drag | Recorded browser pass; user confirmation recorded |
| GUI-10 | Class/file rename, including temporarily empty source | Recorded browser pass |
| GUI-11 | Codepad compile-on-demand in empty/class projects | Recorded browser pass |
| GUI-12 | Terminal input echo between surrounding output | Recorded browser pass |
| GUI-13 | Clear/form-feed and later output in split terminal | Recorded browser pass |
| GUI-14 | Streaming output during execution and responsive Reset | Recorded runtime/browser pass; `test:ui` |
| GUI-15 | Active input styling without redundant terminal controls | Recorded browser pass |
| GUI-16 | Removed Files action; replacement tracked by GUI-79 | Retired; absence covered by GUI-79 |
| GUI-17 | Template layout, Escape cancellation and initial focus | Recorded browser pass |
| GUI-18 | Compact primitive inspectors; stable columns and truncated values | Recorded browser pass |
| GUI-19 | Compact codepad history spacing | Recorded browser pass |
| GUI-20 | Single-line result truncation with full-value tooltip | Recorded browser pass |
| GUI-21 | Shared object aliases and inspector reference names | Recorded browser pass |
| GUI-22 | Grouped project actions and JSON upload/drop UI | Coverage: browser; no specific passing run asserted here |
| GUI-23 | Save/Export disabled for an empty project | Recorded browser pass |
| RT-01 | Identity, setters/getters, main/reset/input and stale replies | Existing runtime-state integration coverage; no new run claimed |
| GUI-24 | Invalid project statements prevent initializer/codepad effects | Recorded browser pass |
| GUI-25 | No automatic completion; four-space manual indentation | Recorded browser pass |
| GUI-26 | Kotlin formatting with bundled WASM and Cmd/Ctrl+Shift+I | Recorded browser pass |
| GUI-27 | Editor accessible dialog/group names and window actions | Recorded browser pass |
| GUI-28 | Editor drag/resize while codepad remains usable | Recorded browser pass |
| GUI-29 | Consistent editor/terminal window styling and spacing | Recorded browser pass |
| GUI-30 | Modeless editor/terminal activation order | Recorded browser pass |
| GUI-31 | Subsequent files open as tabs in the first editor | Recorded browser pass |
| GUI-32 | Shared window buttons, resize zones and minimum sizes | Recorded browser pass |
| GUI-33 | Split/recombine editor tabs, selection and close behavior | Recorded browser pass |
| GUI-34 | Dismiss/retry formatting errors without package noise | Recorded browser pass |
| GUI-36 | Terminal splitter stays centered and resizes both panes | Recorded browser pass |
| GUI-37 | Terminal splitter sits below active editors | Recorded browser pass |
| GUI-38 | Default editor font size is 16 px | Recorded browser pass |
| GUI-39 | Font setting 10–30 px updates text and line numbers | Recorded browser pass |
| GUI-40 | Settings/New File modal ordering and functions-file option | Recorded browser pass |
| GUI-41 | Project-transfer dialogs above ordinary windows | Recorded browser pass |
| GUI-42 | Escape without Vim; Vim Escape and Shift+Escape behavior | Recorded browser pass |
| GUI-43 | Remove short-link path after import; later templates work | Recorded browser pass |
| GUI-44 | Open/Import three-word code loading | Recorded browser pass |
| GUI-50 | Remove full-project hash after import | Recorded browser pass |
| GUI-45 | Reload own draft; fresh tab does not select another draft | Recorded browser pass |
| GUI-46 | Method-result label/value/actions do not overlap | Build passed; dedicated GUI/visual check pending |
| GUI-47 | Parameterless calls and activity state | Recorded browser pass |
| GUI-48 | Private-field styling and read-only private-set controls | Recorded inspector checks; current private-row visual/CSS acceptance pending |
| GUI-49 | Long method menu signatures stay on one line | Recorded browser pass |
| GUI-35 | Short-link display, copy, expiry and loading roundtrip | Recorded browser pass |
| API-01 | Short-link SQLite roundtrip, three-word codes and 30-day expiry | Share-service test passed; production/load tests pending |
| RT-02 | Validate all files before initializer side effects | Recorded runtime pass; `test:runtime-state` |
| RT-03 | One class or top-level declarations per file | Recorded runtime pass; `test:runtime-state` |
| RT-04 | Suspendable Thread.sleep, cancellation and invalid arguments | Recorded runtime/browser pass |
| RT-05 | Custom setter visibility, including private set | Recorded runtime pass |
| RT-06 | Printing terminal BEL (`\u0007`) emits the terminal beep; `BlueK.beep()` is absent | `smoke-kotlite-browser`, `test:runtime-state` and `test:ui` passed (2026-10-09); audible output depends on device and is not verified here |
| RT-107 | Expected type widens inferred type arguments (declaration, assignment, return, if/when, call parameters); wrong types stay errors | Curriculum RT-107 (values checked with kotlinc), generics, Kotlin surface, references, testing and runtime suites passed; conformance 832 (+12, none lost); full hosted GUI 194/194 and offline 6/6 passed (2026-10-09) |
| RT-108 | `Number` supertype of Int/Long/Double/Byte with conversions; `listOf(1, 2.5)` is `List<Number>` | Curriculum RT-108 and Kotlin surface (269 supported) passed; same conformance and GUI runs as RT-107 (2026-10-09) |
| RT-109 | Available `kotlin.math` top-level functions/constants support qualified expressions without imports, distinct from project names; package roots bound to local values/classes retain member semantics; constants reject writes | Interpreter build passed; manual local browser codepad displayed abs/sqrt/max/min/PI/E values and distinct own abs/PI values (2026-10-09); no automated tests added or run; root-shadowing/write rejection implemented but not exercised; user accepted the demonstrated math support (2026-10-10) |
| RT-106 | Common supertype as in Kotlin for mixed arguments (`listOf(40, 40, false)`, mixed set/map/array, nested lists, if/else); invariant receiver keeps `add` type-safe; `containsKey` via Kotlite stdlib | Curriculum RT-106 (values checked with kotlinc), generics, Kotlin surface, references and testing suites passed; conformance 820 (+1 `lambda/lambda_kt80285.kt`, none lost); full hosted GUI 193/193 and offline 6/6 passed (2026-10-09) |
| RT-105 | Exponential speed slider (1 s at 1, 30 ms at 50, 1 ms at 100, strictly faster per step); Run acts at once; raising the speed ends a long wait; `setSpeed()` in code paces Run like the slider (engine owns the speed; Reset keeps it) | smoke-runtime-state passed with the final 1 s curve and the code `setSpeed()` case; full hosted GUI 194/194, offline 6/6 and smoke suites passed (2026-10-09); feel not user-accepted |
| RT-104 | playSound resolves given path or sounds/, emits a resource effect without a shown world, missing file raises “Sound file not found” | smoke-blueplay-browser passed (2026-10-08); audible output not verified |
| RT-07 | Shared namespace, name release, aliases and handle reachability | Recorded runtime/browser pass; `test:references`, `test:runtime-state` |
| RT-08 | Generic classes, variance, reified calls and lexical type captures | Coverage: runtime; no specific passing run asserted here; `test:generics`, `tests/gui/generics.spec.ts` |
| RT-09 | Inline/noinline/crossinline returns, labels, recursion and finally | Coverage: implementation/test reference; no specific passing run asserted here; `smoke-generics-boundaries.mjs` |
| RT-10 | Versioned BluePlay library and native session integration | Recorded runtime pass; `test:runtime-state`, `smoke-blueplay-browser` |
| FMT-01 | Public JSON omits internal IDs/revisions; required fileName, optional path | Coverage: helper; no specific passing run asserted here; `test:project-format` |
| ARCH-01 | Passive rendering does not execute getters or mutate runtime | Recorded helper pass; `test:inspector` |
| ARCH-02 | Coalesced getter refresh and stale-result invalidation | Recorded helper pass; `test:inspector` |
| ARCH-03 | Inspector windows own IDs/geometry; runtime owns values | Recorded browser pass |
| ARCH-04 | Typed lossless project import/export | Recorded helper/browser pass; `test:project-format` |
| ARCH-05 | Codepad compile-on-demand and generation filtering | Recorded helper/browser pass; `test:codepad-flow` |
| ARCH-06 | Library/resources/positions and worker scheduler ownership | Coverage: runtime; no specific passing run asserted here |
| ARCH-07 | Typed Svelte presentation modules without runtime creation | Recorded browser pass; `test:window-interaction` |
| ARCH-08 | Domain controllers and cloneable arguments; sole runtime client | Recorded helper/browser pass; `test:workspace` |
| GUI-51 | Virtual library cards, API help and typed canvas stage | Build/runtime evidence; separate visual acceptance pending |
| GUI-52 | Unified BluePlay window, drag/close/maximize | Built-in browser drag/close/maximize inspected; automation added |
| GUI-53 | Pixel-visible actor/canvas clicks with scaling/rotation | Recorded browser pass |
| GUI-54 | Default white canvas without extra white outer area | Recorded browser check; no pixel-perfect visual acceptance |
| GUI-55 | Small world retains real size and gray margins | Recorded browser pass |
| GUI-56 | Large world grows within viewport bounds | Recorded browser pass |
| GUI-57 | Maximize to viewport without scaling canvas | Recorded browser pass |
| GUI-58 | Virtual library card appearance and inheritance | Recorded browser pass |
| GUI-59 | New class placement accounts for library cards | Recorded browser pass |
| RT-13 | Forward class lookup including later supertypes/members | Coverage: runtime; no specific passing run asserted here |
| RT-14 | Reified Actor collision/query methods | Recorded runtime pass |
| GUI-60 | BlueJ ZIP import, wrapper folders and metadata noise | Recorded browser pass |
| GUI-61 | BlueJ BluePlay migration to built-in library | Recorded import checks; folder-drop visual acceptance pending |
| GUI-62 | Standalone offline IDE with file:// operation | Four offline Chromium/WebKit file:// checks passed (2026-10-01) |
| GUI-63 | Offline instructions/warning/GitHub link before ZIP download | GUI-63 Chromium passed (2026-10-08); link attributes checked, no issue submitted; dark colors not separately inspected |
| GUI-64 | Compiler diagnostics open the relevant editor/source location | Recorded browser pass |
| GUI-65 | Compact diagnostics and dismiss/retry behavior | Recorded browser pass |
| GUI-66 | README sheet visibility and editor/preview | Recorded browser pass; `smoke-project-format` |
| GUI-67 | Optional README opening from full and short links | Recorded browser pass |
| GUI-68 | Vim toggle, settings and keyboard editing | Recorded browser pass |
| GUI-69 | Bundled standard images and resource precedence | Recorded browser pass; `smoke-blueplay-browser` |
| GUI-70 | Generated standard-image masks match decoded pixels | Recorded browser pass |
| GUI-71 | Dark-mode presentation across editors/windows/dialogs | Recorded browser pass |
| GUI-72 | Toolbar adapts to its available width | Recorded browser pass |
| GUI-73 | Terminal splitter below BluePlay window | Recorded browser pass |
| GUI-74 | Inheritance mode prompts for subclass then superclass | Recorded browser pass |
| GUI-74 | Settings General/Editor groups, English-only language notice | Recorded browser pass; `npm run typecheck` |
| GUI-75 | Diagram drag snaps to a 20 px grid | Recorded browser pass |
| GUI-76 | BluePlay virtual-card/template placement order | Recorded browser pass |
| GUI-80 | Editable project name, persistence and export naming | Format checks and direct browser inspection recorded; original Playwright run blocked by missing browser install; later full run recorded below |
| GUI-77 | Start main wording distinct from world Run | Recorded browser pass |
| GUI-78 | Toggle selected-line comments by button and Cmd/Ctrl+/ | Recorded browser pass |
| GUI-79 | Images/Audio actions replace removed Files; media dialogs | Recorded browser pass; Audio now opens the sound dialog (GUI-131), passed 2026-10-08 |
| GUI-80 | Editor/terminal maximize to full viewport | Recorded browser pass |
| GUI-81 | Closed world stays closed during unrelated codepad operations | Recorded browser pass |
| GUI-83 | Output/input brings terminal above editors | Recorded browser pass |
| GUI-84 | Object-creation modal above editor | Implemented; dedicated test not executed in original record |
| GUI-85 | Method-argument modal above editor | Recorded browser pass |
| GUI-82 | Inherited-method submenus fit horizontally | Recorded browser pass |
| GUI-86 | Drawn actor images render fill/operations on canvas | Recorded helper/browser pass; `test:ui` |
| GUI-87 | Inspector/editor activation and stacking | Recorded browser pass |
| GUI-88 | Reference arrows and passive navigation to referenced objects | Recorded browser pass; `npm run typecheck`, `npm run build:kotlite`, `npm run build:svelte` |
| GUI-89 | Passive inspection does not flicker compile activity | Recorded runtime/browser pass; `test:references`, `test:runtime-state` |
| GUI-90 | Object/collection field edits start empty and insert bench names | Recorded browser pass |
| RT-31 | Missing images produce clear errors | Recorded browser pass; `smoke-blueplay-browser` |
| RT-15 | Private methods enforce visibility and manifest flags | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-16 | String-template identifier boundaries and literal dollar signs | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-17 | Typed program exceptions and readable diagnostics | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-18 | Expected type inference in property declarations | Coverage: implementation/test reference; no specific passing run asserted here; `smoke-curriculum-kotlin` |
| RT-19 | Kotlin value output and passive collection previews | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-20 | Float approximated as Double | Coverage: implementation/test reference; no specific passing run asserted here; `smoke-curriculum-kotlin` |
| RT-21 | Kotlin imports accepted; JVM imports rejected with position | Coverage: implementation/test reference; no specific passing run asserted here; `smoke-curriculum-kotlin` |
| RT-22 | Accessor scopes and constructor-parameter/property shadowing | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-23 | Reject uninitialized properties without getter/init | Coverage: runtime; no specific passing run asserted here; `smoke-curriculum-kotlin` |
| RT-24 | Member-call arguments evaluate in caller scope | Coverage: implementation/test reference; no specific passing run asserted here; `smoke-curriculum-kotlin` |
| RT-25 | Explicit-file main choice for Start/Reset, cancellation/invalidation | Recorded runtime/browser pass; `smoke-runtime-state` |
| RT-26 | Merged-source diagnostic positions and argument types | Recorded automated pass; `smoke-runtime-state` |
| RT-27 | start/stop after World.show | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-28 | Private member lookahead and semicolon parsing | Recorded automated pass; `smoke-curriculum-kotlin` |
| RT-11 | Continuous Run/Pause, focus, keyboard and no render-induced pause | Recorded runtime pass |
| RT-12 | Pixel collision and removal during act | Recorded automated pass |
| RT-30 | Missing-name hints without hiding argument-type errors | Recorded automated pass; `npm run test:kotlin-surface` |
| PERF-01 | Measured frame/scheduler/Stop/history/resource growth | Frame/timing measurements; no 60 FPS guarantee or universal growth threshold |
| RT-29 | Promised school-level stdlib surface | Recorded runtime pass; `npm run test:kotlin-surface` |
| PERF-02 | Removed actor-ID cleanup and repeated large-world loading | Cleanup checks; no automated memory-growth threshold/browser heap profile |
| PERF-03 | Lean frame events during Run rather than full snapshots | Recorded runtime/helper/browser pass; `smoke-runtime-state`, `smoke-blueplay-browser`, `smoke-blueplay-stage` |
| PERF-04 | Class-group collision search and cached half-pixel geometry | Order/geometry tests passed; throughput measured without automated threshold |
| PERF-05 | Time-budget loop yielding via event-loop tasks | Recorded runtime/browser pass; `smoke-kotlite-browser` |
| PERF-06 | Interpreter benchmark thresholds for core operations | Timing test recorded; avoid competing CPU-heavy runs |
| EXP-01 | Standalone console HTML, input/EOF/Stop/Restart and title | Recorded browser pass |
| EXP-02 | Chosen main file honored | Recorded automated pass |
| EXP-03 | Compile/main/runtime errors reported without duplicate execution | Recorded automated pass |
| EXP-04 | Unmodified project download and Open in BlueK | Recorded Chromium pass; public online target not automatically opened |
| EXP-05 | Omit Open in BlueK beyond 1 MB link limit | Recorded automated pass |
| EXP-06 | Paused BluePlay player with Step/Run/input/Reset/speed | Recorded browser pass; sound playback/visual acceptance pending |
| EXP-07 | Console/BluePlay file:// export in WebKit | Recorded WebKit pass; actual Safari not separately tested |
| EXP-08 | IDE export Beta label and project naming | Recorded browser pass |
| EXP-09 | Main selection each export and cancellation | Recorded automated pass |
| EXP-10 | No HTML export without a supported main | Recorded automated pass |
| EXP-11 | IDE-to-player world/output transfer | Recorded automated pass |
| EXP-12 | Shared ANSI/text-sizing terminal parser in player | Recorded browser pass; `npm run build:player` |
| RT-37 | Suspendable binary-stdlib lambda replay and canSuspend boundary | Recorded Node/bundle pass; dedicated browser check not performed in original record |
| RT-38 | Typed native exceptions and non-catchable interpreter faults | Node/bundle pass; linked browser regression coverage |
| RT-39 | Kotlin substring bound validation | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-40 | Mutual class references independent of file order | Recorded runtime/browser pass; `smoke-curriculum-kotlin.mjs` |
| RT-42 | Catchable call-depth overflow and fresh JS stack | Recorded browser pass; `smoke-kotlite-browser` |
| RT-43 | Recursive-accessor warning without compile failure | Recorded browser pass; `smoke-kotlite-browser` |
| RT-44 | Nullable safe-call equality/string/hash resolution | Recorded runtime pass; `smoke-blueplay-browser`, `smoke-kotlin-surface.mjs`, `test:references` |
| RT-45 | Forward top-level declarations within source units | Recorded runtime/browser pass |
| RT-46 | Type/null smart casts and control-flow boundaries | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| GUI-91 | Generated BluePlay API help, signatures and layout | Recorded runtime/helper/browser pass; `test:blueplay-api` |
| GUI-92 / RT-49 | Automatic property inspection and per-getter errors | Recorded runtime/helper/browser pass; `test:inspector` |
| RT-47 | Original BlueJ student API, image behavior and hidden internals | Coverage: runtime/helper/browser; no specific passing run asserted here; `test:blueplay-api` |
| RT-48 | Secondary constructors without primary delegation | Recorded runtime pass; `smoke-kotlite-browser.mjs` |
| RT-50 | Nullable for-subject diagnostic at iterator expression | Recorded runtime/browser pass; `smoke-kotlite-browser.mjs` |
| RT-51 | Actor membership/collision uses identity rather than equals | Recorded bundle pass; no dedicated GUI check |
| RT-52 | Structural equality/hash/output of native collections and Pair | Recorded runtime/browser pass; `smoke-curriculum-kotlin.mjs`, `test:runtime-state` |
| RT-53 | super equality/hash/string operates on whole instance | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-54 | Exception identity, message/cause and custom fields | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-55 | break/continue in for loops and nested control flow | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-56 | Statement when and exhaustive enum/Boolean expressions | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-57 | Expression-body overrides infer return types | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-58 | Map entry set, equality/hash and output | Recorded runtime pass; `smoke-curriculum-kotlin.mjs`, `smoke-kotlin-surface.mjs` |
| RT-59 | Numeric/Char constants, map/list/range/String additions | Recorded runtime pass; `smoke-kotlin-surface.mjs` |
| RT-60 | JVM-style Double display | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-61 | null!! has NullPointerException without synthetic message | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-62 | Triple, StringBuilder/buildString and Random | Recorded runtime pass; `smoke-kotlin-surface.mjs`, `smoke-kotlite-browser.mjs` |
| RT-63 | Implicit-receiver extension lookup | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-64 | Data-class generated equality/hash/copy/components | Recorded runtime/browser pass; `smoke-curriculum-kotlin.mjs` |
| RT-65 | Destructuring declarations/loops/lambda parameters | Recorded runtime pass; `smoke-curriculum-kotlin.mjs`, `smoke-kotlin-surface.mjs` |
| RT-66 | Formatting and extension varargs | Recorded runtime pass; `smoke-kotlin-surface.mjs`, `smoke-curriculum-kotlin.mjs` |
| RT-67 | Objects/companions/const val and lazy identity | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-68 | On-demand expression-body method return inference | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-69 | Implicit this calls inside binary-library lambdas | Recorded bundle pass; historical function-property gap resolved by RT-75 |
| RT-70 | Formatter line breaks after assignment remain valid Kotlin | Recorded runtime/browser pass; `smoke-curriculum-kotlin.mjs` |
| RT-71 | Project/function stacktrace locations | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-73 | error returns Nothing and throws IllegalStateException | Recorded runtime pass; `smoke-kotlin-surface.mjs` |
| RT-74 | Exponent/hex/binary/underscore numeric literals | Recorded bundle pass; historical bit/leading-dot gaps resolved by RT-87 |
| RT-75 | Function-valued property invocation | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-76 | Covariant method/property override result types | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-77 | Overridden-property access through aliases/collections | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-78 | Enum names/ordinal/values/valueOf/members | Recorded bundle pass; ordering added by RT-84; entry-body/companion gaps remain |
| RT-79 | Interface default methods and abstract properties | Recorded bundle/runtime pass; no dedicated browser run claimed here |
| RT-80 | Protected member visibility and object-menu filtering | Recorded runtime checks; object-menu filter has no dedicated browser test |
| RT-81 | Class-property lateinit and uninitialized access errors | Recorded bundle pass; local/top-level support added by RT-88; isInitialized unsupported |
| RT-82 | Ordinary uncaught exceptions leave session usable, without rollback | Recorded runtime/browser pass; `smoke-runtime-state.mjs`, `smoke-blueplay-api.mjs` |
| RT-83 | Secondary this delegation with primary constructors and init order | Recorded runtime/browser pass; `smoke-curriculum-kotlin.mjs`, `smoke-kotlite-browser.mjs` |
| RT-84 | Enum ordering/ranges/interfaces | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-85 | Loop labels and labeled break/continue | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-86 | Sealed exhaustiveness and subclass checking | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-87 | Int/Long bit operations and leading-dot literals | Recorded runtime pass; `smoke-kotlin-surface.mjs` |
| RT-88 | Local/top-level/codepad lateinit | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-89 | Callable references, bound/unbound and constructor forms | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-90 | Lexical this in lambdas and receiver lambdas | Recorded runtime pass; `smoke-curriculum-kotlin.mjs` |
| RT-91 | Nested classes/interfaces/enums/objects | Recorded runtime/browser pass; `smoke-curriculum-kotlin` |
| RT-92 | Inner classes and enclosing-object access | Recorded runtime/browser pass; `smoke-curriculum-kotlin` |
| RT-93 | Generic collection properties and expected return types | Recorded bundle pass; outer/lambda inference added by RT-100 |
| RT-94 | String/CharSequence additions | Recorded runtime pass; `smoke-kotlin-surface`, `smoke-kotlin-surface.mjs` |
| RT-95 | Comparators and collection additions | Recorded stdlib pass; expected argument inference added by RT-100 |
| RT-96 | Array creation/access/content equality and list approximation | Recorded runtime/browser pass; `smoke-kotlin-surface` |
| RT-97 | Fixes discovered by pinned Kotlin conformance corpus | Recorded bundle/conformance checks; known incompatibilities retained in Kotlin support |
| RT-98 | Nullable contract predicates and smart casts | Recorded runtime pass; `smoke-curriculum-kotlin`, `smoke-curriculum-kotlin.mjs` |
| RT-99 | Smart casts after contracts/assignment/loops and val-property paths | Recorded runtime pass; `smoke-curriculum-kotlin`, `smoke-curriculum-kotlin.mjs` |
| RT-100 | Expected type arguments from enclosing calls/lambda results | Recorded runtime pass; `smoke-kotlin-surface`, `smoke-curriculum-kotlin`, `smoke-generics-boundaries` |
| GUI-93 | Object menus above inspectors, modals above menus | Recorded browser pass |
| GUI-94 | World Reset preserves maximized/restored state | Recorded browser pass |
| GUI-95 | Kotlin return types in method menus, omitting Unit | Recorded browser pass |
| GUI-96 | Method-result dialog above open editor | Method-result browser check passed; other topmost dialogs reviewed only |
| GUI-97 | ANSI colors/styles/cursor control in terminal | Recorded runtime/browser pass; `smoke-ui-behavior.mjs` |
| GUI-98 | Kitty text sizing in IDE/player terminal | Browser/helper evidence; Safari/Firefox visual sizing untested |
| GUI-99 | Docked terminal splitter follows its window stacking | Recorded browser pass |
| GUI-100 | BlueJ-style constructor/method argument layout | Recorded browser pass |
| GUI-101 | Compact card/object/button sizes | Visual user acceptance pending |
| GUI-102 | Diagram overflow scrolling and edge autoscroll | Recorded browser pass |
| GUI-103 | World.show reopens closed world, including from codepad | Recorded browser pass; `test:blueplay-stage`, `test:player-worker`, `npm run build:kotlite` |
| RT-101 | Portable kotlin.test API, lifecycle/failures/ignore/Stop | Runtime/JVM portability checks passed; no user acceptance |
| RT-102 | State replay, omitted inspector getters/unused results and format persistence | Runtime/format checks passed; no arbitrary serialization/simulation replay |
| GUI-104 | Attached green test card fixed 30/30 behind production card | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-105 | Editable state preview, Cancel and small-viewport scrolling | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-106 | Test results/details/source/rerun and recording cancellation | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-107 | Create Test Class last in context menu after separator | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-108 | Clicking a card raises it; attached pair retains front class | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-109 | New File free test class, usable as default without Test methods | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-110 | Three toolbar view icons; download/help/settings below collapsible testing and alpha note | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-111 | Test visibility icon has two checks, color-only state difference | Automated toggle coverage; revised icon visual acceptance pending |
| GUI-112 | Three icon-only state actions under bench, default StateTest | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-113 | State load/save avoids editor/test panel; replacement warning | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-114 | Embedded Kotlin editor settings/highlighting/comments/format | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-115 | Object bench scrolls to overflow objects | Recorded targeted Chromium pass; user visual acceptance pending |
| RT-103 | Chronological init preparation, returned objects and shared references | Runtime/JVM checks passed; replay, not serialization |
| GUI-116 | All test classes selectable before/without Test methods | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-117 | init replacement warning and state-load error behavior | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-118 | Full links optionally load default state with README | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-119 | Short-link state flags, absent defaults and load errors | Recorded targeted Chromium pass; user visual acceptance pending |
| GUI-120 | Independent tab drafts and stable timestamp on unchanged reload | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-121 | Copied tab ownership and explicit hash-link reimport | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-122 | Fresh-start saved-work notice and complete recent-project restore | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-123 | Legacy migration, corrupt entries and explicit-link startup | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-124 | Same draft on project/template changes; clear absent defaults | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-125 | Storage failure reporting and unchanged-save fingerprinting; the warning names its reason (full storage with project/other sizes, blocked storage, other error text) and can be closed until the reason changes | 9/9 draft cases passed (2026-10-07); reasons and closing added, 2/2 GUI-125 cases passed (2026-10-09); live German check inspected; manual acceptance pending |
| GUI-126 | Drafts survive full browser-process restart | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-127 | Confirm/cancel individual draft deletion and cross-tab lists | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-128 | Confirm/cancel Delete all, settings retained, no unchanged resurrection | 9/9 draft cases passed; included in final affected 18/18 run (2026-10-07); manual acceptance pending |
| GUI-129 | Bundled user manual, section navigation, adaptive shortcuts, small viewports, dark mode and offline use | Hosted selection 3/3 and offline manual 1/1 passed (2026-10-08); screenshots inspected; user acceptance pending |

| GUI-131 | Audio dialog adds WAV/MP3 ≤ 1 MB, rejects other/oversized/undecodable files, previews, confirms removal, lists the 13 bundled BluePlay standard sounds without removal; playSound starts Web Audio playback of project and standard sounds from the codepad | Chromium GUI case passed (2026-10-08) counting started buffer sources; agent screenshots light/dark inspected; audible output and user acceptance pending |
| GUI-132 | Project sounds rename in place, keep their extension, refuse empty/path/other-type/taken names, cancel leaves them unchanged; standard sounds have no rename; playSound uses the new name | Chromium GUI case passed (2026-10-08); agent screenshot inspected; user acceptance pending |
| GUI-133 | Images dialog adds PNG/JPEG ≤ 1 MB and ≤ 2048 px per side, rejects GIF/oversized/undecodable files, renames (type kept, .jpg = .jpeg) and confirms removal of project images; standard images unchangeable; PNG transparency excluded from collisions, JPEG collides as rectangle | Chromium GUI case passed (2026-10-08); live dev-server codepad check false/true; agent screenshot inspected; user acceptance pending |
| GUI-134 | World controls Act, Run, Reset from left to right; Run turns into Pause while running (no separate Pause button); all three buttons keep the same size in both states, in BlueK and the exported player | RT-11 and EXP-06 extended, passed (2026-10-09); live check 76×33 px paused and running; agent screenshot inspected; user acceptance pending |
| GUI-135 | World window cannot be closed (button or Escape) while running; closes when paused; Run started from the codepad reopens a closed window | Chromium GUI case passed together with GUI-52/81/103 and RT-11 (2026-10-09); full hosted GUI 193/194 with GUI-18 timing out on its first codepad step under load (system load 6-26), GUI-18 then 3/3 alone; offline 6/6; disabled button screenshot inspected; user acceptance pending |
| GUI-136 | Images dialog uses equal-sized project and standard tiles, with unobtrusive rename/remove icons beside the filename, leaving the preview uncovered; buttons have a background on hover/focus, long filenames truncate with their full name in the tooltip; only its content scrolls, keeping the title and Close button visible | Live local browser screenshots inspected at the top and bottom of the image list, including the caption-action follow-up (2026-10-09); typecheck passed with zero errors/warnings before the CSS follow-ups; no automated case added or run; user visually accepted the final layout (2026-10-09) |
| GUI-130 | Supported browser-language default with English fallback, persisted German/English choice, unchanged source/live state/diagnostics, translated dialogs/manual/editor search and offline use | 188/188 full GUI cases and final affected 11/11 selection passed (2026-10-08); nine localization cases passed; offline language case passed; agent screenshots inspected, user acceptance pending |

| GUI-137 | Private bug/Kotlin-support report dialog, diagnostic context, explicit project opt-in, JSON preview, durable private delivery and receipt; footer offers Cancel/Send without a report download | Local dialog/preview and initial published main/beta dialog visually inspected (2026-10-10); final wording/information notice approved for publication, final typecheck: zero errors/warnings. Hosted/offline builds completed. No automated tests added/run. Private repo/labels/watch and protected restricted token installed; main/beta/local feedback configuration available. Actual issue/attachment delivery remains unverified by the agent. |

## Recorded verification

### Private feedback — 2026-10-10

- User approved committing and publishing the complete feature and wording
  follow-ups on beta/main. Final typecheck: zero errors/warnings; server syntax
  checks passed. No automated tests added/run.
- Reporting help, user-facing documentation and submission receipts now refer
  to the developer/report number instead of GitHub accounts/issues. The storage
  notice retains the actual GitHub destination. Local wording follow-up;
  no automated tests added/run.
- User requested a shorter introduction and contextual storage information.
  Added a header information button for hover, keyboard focus and click,
  describing transmitted data, optional project, server/GitHub storage,
  repository access and retention in German/English. Local follow-up; no
  automated tests added/run. Local screenshot of the opened notice inspected;
  user subsequently approved publication.
- User requested removing the report download. Removed the button, controller
  method and unused translations/styles; adjusted error guidance and user docs.
  Local browser screenshot shows only Cancel/Send in the footer. This follow-up
  remains local; no automated tests added/run.
- Local browser: opened the German sidebar dialog and expanded its JSON preview;
  project inclusion was unchecked and the preview contained no project. Sending
  remained unavailable without the server token. No report was submitted.
- `npm run typecheck`: zero errors/warnings. Hosted and offline builds completed;
  existing formatter/import-meta/chunk warnings remain. Node syntax checks passed.
- `tomkarp/BlueK-Feedback` created private, category labels installed and watched.
  Backend modules deployed to the existing server; `/api/health` returned `ok:true`
  and feedback configuration initially returned `available:false` without a token.
- Restricted non-expiring token installed only in the protected server file;
  daily private-repository access keeps it used during pauses. Main, beta and
  local Vite feedback configuration now return `available:true`. The first beta
  probe returned SPA HTML: Caddy's static fallback was moved inside its own
  `handle`, preserving `/api/*` routing; validation/reload succeeded.
- Main/beta frontends published. Both German dialogs opened with the unavailable
  notice absent and project inclusion unchecked; main screenshot saved. No
  report was submitted by the agent. Source was initially kept local for review;
  the user subsequently approved committing and pushing beta/main.
- End-to-end issue/attachment delivery, retries, limits, dark/offline browser
  behavior and email receipt are not verified. No automated tests added or run.
  Account email preferences remain an owner step.

### BluePlay sounds — 2026-10-08

playSound moved from the frame `sounds` field to the effect channel, so it plays
without a shown world. The Audio toolbar button opens a sound dialog instead of
the “not implemented” notice. Accepted formats: WAV and MP3, at most 1 MB.

- `npm run build:kotlite`, typecheck (0 errors), browser-smoke, blueplay-stage,
  player-worker, i18n (610 messages) and UI helper suites passed.
- Full hosted GUI run **190/190 passed**, including GUI-131 and updated GUI-79.
  Offline build test and offline GUI run 6/6 passed.
- Live dev-server check: one Web Audio source started for a codepad playSound.
  A first GUI-131 draft failed by pressing Enter before Compile finished; the
  test now waits for Start main to become enabled.
- Not verified: audible output, Safari/Firefox decoding, sound in the exported
  player beyond the shared StageAudio code path.

Follow-up the same day: the 13 standard sounds of BluePlay's `sounds/` folder
(tomkarp/BluePlay `c8ace58`, MIT, about 217 KB WAV) are bundled from
`assets/standard-sounds/` like the standard images; the player template grew to
1113 KB. Typecheck, i18n (611 messages), BluePlay browser/stage and player-worker
smokes passed; affected BluePlay, player, localization and regression GUI
selection 42/42 passed; offline build and browser tests passed. Live dev-server
check: `playSound("explosion.wav")` started one Web Audio source. The full GUI
suite was not rerun after this follow-up.

Second follow-up: project sounds can be renamed (GUI-132), standard sounds not.
Typecheck and i18n (617 messages) passed; GUI-131/GUI-132 passed 2/2.

Third follow-up: own images (GUI-133). Sound and image rules share
`projectMedia.ts`; the “not implemented” media notice was removed. Found in
passing, not fixed (no speculative Kotlite work): `listOf(40, 40, false)` is
rejected with “Call argument's type Int cannot be mapped to type
Comparable<Any>”, although Kotlin infers a common supertype.
Full rerun after all follow-ups: typecheck, all smoke/helper suites, i18n
(631 messages), hosted GUI **192/192 passed**, offline build and GUI 6/6 passed.

### Interface languages — 2026-10-08

Checkpoint commit `1d902e8` preceded the language conversion; no push.
English and German catalogs contain 599 messages, grouped into interface,
manual and BluePlay API files. Complete paragraphs keep formatting inline rather
than splitting translations into fragments. Language selection is stored
separately from projects, uses the supported browser language unless explicitly
selected, falls back to English and
updates the app without replacing source or runtime state. The diagram label
`«functions»` remains English; the German Run All Tests button says `Alles testen`.
Kotlin class-type labels retain the exact English terms Open Class, Abstract
Class and Data Class. Translate terminology only when its translation is natural.

Verification:

- Typecheck: **0 errors, 0 warnings**; catalog keys/nonempty values/placeholders
  passed. Static and Svelte architecture checks passed.
- UI, workspace, window-interaction, project-format and project-draft helper
  suites passed.
- Initial conversion run: **185/186 passed**. EXP-10 exposed a newline between
  the translated line label and number; this was fixed with one interpolated
  message. After catalog reorganization and the browser-language default change,
  the complete GUI suite passed **188/188**. The final affected selection passed
  **11/11**, including a subsequently added German BluePlay-reference case.
- Nine GUI-130 cases cover regional browser locales, unsupported-language
  fallback, saved-choice precedence, invalid/unavailable storage, persistence,
  a second page, native confirmation, switching back, editor Undo/search,
  unchanged live objects/source/signatures, Kotlin class-type terminology,
  complete formatted paragraphs, German state actions, small help layout and
  verbatim English compiler/runtime errors.
- Offline build/ZIP and **6/6 file:// browser cases passed**, including the new
  German language/help/persistence case. Existing offline execution includes
  Chromium and WebKit; the new language case uses Chromium.
- Agent inspected German help/state screenshots. No user visual acceptance,
  actual Windows browser run or exhaustive inspection of every German tooltip
  is claimed. Early migration/test-fixture failures were corrected before the
  final affected run.

### Bundled user manual — 2026-10-08

The Help action opens a nine-section English manual with a brief introduction,
workflow instructions, examples and reference entries. Platform-aware shortcuts
remain supplied by the existing UI owner. Frequently encountered Kotlin limits
are included; detailed maintained references link to GitHub. The manual is
compiled into hosted and offline apps. Content scrolls independently of Close;
navigation adapts to narrow windows. No runtime/state behavior was changed.

GUI-129 covers every section, terminology, state replacement rules, examples,
links, shortcuts, scroll reset, Close/Escape, reopening, focus and dark mode.
The affected hosted Chromium selection (GUI-80, GUI-110, GUI-129) passed 3/3;
the freshly built file:// manual test passed 1/1 with HTTP blocked. Svelte check
passed with 0 errors and 0 warnings. Desktop 800×600, narrow 390×600 and dark
screenshots were inspected. The initial typecheck found an unescaped literal
brace in the Svelte text; it was fixed, and all affected checks were rerun.
That initial browser run had one startup failure from the same compile error.
This is targeted verification, not a rerun of the complete regression suite.
User visual acceptance is pending.
Production frontend build and diff whitespace check passed. Vite reported
warnings about the runtime-resolved interpreter URL, formatter's externalized
Node module and bundle size; no build errors occurred.

Editorial follow-up: removed obvious scrolling/window/read-only instructions
and repeated explanations of Get, settings, state preview and test actions.
Compressed draft and compatibility wording; retained preparation replacement,
replay, autosave and runtime caveats. Text-only changes were reviewed and the
diff whitespace check passed; browser checks were not repeated for this edit.
Second editorial pass removed internet-link and large-world scrolling reminders,
the supported-language feature inventory and advanced numeric/callback details
covered by the references. Compressed resource, default-class and preview
instructions. Formatting and diff whitespace checks passed; no behavior changes.
Help geometry follow-up: removed the subtitle and made dialog height depend
only on viewport height (24 px total outside margin), keeping section changes
from resizing or recentering it. Extended GUI-129 checks identical bounds across
all desktop sections, narrow viewport bounds and absent subtitle. Affected
Chromium test passed 1/1; diff whitespace check passed. User acceptance pending.
Editorial follow-up: removed the Outside BlueK/JVM setup subsection from the
built-in manual at the user's request. Diff whitespace check passed; text only.

### View controls and application utilities — 2026-10-08

The toolbar retains terminal/inheritance/test-visibility controls as one view
group. Download, Help and Settings now form an equal-sized icon-only group at
the bottom of the sidebar, below the testing disclosure, separated by a subtle
rule. Utilities remain visible when testing is collapsed or expanded. State
ownership and dialogs remain in their existing controllers. GUI-110 extended
for placement, dimensions, disclosure independence, help/settings actions and
800×600 accessibility. Existing offline/name tests updated for the new location.
Verification: Svelte check passed with 0 errors and 0 warnings. The affected
Chromium selection (GUI-63, GUI-74, GUI-80, GUI-110 and GUI-111) passed 7/7.
The first launch was blocked by sandbox EPERM while binding the local server;
the approved rerun completed successfully. The 800×600 screenshot was visually
inspected: utilities and expanded testing actions remain visible. User visual
acceptance is pending.

Spacing follow-up: reduced the gap below the testing arrow and the utility
group's top padding.
The initial 6 px assertion exposed a remaining 12 px layout gap; after the
adjustment the affected Chromium test passed 1/1. Following the user's revised
feedback, the separator now has 4 px above it and 6 px padding below it.
GUI-110 verifies both distances and passed 1/1 again. Visual acceptance of this
latest spacing is pending.

Testing disclosure placement follow-up: the arrow now sits directly below
Start main, pointing down when closed and up when open. Testing actions expand
below it in normal layout flow. The flexible spacer follows testing and keeps
the utility icons at the bottom; the earlier negative spacing override was
removed. GUI-110 verifies placement, both arrow directions, expanded actions
and utility accessibility at 800×600: Chromium passed 1/1. Svelte check passed
with 0 errors and 0 warnings; diff whitespace check passed. The expanded
800×600 screenshot was inspected; user visual acceptance remains pending.

Utility separator follow-up: removed the line above Download, Help and
Settings in both themes. GUI-110 checks that no top border remains; the
affected Chromium test passed 1/1 and the diff whitespace check passed.


### Documentation reorganization — 2026-10-08

README reduced to an English user overview; usage and Kotlin limitations moved
to dedicated pages. Developer contracts are linked from AGENTS.md; all maintained
project docs are English. Completed implementation prompts and repetitive
historical narratives removed, while stable regression IDs, essential contracts,
actual result summaries and known acceptance gaps remain. External reference
content/licenses remain unmodified. No runtime/UI behavior changed in this step.
Local-link/heading validation passed for 19 Markdown files and 73 links.
All 27 referenced npm commands exist. All 253 regression rows, including the
historical duplicate IDs, match the prior register. Markdown fences/table rows
and git diff --check passed. This documentation-only change did not rerun
runtime or browser suites; the results below are dated historical evidence.

### README and offline notice — 2026-10-08

- Read-only remote HEAD check: main at 7ad5149 matched origin/main; its README
  already supported primary constructors together with init. Only companion
  initialization timing remains a known difference.
- Actual bundle constructor probe passed: primary constructor/init produced
  Rex; delegated secondary constructor produced Bello! with the intended order.
  Existing smoke-curriculum-kotlin.mjs also passed, including RT-83.
- Offline notice/link work followed local checkpoint commit 470320c.
  Warning and GitHub report link were moved into one colored box below the
  instructions. GUI-63 passed 1/1 in Chromium at 800×600, including Cancel,
  Escape and actual ZIP download. Screenshot inspected; no issue submitted.
  Typecheck: zero errors/warnings. Dark colors implemented, not separately
  visually verified.

### Browser drafts — 2026-10-07

- Checkpoint commit e325e20 preceded storage work; no push.
- Initial browser run 5/6 passed: hash-only link reimport failed. Navigation
  handling fixed; affected GUI-67 tests adjusted for automatic reload.
- Initial helper lock-release assertion and mixed Svelte event syntax failed;
  fixed. Initial offline run 3/4: template dialog closed before async loading;
  fixed, then 4/4 passed in Chromium/WebKit over file://.
- Final draft cases 9/9 passed, including real browser-process restart, same-tab
  replacement, duplicate-tab ownership, migration, storage failure and deletion.
  Two transient reload/dialog failures passed on unchanged repetition.
- First full GUI run stopped after 42 passes to incorporate deletion controls.
  Next full run 176/177: stale offline-control locator failed. Locator fixed;
  full repetition **177/177 passed**.
- Later review fixed unchanged BFCache fingerprint reclaim and JSON field-order
  normalization; helper reproduction first failed then passed. After these
  changes, affected browser/offline run **18/18 passed**: nine draft cases,
  five existing GUI cases and four offline cases. The full 177 run preceded
  these final fingerprint fixes; it was not rerun afterward.
- Final typecheck zero errors/warnings, draft/project-format/workspace helpers
  and both architecture smokes passed. build:svelte passed with known bundle/
  formatter warnings.
- Built-in browser: startup notice and Recent work visibly inspected. Native
  Delete-all confirmation was not accepted; CUA cancellation hit a CDP timeout.
  Manual cancellation check blocked; automated confirmation/cancellation passed.
  Actual browser BFCache restoration and automatic tab-session restoration are
  not separately proven by these tests.

### Testing/state review — 2026-10-06–07

Runtime/format/JVM portability checks and targeted Chromium workflows passed
for reduced kotlin.test, state chronology, shared references, recording, empty
classes, inspector-getter exclusion, defaults and link loading. GUI-109's targeted
testing.spec.ts run passed 7/7; GUI-112 and GUI-110 targeted checks also passed.
Preview highlighting/settings and small-viewport Cancel access were checked;
manual user acceptance remains distinct from automated results.

### Earlier implementation evidence — 2026-09-15–10-06

Earlier detailed logs are consolidated into this register and executable cases,
rather than repeated step-by-step narratives. Recorded checks included:

- ARCH-07/08: combined regression runs including **135/135 GUI tests**, plus
  workspace/window helpers and architecture checks. Agent visual review recorded;
  no user acceptance implied.
- RT-07: reference/runtime checks and **3/3 Chromium reference tests**.
- RT-25: runtime smoke and **6/6 new main-selection browser tests**, with related
  existing main/reset checks.
- GUI-62: **4/4 Chromium/WebKit offline checks** on 2026-10-01.
- RT-37–46: built-bundle suspension, exceptions, substring, call limits,
  forward declarations and smart-cast checks; original failures reproduced
  before correction. Distinct browser checks are indicated in the register.
- RT-47/GUI-91: independent BlueJ API audit, signature/call tests, original
  student files, actual canvas pixels and agent screenshot review. No JVM/BlueJ
  run or pixel-perfect AWT parity claimed.
- RT-50: bundle checks and **three Chromium cases** for nullable for subjects.
- RT-51–100: runtime tests against the checked-in bundle, targeted browser
  cases where recorded, and a separate pinned Kotlin conformance attempt.
  Remaining deviations are documented in kotlin-support.md/kotlin-surface.md.
- PERF checks distinguish measured timing from enforced thresholds; no general
  FPS/memory guarantee. EXP checks distinguish Chromium/WebKit from actual
  Safari/Firefox and audible output.

Future entries should record date, exact affected checks, result and limits;
keep detailed cases in tests and avoid accumulating duplicate narratives.

### BluePlay labels — 2026-10-08

- Issue 23: German UI now keeps the English names of BluePlay controls
  (Reset, Act, Run, Pause, Speed), including accessible button labels and the
  German help references. Localization smoke asserts the required labels;
  `npm run test:i18n` passed (599 messages), and `npm run typecheck` passed
  with zero errors and warnings. Browser visual acceptance not performed.
- Follow-up: the visible reset button had still used the shared German
  `Zurücksetzen` label. It now uses the BluePlay-specific English `Reset`;
  localization smoke asserts it. `npm run test:i18n` passed (600 messages),
  and `npm run typecheck` passed with zero errors and warnings. Browser visual
  acceptance not performed.

### BluePlay terminology — 2026-10-08

- BluePlay product copy, import/runtime explanations and the New Project
  information dialog now describe BluePlay as a library, including its
  worlds, actors, images, sounds and `act()` simulation loop. `npm run
  test:i18n` passed (600 messages), `npm run typecheck` passed with zero
  errors/warnings, and `npm run build:kotlite` passed. BluePlay UI source names
  and serialized element IDs now use library terminology. The archived BlueJ
  reference fixture remains verbatim as source material for its separate import
  test; it does not define BlueK's BluePlay terminology. Generic test-framework
  wording is unrelated and unchanged. After renaming the IDs,
  `npm run test:project-format` passed and the repeated typecheck passed with
  zero errors/warnings.
