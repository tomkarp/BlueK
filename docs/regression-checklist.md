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
| GUI-22 | Grouped project actions; upload/drop UI names JSON and BlueJ ZIP/folder and the file chooser accepts .json and .zip; BlueJ export enabled | Chromium pass (2026-10-18) after updating its stale “BlueJ export disabled” expectation |
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
| RT-110 | Delayed local `val` initialization in alternative if/when branches; definite reads, reassignment and callable/loop boundaries | Feedback #12 pattern reproduced before the fix. Kotlin compiler accepted all 11 positive fixtures and rejected all 13 negative fixtures. Rebuilt interpreter, curriculum suite, generics (including 49 boundaries), runtime-state and references passed; Chromium when/branch execution passed (2026-10-12). Original Main.kt was absent from the stale report attachment, so the exact original project could not be rerun. |
| RT-111 | Missing method `override` uses Kotlin compiler wording with the declaring supertype; adding `override` clears the editor error and compiles | Wording verified with Kotlin/JVM 2.2.21 for World, ancestor, interface and Any methods. Interpreter build, curriculum, runtime-state and all five affected Chromium cases (GUI-64 / RT-111, English/German) passed (2026-10-12). Initial curriculum run started before bundle build completed; initial browser tests counted built-in library cards, corrected to target Spielfeld. User visual acceptance pending. |
| RT-112 | Incompatible call arguments use Kotlin's actual/expected type wording at the argument expression; `showText(schritte, ...)` marks schritte, and `toString()` fixes the call | Kotlin/JVM 2.2.21 confirmed the exact message. Interpreter build, curriculum, eleven call forms plus rejection/overload boundaries, runtime-state, generics (49 boundaries), Kotlin surface (269 supported), typecheck and final ten affected Chromium cases passed (2026-10-12). Initial build needed a local name to preserve Kotlin smart casting; initial diagnostic test exposed the separate final generic check, now aligned. A generic implicit-receiver case retains its existing fallback; its overly broad test expectation was corrected. User visual acceptance pending. |
| RT-113 | Missing call names are distinguished from wrong arguments using lexical/receiver lookup; World-only methods on Actor report Kotlin's unresolved reference at the method | Kotlin/JVM 2.2.21 verified the target wording. Eleven argument cases, eight unresolved calls, scope/receiver/arity boundaries, corrected world removal, runtime-state, Kotlin surface (269 supported), generics (49 boundaries), curriculum and eight Chromium cases (English/German, RT-112/113, GUI-64, RT-50) passed (2026-10-12); final diagnostic/browser reruns passed. Existing byte-identical untracked duplicate files were preserved outside source/test trees under local .cache for build/test validation. User visual acceptance pending. |
| RT-114 | Start/Act without a shown world remains a recoverable request error; a nonfatal failure to begin a scheduled step leaves simulation paused and the session ready | Runtime-state integration passed for explicit Start/Act and student `start()` before `show()`, followed by successful main/reset (2026-10-12). The real exported worker passed in Chromium and WebKit; the initial sandboxed browser launch was blocked by macOS and the authorized rerun passed. |
| RT-115 | Non-Unit block functions require return on every continuing path; throw/Nothing, exhaustive branches, loops and finally preserve completion; expression functions and lambdas retain implicit results | All original suspicions independently reproduced on d4c83c7 before editing. Final bundled session passed 71 shared semantic fixtures plus the format boundary; all 72 fixtures compared with Kotlin/JVM 2.2.21 across three compiler runs. Chromium passed 15 affected cases, including six new English/German diagnostic/correction/main cases (2026-10-13). See the dated record and [comparison](kotlin-control-flow.md). User visual acceptance pending. |
| RT-116 | If-conditions require non-null Boolean, with actual/expected types and the condition's source position; abrupt return/throw conditions remain valid | Final bundle rejects Int, String, Boolean? and null conditions; Boolean variables, comparisons, smart casts and terminating conditions compile and execute. Shared official compiler comparison and the same 15 Chromium cases passed (2026-10-13). See RT-115 for suite limitations; user visual acceptance pending. |
| RT-117 | Definite local val/var and init-block property initialization across continuing branches, exceptions and non-repeating loop paths; trusted scope-function contracts and shared empty capture cells | 120 split-project fixtures match Kotlin/JVM 2.2.21; legal cases execute with matching output, invalid cases fail analysis without effects. Includes first assignment around suspension and all five Core scope functions. Final bundled/session/browser verification passed (2026-10-13); see the dated follow-up and [comparison](kotlin-flow-state.md). |
| RT-118 | Stable null/type guards, this/property paths, versioned Boolean aliases, unmodified captures, branch joins and invalidation by writes/captured writers/unstable roots | The same 120 fixtures passed; final 31 affected Chromium cases passed across English/German compilation, diagnostics and main execution (2026-10-13). Mutable/custom-getter/open properties and unstable roots remain rejected. User visual acceptance and Safari application run pending. |
| RT-119 | Collision cases of the BlueJ version's CollisionTest: transparent and nearly transparent pixels (alpha 16 vs. 17), setTransparency(0), rotation, even cell sizes, disjoint visible pixels in overlapping rectangles, real cat/dog images | All 11 cases passed in `smoke-blueplay-browser.mjs` (2026-10-18); a deliberately wrong expectation failed as intended. |
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
| GUI-63 | Offline instructions/warning and in-app problem report before ZIP download | GUI-63 Chromium passed (2026-10-08); updated from the removed GitHub link to the private report dialog, Chromium passed 1/1 (2026-10-11) with the feedback service mocked and no report sent; dark colors not separately inspected |
| GUI-64 | Compiler diagnostics open the relevant editor/source location; show the English diagnosis without internal semantic exception class names | Chromium editor cases passed in English/German (2026-10-11); type errors also checked in German UI, HTML export and standalone player; runtime evidence below; user visual acceptance pending |
| GUI-65 | Compact diagnostics and dismiss/retry behavior | Recorded browser pass |
| GUI-66 | README sheet visibility and editor/preview | Recorded browser pass; `smoke-project-format` |
| GUI-67 | Optional README opening from full and short links | Recorded browser pass |
| GUI-68 | Vim toggle, settings and keyboard editing; insert mode survives source updates after `i`/`cc` | Recorded browser pass; Chromium/WebKit EN/DE regression |
| GUI-69 | Bundled standard images and resource precedence | Recorded browser pass; `smoke-blueplay-browser` |
| GUI-70 | Generated standard-image masks match decoded pixels | Recorded browser pass |
| GUI-71 | Dark-mode presentation across editors/windows/dialogs | Recorded browser pass |
| GUI-72 | Toolbar adapts to its available width | Recorded browser pass |
| GUI-73 | Terminal splitter below BluePlay window | Recorded browser pass |
| GUI-74 | Inheritance mode prompts for subclass then superclass | Recorded browser pass |
| GUI-74 | Settings General/Editor/Terminal groups and English/German language choice | Chromium browser pass, 2026-10-12; `npm run typecheck` passed |
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
| EXP-13 | Full runnable link, explicit main/cancel, console input, project download and developer view | Chromium browser pass, 2026-10-10 |
| EXP-14 | 30-day runnable short link, stored options, developer import and expiry | Chromium with mocked API and real SQLite service checks passed, 2026-10-10; production deployment pending |
| EXP-15 | BluePlay autostart/buttons/speed combinations, required Run button, reset and HTML options | Six valid combinations and IDE/HTML flow passed in Chromium, 2026-10-10; agent inspected desktop/mobile screenshots; user acceptance pending |
| EXP-16 | Optional project heading/tab title for full/short links and HTML; no status label or empty header | Format/server checks and Chromium browser cases passed, 2026-10-10; agent inspected mobile options; user acceptance pending |
| EXP-17 | Stable export window across views/options, persistent Cancel and one options panel for full/short/HTML | Chromium bounds and identical exported settings passed, 2026-10-10; agent inspected desktop/mobile; user acceptance pending |
| EXP-18 | bluek/run fragments and short paths, player/IDE navigation, deployment prefixes and transitional /load | Chromium/WebKit and prefixed production routing passed, 2026-10-11; user acceptance pending |
| EXP-19 | Unavailable program links: translated player explanation for expired/unknown codes (30-day note, BlueK link), malformed codes and undecodable `#run`; a project code under /run/ offers its project; capitalized codes play | Chromium GUI, real-service routing (Chromium/WebKit) and agent end-to-end passed, 2026-10-11; German player screen inspected; user acceptance pending |
| EXP-20 | A short program code opens its project under /bluek/ and in code import with one request; disabled “Open in BlueK” refuses both (403) | Share-server smoke, real-service routing (Chromium/WebKit), GUI-138 and agent end-to-end passed, 2026-10-11; production deployment pending |
| EXP-21 | BlueJ ZIP export: one folder with Kotlin files (test classes omitted), README.TXT and package.bluej with the displayed card positions; BluePlay adds the JVM library from assets/bluej-blueplay and every standard image/sound, project files win; re-import keeps unchanged standard media as standard resources | `test:bluej-export` passed (2026-10-18); all four bundled examples compiled with kotlinc 2.2.21 after export (`check-bluej-export-kotlinc.mjs`). Not yet opened or run in BlueJ itself. |
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
| GUI-94 | World Reset preserves maximized/restored state; Act, Run/Pause and Reset stay visible without main, and Reset then has no effect | Three affected Chromium cases (GUI-94 / RT-11) passed; typecheck: zero errors/warnings (2026-10-12). No-main case verifies world state, terminal and codepad history survive Reset. Initial test needed to await the Act frame before comparing versions; corrected rerun passed. Agent screenshot inspected; user visual acceptance pending. |
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

| GUI-137 | Private bug/Kotlin-support report dialog, diagnostic context, explicit project opt-in, JSON preview, durable private delivery and receipt; footer offers Cancel/Send without a report download | Local dialog/preview and initial published main/beta dialog visually inspected (2026-10-10); final wording/information notice approved for publication, final typecheck: zero errors/warnings. Hosted/offline builds completed. No automated tests added/run on that date. Private repo/labels/watch and protected restricted token installed; main/beta/local feedback configuration available. Original delivery evidence retained; refreshed snapshots, complete project attachments and receipt wording verified by controller/Chromium tests (2026-10-12), see the dated record below. |

| GUI-138 | A failed IDE link (expired, blocked, undecodable or BluePlay example) keeps the tab draft, shows a dismissible translated notice and cleans the URL; same-page `#bluek`/`#run` links reload through one handler, also offline | Chromium GUI case and offline Chromium/WebKit agent check passed, 2026-10-11; German light/dark notice inspected; user acceptance pending |
| GUI-139 | Optional terminal auto-clear before interactive calls, Codepad and Start main; default off, personal persistence, code tip, cancellation/validation, fresh output/input/errors, inspector/BluePlay exclusions and offline use | All eight new behavior cases passed in Chromium and WebKit; offline language/settings case passed, 2026-10-12; German desktop/mobile screenshots inspected by agent; user acceptance pending |
| GUI-140 | Terminal auto-clear controls and the one-line code tip share a labeled group (one row on wider screens, vertical on mobile) with concise German labels; terminal output/input font size is adjustable and persisted | Typecheck/i18n and Chromium settings/defaults case passed, 2026-10-12; desktop/mobile group screenshots inspected by agent; terminal font persistence not exercised; user acceptance pending |
| GUI-141 | Confirm source-file deletion with filename in English/German; Cancel preserves files, test attachments/default, editor and runtime; accept deletes class, test or main file | Six Chromium deletion cases, ten GUI-130 cases, workspace controller tests, i18n, typecheck (zero errors/warnings), hosted build and six offline Chromium/WebKit cases passed (2026-10-12). Initial browser tests used an incorrect editor label; the next run blocked on the still-open context menu after Cancel and was stopped, then the corrected six-case rerun passed. User visual acceptance pending. |
| GUI-142 | Codepad Get suggests the directly read variable name; aliases use the actual name read, repeated Get reuses the binding, and method/new-object results keep the class suggestion | References, runtime-state, controller tests, typecheck (zero errors/warnings), Kotlin/hosted builds and final ten affected Chromium cases passed (2026-10-12). English/German browser cases cover direct reads, comments, aliases, idempotent Get and methods returning the same named object. User visual acceptance pending. |
| GUI-143 | Compile closes the previous BluePlay world without starting main; explicit Start main reconstructs the updated world, including anonymous worlds and image backgrounds | Baseline Chromium test failed as expected because the old world stayed visible. All 34 affected Chromium BluePlay/main-selection cases passed, including four new cases for paused/running worlds, repeated Compile, Codepad compilation on demand, failed compilation, explicit main and image pixels (2026-10-12). Typecheck, workspace/runtime integration, architecture checks and frontend build passed. User selected close-on-compile and explicit main; visual acceptance of the deployed change pending. |
| GUI-144 | BluePlay information in New Project links to the BluePlay documentation in BlueK | Chromium test passed with GUI-01 (2026-10-18); German panel inspected by the agent at 800×600. User visual acceptance pending. |
| GUI-145 | Save / Export → Export BlueJ Project downloads `<name>.zip` with the BlueJ library and all standard media; importing it restores the BluePlay project | Chromium pass (2026-10-18); German dialog inspected by the agent at 800×600. User acceptance in BlueJ pending. |
| GUI-146 | After a BlueJ export, a notice names left-out test classes and MP3 sounds (BluePlay in BlueJ plays WAV only), but only if the project has them; it stays until closed; no MP3 conversion | Chromium pass with GUI-145 and EXP-17 (2026-10-18), including two simulated minutes without hiding and closing with ×; German test-class notice inspected by the agent in the dev server. |

## Recorded verification

### Delayed val and refreshed feedback attachments — 2026-10-12

2026-10-12, GUI-137 / feedback #12: cancelled report drafts now recapture the
complete current project and matching diagnostics on every opening. Controller
tests passed for functions/classes/tests/resources/README, retained text,
explicit project opt-in, snapshot isolation and matching transmitted JSON.
Chromium feedback tests passed in English/German (2/2), including a Main.kt added
after cancelling and receipt text without the privacy sentence; service delivery
was mocked. The initial browser runs failed because the new test used an invalid
test attachment filename and assumed a main-function template; corrected
fixtures passed. Initial Kotlin build failed during API generation because flow
state was initialized after library AST installation; corrected build passed.
Typecheck (zero errors/warnings), i18n, all six localization browser tests and
all six offline Chromium/WebKit tests passed, including offline German language.
New visual/user acceptance and actual sending to production were not performed.
The downloaded existing issue attachment proves production receipt/attachment
delivery, but it contained an older project snapshot and no original Main.kt.

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
(BlueJ version, MIT, about 217 KB WAV) are bundled from
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


## Runnable sharing and export choices — 10 October 2026

- Save / Export now separates editable BlueK projects from runnable programs.
  Program links and HTML use the same player and option payload; older HTML
  retains its defaults. BluePlay cannot hide its buttons without autostart.
- Passed: typecheck (0 errors/warnings), i18n, player/hosted builds, static and
  Svelte architecture checks, workspace controllers, program-export helpers
  (including URL size limit, offline and /BlueK/ paths), and share-service tests
  with a temporary SQLite database (roundtrip, options, 30-day expiry/cleanup).
- Browser evidence: existing HTML/player cases EXP-01–12 passed (13 cases,
  including WebKit file://). New EXP-13–15 and GUI-118/119 passed (11 cases);
  localization and affected GUI-22/23/44/67, RT-33 passed in the preceding
  20-case focused run. API calls in EXP-14 are mocked; SQLite behavior is checked
  independently by `test:share-server`.
- Offline package: all six Chromium/WebKit file:// cases passed, including HTML
  export and German language/manual. Agent inspected the desktop and German
  390×720 export-dialog screenshots. The mobile dialog scrolls to its remaining
  text/actions; user visual acceptance has not yet been recorded.
- Initial browser run: 14/22 passed. EXP-14 found that the developer program-code
  link was missing from explicit project import detection; fixed and rerun.
  Seven BluePlay failures came from an invalid test fixture mixing a class and
  top-level main in one file; split into valid files and rerun successfully.
- Sandbox initially prevented local listeners and browser startup; those checks
  subsequently passed with approved execution outside the sandbox.
- Local development/share servers run on 5173/8787 for user testing. Entire
  `server/data/` is Git-ignored; no stored data is tracked. Production short
  program links require the updated service. No deployment or commit performed.


Follow-up — 10 October 2026: removed the player's execution-status label and
added **Show project name** to all runnable exports. Turning it off hides the
heading and uses a generic tab title while preserving the saved project name.
With name, download and developer link off, there is no header.

- Passed: typecheck (0 errors/warnings), i18n (717 messages), player/hosted builds,
  export-format/URL helpers and real share-service checks including boolean
  validation and roundtrip for `showProjectName`.
- Actual browsers: 23/23 HTML/player/program-link cases passed in Chromium,
  including the existing WebKit player case; 6/6 offline Chromium/WebKit cases
  passed. Short-link API calls in GUI coverage remain mocked; the service test
  uses a temporary SQLite database. Agent inspected the updated German mobile
  options screenshot. User visual acceptance is pending.
- Local share service restarted with the updated validation; development server
  remains available on 5173. No commit, push or production deployment.


Follow-up — 10 October 2026: the Save / Export window now keeps fixed dimensions
bounded by the viewport (760×680 on desktop). Only its content scrolls, keeping
Cancel visible. Program full link, short link and HTML actions share one options
panel labelled **For links and HTML**; all three actions have the same styling.

- Passed: typecheck (0 errors/warnings), i18n and hosted build. The 22-case
  focused Chromium run covered HTML/program exports and GUI-118/119. EXP-17
  checks unchanged bounds across project/program, six checkbox changes and
  view changes for English/German at 1440×1000, 800×700 and 390×720.
- A separate actual browser export test confirmed identical settings in the
  full URL, stored short-link payload (mocked API) and downloaded HTML. All six
  offline Chromium/WebKit cases passed after the layout change.
- Agent inspected German desktop/mobile screenshots; user visual acceptance is
  pending. Local development/share servers remain running. No commit or push.

### Vim insert mode — 2026-10-10

GUI-68: reproduced the existing bug on `main` in Chromium: the first inserted
character changed the mode back to Normal. `Language.editorPhrases` now derives
one stable object per locale, avoiding language-extension reconfiguration on
every source update. New browser cases type multiple characters after `i` and
`cc`, then check Escape and undo in English and German. Both cases passed in
Chromium and WebKit. The focused Chromium run passed 12/12 cases (GUI-42,
GUI-68 and GUI-130), and the rebuilt offline GUI-130 case passed 1/1.
`npm run typecheck` passed with zero errors/warnings; `npm run test:i18n`
passed (666 messages). The user confirmed the local Vim fix works on 2026-10-10.

### Unified share-link addresses — 2026-10-11

EXP-18: permanent project links retain `#bluek=<payload>`. Runnable exports use
`#run=<program>`, with main and all execution options in the envelope. New short
links use `/bluek/<code>` and `/run/<code>` below the configured deployment base.
`/bluek/` can open the project part of a runnable export; manual code import can
also retrieve it. The transitional `/load/` cleanup is tracked in
[issue #26](https://github.com/tomkarp/BlueK/issues/26), which records the removal
date.

- Passed: typecheck (zero errors/warnings), hosted/player/offline builds,
  program-export helpers, workspace controllers, static/Svelte architecture.
- Chromium: 38/39 focused export/link/GUI-118/119 cases passed. EXP-17's payload
  comparison still looked for the old `play` fragment; after correcting that
  test fixture to `run`, its isolated rerun passed (1/1). Selected main,
  complete options in full/short/HTML exports, expiry, README/state options,
  legacy `/load/` loading and URL cleanup were covered.
- WebKit: all five targeted program-link cases passed. Production routing tests
  passed in Chromium and WebKit against an actual `/BlueK/` build with a SPA
  fallback, covering all four generated URL forms, source retrieval from a
  run code, transitional `/load/`, no IDE code/CSS preloading and no project
  drafts created by the player. API fixtures are mocked; unchanged storage
  validation/expiry has separate share-server coverage.
- Offline: all six file:// cases passed, including HTML export and WebKit.
  Manual user acceptance of the new URL format remains pending.

### Share-link error handling — 2026-10-11

EXP-19/20, GUI-138: the share service decides which view a code may open
(403 for a runnable code with “Open in BlueK” disabled, 409 for a project code
under `/run/`); the client words every reason from the catalogs. Two defects
found during review were fixed: a failed IDE link overwrote the tab's draft
with an empty project, and manual code import reset the URL to `/` below a
deployment prefix.

- Passed: typecheck (zero errors/warnings), i18n (729 messages), static/Svelte
  architecture, program export, share server (editable programs and 400/403/
  404/409 replies), workspace controllers, project drafts, player worker, UI
  behavior, player build and offline 6/6.
- Full Chromium GUI suite: 217/218. GUI-63 failed because `bbf50d9` removed the
  offline dialog's GitHub bug link without updating the test; unrelated to this
  change. The test now checks the private report button instead: it closes the
  offline dialog and opens the report dialog without sending anything (1/1).
  After the final link-decoding and GUI-138 edits,
  37/37 link/draft/export and 19/19 player/HTML/offline cases passed.
- `smoke-share-routing.mjs` now runs against the real share service with a
  temporary database instead of mocked replies; passed in Chromium and WebKit.
- Agent end-to-end check (production builds at `/` and `/BlueK/`, real service,
  Chromium/WebKit): 64/64 after updating its own expectations for capitalized
  codes and blocked `/bluek/`. Offline hash navigation with a kept draft and the
  empty template's error without links passed in Chromium and WebKit.
- Pending: user acceptance; deploying the share service together with the
  frontend.

### Compiler diagnostic wording — 2026-10-11

- GUI-64: the English diagnostic omits `SemanticException` and its subclasses;
  English/German editors retain the correct file, line and error marking. German
  error categories say “Kompilierfehler”. Student runtime exceptions retain
  their Kotlin class names. The existing “Keine Attribute” translation is kept.
- Kotlin build, curriculum smoke (including the new diagnostic cases), runtime
  state integration, typecheck and translation catalog checks passed.
- Chromium: GUI-64 and all hosted/offline GUI-130 cases passed 10/10. EXP-10
  HTML export and EXP-03 standalone player also passed with the concrete type
  mismatch message and no internal exception class name.
- The new runtime assertion failed against the old bundle as expected. The
  first browser selection passed 4/6; the two new cases used the wrong editor
  accessible name. Correcting their locator produced the passing run above.
  Initial sandbox restrictions on Gradle's cache and the local test port were
  resolved by approved retries.
- User visual acceptance remains pending.

### Definite assignment and nullability follow-up — 2026-10-13

RT-117/118: frozen b98dbe4 was independently compared with Kotlin/JVM 2.2.21.
Of 118 original examples, 56 differed in acceptance or runtime results. The
final matrix adds suspension and complete Core contract checks (120 fixtures).
The two historical RT-115 conformance failures, kt12908 and the Nothing getter,
are addressed by the general completion/initialization rules. See
[the focused comparison](kotlin-flow-state.md) for scope and rejected hypotheses.

- Final checked bundle: all 120 split-project cases passed; accepted programs
  execute with matching output and invalid programs fail analysis without
  effects. Kotlin/JVM comparison passed all 120 across recorded runs of
  96 + 11 + 3 + 4 + 1 + 1 + 4. Diagnostic wording is not required to be identical.
- Final sessions/helpers: curriculum, runtime-state, references, testing
  lifecycle/fixtures/recording, project-format and Codepad flow passed. Earlier
  affected language checks on the same flow implementation passed all 71
  control-flow fixtures plus format, generics (49 boundaries and suspended
  inline), argument/reachability diagnostics and the expanded Kotlin surface
  (274 supported, four known gaps, 19 messages).
- Actual Chromium: all 31 affected cases passed after the final project-file
  rule; 16 new cases cover practical accepted/rejected programs in English and
  German, alongside the prior diagnostic cases. User acceptance in Safari
  remains separate and pending.
- Interpreter rebuild and hosted/player/offline builds passed. Typecheck found
  zero errors/warnings; i18n matched 737 messages. The final benchmark passed
  all thresholds, including 10,000 lambda creations and Space Invaders compile.
- Intermediate conformance passed all 832 saved baseline entries (842 total
  passes); a competing-load run later timed out on three baseline cases.
  An isolated rerun passed all 832 (843 total, 11 beyond the saved baseline).
  Final bundle confirmation also passed: 2,933 total tests, 2,453 in scope,
  843 pass, 14 wrong results, 1,592 errors and four timeouts; every saved baseline
  entry passes. The remaining corpus differences are not claimed repaired; the
  baseline was not rewritten.
- Initial GUI run passed 23/31: eight empty-terminal assertions queried a panel
  that is absent before execution. Corrected selection passed 16/16 and final
  full selections passed 31/31. An intermediate curriculum failure exposed a
  stale fact after conditional assignment; joining only continuing alternatives
  repaired it and added positive/negative regression cases. A development build
  needed nullable-key/member-type corrections before the passing final build.

### Kotlin return paths and if-conditions — 2026-10-13

RT-115/116: all three suspicions were reproduced independently before source
edits on clean d4c83c7. Kotlin/JVM 2.2.21 rejected them during compilation;
BlueK accepted them, then failed at runtime in cases 1/3 and returned false in
case 2. See [the versioned comparison](kotlin-control-flow.md) for messages,
positions, execution results and the distinct class/main file-format boundary.

- Final bundled session: 71 semantic fixtures and the format boundary passed.
  Official compiler: the same 72 fixtures passed across runs of 68 + 2 + 2,
  including all requested valid alternatives, throw/Nothing, try/finally,
  reachable/unreachable loop exits, nested labeled lambda returns and invalid
  Int/String/Boolean? conditions. Accepted programs executed in both runtimes;
  deliberately infinite methods were compiled but not called.
- Existing helpers/runtime: curriculum, generics (49 boundaries plus suspended inline),
  argument/reachability diagnostics, Kotlin surface (269 supported, four known
  gaps, 19 messages), runtime state, reference lifetime, typecheck (zero errors
  and warnings) and i18n (737 messages) passed.
- Actual Chromium: all 15 affected cases passed, including the six new cases
  for rejection before main and successful correction/execution in English and
  German, plus GUI-64 and RT-111/112/113. User visual acceptance and a separate
  Safari application run remain pending.
- Interpreter rebuild and separate hosted/player/offline production builds
  passed with existing bundle-size/import-meta/externalization warnings.
  A redundant combined build attempt was blocked by sandbox access to the
  Gradle cache; the earlier authorized interpreter build and the separate
  frontend/package builds completed.
- The final broad conformance command failed: 2,933 tests, 2,453 in scope,
  837 pass, 14 wrong results, 1,598 errors and four timeouts. Its two baseline
  losses, `controlStructures/kt12908.kt` and
  `controlStructures/returnsNothing/propertyGetter.kt`, reproduce identically
  with the unchanged baseline bundle. These are pre-existing definite-val
  initialization gaps; no additional baseline losses were introduced and the
  baseline was not rewritten.
- Initial development builds exposed native placeholder-body validation and
  Nothing special-method ambiguity; both were corrected. A test's ambiguous
  `println(error(...))` call also failed in Kotlin and was replaced with a
  unique Boolean parameter. Final language/browser runs passed afterward.

### 2026-10-12 — Terminal auto-clear preferences (feedback #13)

Settings adds three default-off preferences: interactive calls (methods,
functions and constructors together), Codepad and Start main. The code tip is
`print("\u000C")`; explicit program clearing remains independent. Action
origins are supplied by the workspace controllers, so inspector getters and
BluePlay ticks do not clear output. Preferences persist outside project data;
the dialog scrolls within small viewports.

- Helpers/checks: typecheck (0 errors/warnings), workspace controllers, i18n,
  Codepad flow, UI behavior and Svelte architecture passed. Hosted production
  build passed with Vite asset/externalization/chunk-size warnings.
- Actual browsers: all eight GUI-139 behavior cases passed in Chromium across
  the targeted runs and 8/8 passed in WebKit. The affected selection also passed all 19 existing call-activity,
  localization and main-selection cases; six terminal/settings regressions
  (GUI-12/13/15, GUI-39/40/71 and both GUI-74 meanings) passed. The fresh
  offline build passed its German language/settings case without HTTP requests.
- Initial runs had test-fixture failures (a Codepad binding was not on the
  bench, an incorrect world label, and clicking disabled Invoke).
  Corrected fixtures passed; no remaining functional failure or blocker.
- Agent visual inspection: German settings at 800×600 and 390×520. User visual
  acceptance and a separate run in the Safari application remain open.

### BluePlay integration — 2026-10-18

BlueK became the only maintained version of BluePlay and keeps everything it
needs from the BlueJ version itself; no file refers to an external BluePlay
source any more. docs/blueplay.md took over the original
documentation (minimal example, project structure, per-class explanations,
examples and API tables) adapted to BlueK, with its four diagrams in
docs/img/ (Actor.image shown as `Image?`, opaque overview background). The
original collision test was added unmodified to the BlueJ reference fixture and
its cases were ported to the built-in library (RT-119); the high-resolution
source graphics are in assets/standard-images-originals/, which the
standard-image build does not read. The New Project information link now opens
the BlueK documentation (GUI-144). In the reference fixture only the first
download step of API.md changed: it no longer contains a download link.

- Helpers/checks: `smoke-blueplay-browser.mjs` passed including RT-119, and a
  temporary mutation of one expectation failed as intended. `test:blueplay-api`,
  `test:i18n` (737 messages) and typecheck (0 errors/warnings) passed.
  `build:standard-images` left the generated modules unchanged.
- Actual browsers: GUI-01 and GUI-144 passed in Chromium; all six GUI-130
  localization cases passed.
- Agent visual inspection: the German information panel with its link at
  800×600 in the dev server.
- Not performed: the full GUI suite, WebKit, rendering of the new docs on
  GitHub and user visual acceptance.

### BlueJ export — 2026-10-18

Save / Export → Export BlueJ Project (.zip), previously a disabled
placeholder, now downloads a BlueJ 6 project folder (EXP-21, GUI-145). BluePlay
projects receive the JVM library, maintained in assets/bluej-blueplay/ and
generated into the bundle by `build:standard-images`, plus all 29 standard
images and 13 standard sounds. Test classes are omitted because BlueJ 6 ships
no kotlin-test; own MP3 sounds are exported unchanged although BluePlay in
BlueJ plays WAV only. Only a project with test classes or MP3 sounds gets a
notice naming them, which stays until closed (GUI-146); the dialog text no
longer mentions either. BlueJ
import now leaves unchanged standard media of BluePlay projects as standard
resources, so an export/import round trip adds no files.

- Helpers/checks: `test:bluej-export`, `test:project-format`, `test:workspace`,
  `test:i18n` (737 messages), Svelte architecture and typecheck (0 errors/
  warnings) passed. Exports of all four bundled examples compiled with kotlinc
  2.2.21, including Space Invaders against the BlueJ BluePlay library.
- Actual browsers: 83/83 Chromium cases passed in the BluePlay, HTML export,
  program link, offline, project draft, testing and localization specs,
  including GUI-145 and EXP-17. After the conditional notices were added,
  GUI-145, GUI-146 and all seven EXP-17 cases passed again (9/9). After the
  notice became closable instead of timed, GUI-145/146 passed again, and the
  13 project-draft and link-notice cases (including GUI-44 and GUI-138) passed. The first GUI-145 runs failed on test mistakes
  (a library assertion on the wrong file, an unaccepted replace confirmation);
  corrected test passed.
- Open / Import now names BlueK JSON and BlueJ projects as ZIP or folder
  (folders by drag and drop), and its file chooser also accepts .zip; the user
  had imported an exported project both ways. GUI-22 first failed because it
  still expected the old disabled BlueJ export button; after updating that
  expectation it passed. The full GUI suite then passed in Chromium (275/275).
- Agent visual inspection: German Save / Export dialog, the German test-class
  notice and the German Open / Import drop zone at 800×600 (downloads
  suppressed in the dev server).
- Not performed: opening or running an exported project in BlueJ, MP3
  behavior in BlueJ and WebKit.

### HTML export label — 2026-10-18

“Export as HTML” / “Als HTML exportieren” no longer carries “(Beta)” in the
export dialog, the help and the user guide. EXP-08 now also checks that the
button contains no “Beta”. Typecheck and i18n passed; the HTML export,
localization, offline and program-link specs passed in Chromium (37/37). The
remaining stage notes (testing in alpha, offline version little tested) are
unchanged.
