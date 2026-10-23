# Regression coverage and recorded results

Maintain stable IDs when behavior changes. This is a compact coverage register,
not a claim that every feature has just been retested. Detailed reproduction
steps live in the executable tests; records below summarize actual earlier runs.
User acceptance, helper/runtime checks and real browser checks are separate.

Run affected checks from [DEVELOPMENT.md](../DEVELOPMENT.md). Rebuild the
interpreter after Kotlin changes. Record failures/blockers and distinguish
written tests from executed tests. Browser artifacts: playwright-report/ and
test-results/. Full Kotlin conformance is not implied by any passing suite.

Latest storage/account/publication verification: [2026-10-22 results](#accounts-private-storage-and-staticapi-split--2026-10-22).
Latest project navigation verification: [2026-10-22 results](#new-open-save-and-share-navigation--2026-10-22).

## Coverage register

GUI-74 and GUI-80 each have two historical meanings, also in test titles.
Keep those IDs stable and cite the description. Missing numbers are not new IDs
available for reuse. “Recorded” refers to the prior evidence, not this docs edit.
Unless explicitly stated, visual user acceptance remains pending.

Before publishing the debugger, compare BluePlay project performance with the
pre-debugger baseline. Measured locally on 2026-10-21; see the recorded result
below. No universal performance guarantee is implied.

| ID | Behavior | Recorded evidence / remaining acceptance |
| --- | --- | --- |
| GUI-01 | Project templates, demo grouping and order | Recorded browser pass; `test:blueplay-demos` |
| GUI-02 | Parameterless creation still asks for an object name | Recorded automated pass |
| GUI-03 | Inspector computed property values | Recorded browser pass; user confirmation recorded |
| GUI-04 | Inspector getter refresh after property/codepad changes | Recorded browser pass |
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
| GUI-22 | New/Open/Save/Share project actions; Open accepts JSON and BlueJ ZIP/folder; Save includes BlueJ export | Chromium passed, 2026-10-22 |
| GUI-23 | Save disabled for an empty project | Chromium passed, 2026-10-22 |
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
| GUI-44 | Open loads a shared project code, including legacy three-word codes | Chromium passed, 2026-10-22 |
| GUI-50 | Remove full-project hash after import | Recorded browser pass |
| GUI-45 | Reload own draft; fresh tab does not select another draft | Recorded browser pass |
| GUI-46 | Method-result label/value/actions do not overlap | Build passed; dedicated GUI/visual check pending |
| GUI-47 | Parameterless calls and activity state | Recorded browser pass |
| GUI-48 | Private-property styling and read-only private-set controls | Recorded inspector checks; current private-row visual/CSS acceptance pending |
| GUI-49 | Long method menu signatures stay on one line | Recorded browser pass |
| GUI-35 | Short-link display, copy, expiry and loading roundtrip | Recorded browser pass |
| API-01 | Additive legacy migration, permanent identifier reservations, account/session ownership, immutable seven-day copies, UTF-8 limits, media policy, blocks and retention; content reporting removed | Real temporary-SQLite API test passed, 2026-10-23; live migration/deployment/load capacity pending |
| CLOUD-01 | Own/counterfeit media rejected by project and program publication UI; local JSON retains every resource | Chromium passed; all 42 actual standards independently checked by client/server helper, 2026-10-22 |
| CLOUD-02 | Delayed public loads cannot replace edits made while pending; draft survives reload | Chromium passed, 2026-10-22 |
| CLOUD-03 | German/English account advice, password-manager fields, failed-save backup advice and mobile layout | Chromium passed, 2026-10-22; agent inspected German mobile screenshot; user acceptance pending |
| CLOUD-04 | Malformed successful API receipt does not claim a private save succeeded | Chromium passed, 2026-10-22 |
| CLOUD-05 | Private account save requires a non-empty project name | Chromium passed, 2026-10-23 |
| GUI-156 | Local save options require a non-empty name for an unnamed project | Chromium passed, including blank-name rejection and JSON download, 2026-10-23 |
| NAV-01 | Four project actions, separated account/view controls, grouped Save choices, separate Share and stable sidebar in English/German; Restore is the rightmost Open tab | Chromium passed at desktop and 390 px Save width; agent inspected German screenshots, 2026-10-22; human acceptance pending |
| NAV-02 | Sign-in from Save returns without uploading; explicit save/update remains in Save and account settings remain separate | Chromium passed, 2026-10-22 |
| NAV-03 | Private projects open/delete through Open; canceling sign-in retains the selected source | Chromium passed, 2026-10-22 |
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
| GUI-90 | Object/collection property edits start empty and insert bench names | Recorded browser pass |
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
| EXP-04 | Local HTML downloads unchanged JSON; Open in BlueK opens a clean home URL and JSON import restores the project | Chromium passed, 2026-10-22; no generated content URL |
| EXP-05 | Large local HTML projects retain JSON download and a content-free BlueK home link | Chromium passed, 2026-10-22; local files are not subject to the server size limit |
| EXP-06 | Paused BluePlay player with Step/Run/input/Reset/speed | Recorded browser pass; sound playback/visual acceptance pending |
| EXP-07 | Console/BluePlay file:// export in WebKit | Recorded WebKit pass; actual Safari not separately tested |
| EXP-08 | IDE export Beta label and project naming | Recorded browser pass |
| EXP-09 | Main selection each export and cancellation | Recorded automated pass |
| EXP-10 | No HTML export without a supported main | Recorded automated pass |
| EXP-11 | IDE-to-player world/output transfer | Recorded automated pass |
| EXP-12 | Shared ANSI/text-sizing terminal parser in player | Recorded browser pass; `npm run build:player` |
| EXP-13 | Published runnable link, explicit main/cancel, console input, project download and developer view | Chromium passed, 2026-10-22; full content links are read-only legacy fixtures |
| EXP-14 | Seven-day program publication, stored options, same-copy developer link, distinct expiry/unknown/blocked responses | Chromium UI and real SQLite API passed, 2026-10-22; live deployment pending |
| EXP-15 | BluePlay autostart/buttons/speed combinations, required Run button, reset and HTML options | Six valid combinations and IDE/HTML flow passed in Chromium, 2026-10-10; agent inspected desktop/mobile screenshots; user acceptance pending |
| EXP-16 | Optional project heading/tab title for full/short links and HTML; no status label or empty header | Format/server checks and Chromium browser cases passed, 2026-10-10; agent inspected mobile options; user acceptance pending |
| EXP-17 | Stable Share window across project/program options, persistent Cancel and shared program settings with Save → HTML | Seven Chromium cases passed, 2026-10-22; agent inspected desktop/mobile; user acceptance pending |
| EXP-18 | New ?p/?run query links, read-only legacy fragments/paths, player/IDE navigation, deployment prefixes and /load | Separate-origin real API plus static root/prefix builds passed in Chromium/WebKit, 2026-10-22; live Pages acceptance pending |
| EXP-19 | Translated distinct expired/unknown/operator-blocked/developer-disabled link failures; malformed/legacy links; project code opened as player; capitalized codes | Chromium UI and separate-origin Chromium/WebKit routing passed, 2026-10-22; operator/TLS/live acceptance pending |
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
| GUI-148 | Every inspector property shows text plus a compact inspection arrow at the right edge, with the edit pencil immediately to its left; scalars, objects and collections use the same layout | Runtime and Chromium pass (2026-10-21), including custom toString, scalar/captured-getter navigation, disabled null/error arrows, inspectable formatting failures, nested edits and readonly debugger inspection. Agent inspected German light/dark views and opened an Int inspector. User accepted the overall layout and requested the final pencil/arrow ordering; acceptance of that final ordering is pending. |
| GUI-149 | Default ordinary object text uses an object marker instead of a constructor expression; inspector cells omit the repeated type; English/German labels, computed properties and method results preserve custom text | Runtime/reference checks and four affected Chromium cases (GUI-88/148/149, DBG-18) passed (2026-10-21). Built-in-browser German view confirmed Image references, a computed Image property and custom text without a repeated type. User visual acceptance pending. |
| GUI-154 | Loading a project into non-empty work asks before replacing the project and its browser autosave; cancel preserves current work | Passed in focused draft GUI run, 2026-10-23 |
| GUI-155 | Browser recovery list shows three newest drafts first and expands/collapses older drafts | Passed in focused draft GUI run, 2026-10-23 |
| GUI-150 | Object placeholders, inspection errors, uninitialized properties and pending computed values use Codepad's gray; actual values including null and exception objects keep their normal color | Six affected Chromium cases passed (GUI-89/92/149, DBG-12/18), including light/dark mode and a getter returning null (2026-10-21). Built-in-browser German screenshot confirmed gray object/error text beside normal numbers, strings and null. User visual acceptance pending. |
| GUI-151 | BluePlay library-card menus offer World/Actor constructors and all three Image overloads through the standard create dialog; busy runtimes disable construction, and source/test actions remain absent | Thirteen affected Chromium cases and the offline language/manual case passed (2026-10-21), including real bench objects, image dimensions/copying, actor/world integration, API help, ordinary class constructors and translations. Built-in-browser German check created World, Actor and Image, inspected width/height and confirmed all Image menu overloads. User visual acceptance pending. |
| GUI-152 | Inspector property rows retain the edit-pencil height when readonly or when BluePlay Run hides the pencils; Run/Pause does not resize the inspector | Chromium geometry checks and both affected GUI-92 cases passed (2026-10-21): all seven Actor rows measure 34px and the window height stays constant through two Run/Pause cycles. Built-in-browser German Run/Pause visual check confirmed equal editable/readonly row heights. User visual acceptance pending. |
| GUI-153 | Held Space keeps canvas focus and project source unchanged; game keys also recover from background Vim editor focus | Natural WebKit focus transfer reproduced with the old repeat handling and fixed (2026-10-22). Standard-sprite/apple regressions cover both native repeat and explicit background-editor focus. Final checks below; user reports stable local play, deployed acceptance pending. |
| DBG-01 | A breakpoint starts debugging main; Step in is enabled only when the current instruction can enter project code; Step and Continue work and locals are inspectable | Chromium GUI pass (2026-10-20): medium-gray filled chevron sits behind the red breakpoint dot; the lighter gray improves dot visibility while keeping the arrow visible. Arrow and highlight share one source position without adding gutter width. Editing actions stay locked while paused; breakpoint controls remain usable. Runtime smoke verifies Step in reaches a constructor property initializer. New assertions for the Step in enabled state are written but not run. Visual user acceptance remains open. |
| DBG-02 | Multiple gutter breakpoints stop an ordinary main run before each marked statement; Step in is disabled for standard-library-only instructions | Chromium GUI pass (2026-10-20): closing-brace line is rejected; an executable-line breakpoint survives recompilation and execution prints expected output. Latest built-in-browser check confirmed two breakpoints both survive compilation and stop on lines 2 and 3. New Step in assertion is written but not run. |
| DBG-03 | Gutter breakpoint stops an explicit object-method call without `main`, showing parameters, `for` loop locals and receiver properties in a separate window | Chromium verifies `n = 4`, `i = 1`, stored `name = "Wuffi"` rendered with string delimiters, and the integrated inspector evaluates `label`. Runtime smoke separately verifies passive snapshot collection keeps the getter counter at zero. Continue re-hits the loop breakpoint, then finishes with output 5, 6 and 7 (2026-10-20). |
| DBG-04 | Request Pause during a running loop, suspend at the next safe project step and stop | Chromium pass (2026-10-20): debugger window is absent during a normal run and Pause remains available in the sidebar; it opens on the requested pause. Stop from the paused state works. Stop during terminal input remains open. |
| DBG-05 | When stepping into another file at the same line number, highlight and arrow follow the reported file and line; breakpoint markers persist across tab switches | Added browser regression for Main.kt line 2 → Tier.kt line 2, then back to Main.kt line 3; built-in-browser run confirmed the highlight follows line 2 and both Main breakpoints remain visible and active. Automated run is blocked by worktree write permissions (EPERM). |
| DBG-06 | Breakpoint dots keep the same position and size on inactive rows and inside the current-line chevron, including two-digit line numbers; both have the same flat style | Built-in-browser check with breakpoints on lines 2 and 10: horizontal centers and dimensions match exactly; both dot centers and the arrow center align with their gutter row centers to within 0.01 CSS px. Both dots use the same solid red fill and round shape with no shadow. Automated GUI assertion updated; light and dark rendering inspected. |
| DBG-07 | Step over a constructor call and pause in the caller; Step in may enter the constructor | Added a browser regression for `val t = Tier()`; constructor activation records now count as interpreted frames for debugger depth. |
| DBG-08 | Step pauses on statements inside `init` blocks; debugger locals and properties show simple values directly and open the shared object inspector for object values | Implementation and regression checklist updated (2026-10-20). Kotlin build passed. Built-in-browser inspection of `exception.bluek.json` exposed an NPE after stepping through `Tier.bellen()`; fixed below and verified a full step-through completes without an exception. The constructor `init` browser case now also confirms properties show the partially built object and do not evaluate computed getters. Object-valued properties now use the same inspectable object reference as locals; this follow-up has not been browser-verified. |
| DBG-09 | Step through a `for` loop returns to its header between body iterations, without duplicating the initial header pause; the previous loop value remains visible at the header | Built-in-browser pass (2026-10-20): the initial `Tier.kt:10` pause has no `i`; Step enters line 11 with `i = 1`; Step returns to line 10 with `i = 1`; Step there advances to line 11 with `i = 2`. |
| DBG-10 | While paused, breakpoint markers can be added and removed from the gutter or editor action; comment and format actions appear disabled | Built-in-browser pass (2026-10-20): removed the breakpoint at the paused line, added one on another line, then removed it; comment and format actions were disabled in the accessibility tree and visibly gray. |
| DBG-11 | While stepping through construction, the debugger shows the object taking shape: all properties appear immediately, assigned properties gain values, remaining properties are uninitialized, and computed properties remain unevaluated | Built-in-browser pass (2026-10-20): before `name` initialization, showed `name` and `alter` as uninitialized and `rest` as computed without running its getter; after one Step, showed `name = "Wuffi"`, with `alter` still uninitialized and `rest` unevaluated. The `init` block pause showed `name = "Wuffi"`, `alter = 0` and `rest` still unevaluated. |
| DBG-12 | Step in to a constructor with a primary-constructor property pauses on its class-header line before assigning that property; all stored properties are already listed, and a constructor without property parameters proceeds to its first initializer | Runtime smoke and Chromium GUI case passed (2026-10-20): `NamedBox.kt:1` showed both `name` and later `value` as uninitialized; Step advanced to line 2 with `name = "Bello"`. The existing parameterless-constructor smoke still pauses first at its property initializer (`Box.kt:2`). Initial GUI attempts used a stale accessible label and a non-visible gutter spacer; corrected test passed. |
| DBG-13 | Integrated and floating object inspectors evaluate computed properties automatically while debugging and refresh them after each step | Browser regression initially reproduced a loop: getter inspection re-emitted the same source statement as a fresh pause, which retriggered inspection and kept Step disabled. Fixed by re-suspending at the original pause without a new pause event; breakpoints are ignored during this inspector-only evaluation. Kotlin bundle build, typecheck, and focused Chromium GUI test passed (2026-10-21); Step was enabled after inspection and advanced to the next line with the refreshed value. |
| DBG-14 | BluePlay game simulation pauses at breakpoints in `World.act()` and `Actor.act()` on each tick; Step, Continue and removing a breakpoint while paused behave correctly | Runtime smoke, Playwright GUI and built-in-browser pass (2026-10-21): Act once and Run pause in `World.act`; Continue reaches `Actor.act`; Step updates properties; breakpoints recur on later ticks; removing a breakpoint while paused lets the tick finish. See performance and suite results below. |
| DBG-15 | Key releases during a debugger pause clear BluePlay's held-key state; a short Space press cannot keep triggering shooting after Continue | Playwright GUI regression passes (2026-10-21): Space is pressed until the actor pauses at the shot statement, released while paused, then Continue yields one shot and no later breakpoint. |
| DBG-16 | A BluePlay click delivered during a debugger pause is consumed once after Continue | Playwright GUI regression passes (2026-10-21): click sent while paused before `isClicked`, one actor response follows, and later ticks do not repeat it. |
| DBG-17 | Debugger properties omit Actor's cached world dimensions while keeping student and public Actor properties | Runtime smoke checks that `worldWidth`, `worldHeight` and `worldCellSize` are omitted from an Actor pause while `acts`, `x`, `y`, `rotation` and `image` remain visible. |
| DBG-18 | The debugger embeds the shared readonly object inspector for its receiver and automatically refreshes getters at each pause | Chromium pass (2026-10-21): computed values follow two property updates, String delimiters and reference arrows match floating inspectors, a failing getter shows its details without blocking Step, and returning to main removes the receiver view. |
| DBG-19 | Completing a debugged BluePlay tick with Step resumes a previously running game; Act once remains paused | Chromium and built-in-browser pass (2026-10-21): final Step resumes a Run tick; a manually started Act tick ends paused with no subsequent tick output. |
| DBG-20 | BluePlay is above editors on show/start; a debugger pause reveals source above it; the next changed drawing restores the world and keyboard focus | Chromium and built-in-browser pass (2026-10-21): status/getter snapshots and a variable-only step keep the editor in front; a drawing change restores the world. The browser regression also confirms a subsequent Right key reaches the running world. User visual acceptance pending. |

## Recorded verification

### BluePlay input after background-editor focus — 2026-10-22

Reproduced the original focus transfer without clicks or explicit refocusing
after Run. Edit Defender in Vim Insert mode, then start Space Invaders and hold
Space. The canvas is the active element, while the DOM selection still points
into the previous editor. The initial key was prevented, but repeated keydown
events returned before suppressing the browser default. WebKit sends that
default text input to the previous contenteditable selection, then moves focus
back to the editor. The inserted space invalidates the runtime, leaving the
reported inactive world with disabled controls and an empty terminal.

An isolated comparison restored only the old repeat handling in the served
module. Event tracing showed canvas keydown followed by editor beforeinput and
editor focusin, then changed source and phase `uncompiled`. The corrected
handling kept every repeated key on the canvas, produced no editor input or
focus transfer, and left source unchanged. The same Safari mechanism is
[documented by CodeMirror's maintainer](https://discuss.codemirror.net/t/how-to-force-unfocus-of-the-codemirror-element-in-safari/8095).

Prevent defaults before deduplicating key state to stop the actual trigger.
Also capture plain game keys from a background source editor before Vim and
restore canvas focus; debugger pauses retain their editor. The regression uses
both the original Defender sprite and
`Image("apple.png")`, checks visible movement/shooting and unchanged source,
and verifies that the editor can retain focus after Pause. Its first phase
holds/repeats Space on the canvas with no focus manipulation; the second
explicitly moves focus to the editor to check recovery.

A separate one-minute WebKit run completed eleven rounds with an open Vim
editor, unchanged source and no worker/page errors; it lacked key repeats and
therefore missed the trigger initially. Initial browser launch needed sandbox
escalation. Early regression runs exposed an innerText/textContent mismatch,
a Space release before the next simulation tick, and missing synchronization
with the confirmed Run state; those test issues were corrected. This evidence
does not imply that every possible runtime crash has the same cause. Final
verification: GUI-153 passed with standard sprite and apple in both WebKit and
Chromium. RT-11, PERF-01, DBG-15 and DBG-20 also passed in both browsers across
the focused runs. Final typecheck reported zero errors/warnings. User reports
stable local play; confirmation after deployment remains pending.

### BluePlay library constructors (BlueK-Feedback #15) — 2026-10-21

Library cards share project classes' manifest-driven constructor menu and
creation dialog. World and Actor each offer their constructor; Image offers
size, filename and copy overloads. Constructors follow runtime availability.
Library editing/deletion/duplication/test-class actions stay absent, while
double-click and the API-help menu action still open documentation.

The corrected baseline fixture reproduced the missing constructor. Initial
browser attempts used an empty project with Compile disabled, timed out once
waiting for the first bench object, and expected a Codepad list to display its
contents; the final fixture explicitly converts that list to String.
All 13 affected Chromium cases then passed, covering five real constructor calls,
dimensions, image copying, actor/world use, busy-state controls, existing class
and companion menus, API help and all six GUI-130 language cases. The rebuilt
offline language/manual case passed separately (1/1). Typecheck reported zero
errors/warnings; i18n and frontend/offline builds passed. A direct session check
also confirmed World creation yields an interactive bench reference.

The built-in browser's German view independently created World, Actor (with a
custom instance name) and Image. The inspector showed the requested 20×30 image
dimensions, and the context menu showed all three Image overloads alongside
API help. User visual acceptance remains pending.

### Placeholder value colors — 2026-10-21

Codepad, inspector, debugger and method-result placeholders share `#888`.
Getter/formatting errors, uninitialized properties and pending getter text are
gray; actual values retain their existing colors, including null, computed null,
student text and exceptions stored as values. Error text remains clickable.
Six affected Chromium cases passed across the focused runs, covering light/dark
mode, receiver construction and getter/navigation behavior. The first run caught
a computed-null value classified as pending; classification now checks the
pending marker, and all four affected reference cases passed again. The
built-in browser's German view confirmed the final object/error/null colors.
Typecheck and frontend build passed; user visual acceptance remains pending.

### Default object text — 2026-10-21

Ordinary objects without a custom `toString` use `<object> : ClassName`, including
collection text and program output. The runtime marks default object text
explicitly, including the inherited native `Any.toString`; presentation never
guesses from the returned string. English/German inspector cells show only the
localized marker because their property label already contains the type.
Method-result dialogs retain the type; Codepad object controls already used
the marker. Custom/inherited/data-class text, enums, singleton names, null and
exceptions retain their prior behavior.

Runtime/reference, runtime-state, debugger, inspector-model and UI checks passed;
typecheck reported zero errors/warnings, and Kotlin/frontend builds passed.
Four affected Chromium cases (GUI-88/148/149 and DBG-18) passed, covering
English/German marker text, computed references, method results, navigation,
custom text and the integrated readonly debugger inspector. The built-in
browser's German view confirmed Image markers and custom text visually.

Initial checks exposed the native inherited-method distinction. Browser test
setup also needed whitespace-tolerant Codepad text and a language-independent
inspector locator after switching to German. An intermediate Kotlin build saw
mismatched session/interpreter APIs during the correction; the final consistent
rebuild passed. User visual acceptance remains pending.

### Uniform inspector values (BlueK-Feedback #14) — 2026-10-21

All properties now show text and a compact arrow, with an optional edit pencil to
its left so arrows align at the right edge. Active inspection calls toString;
ordinary formatting failures stay in their row and leave the captured object
inspectable. Passive snapshots and arrow navigation do not rerun student
formatting/getters. Scalar navigation shows the value and type without adding
synthetic properties. Null/uninitialized values and failed getters disable the
arrow. Editing a child refreshes text in other open inspectors too.

The initial eleven focused Chromium cases passed. The final broader run passed
28 cases: all 15 debugger cases, six localization cases, five reference/error
cases and two editing cases. After adding nested-edit refresh, GUI-148 and both
editing cases passed again (3/3). The Kotlin bundle build, reference lifetime,
runtime-state, debugger, inspector-model, workspace, i18n and architecture
checks passed; typecheck reported zero errors/warnings. Both language manuals
were updated; the rebuilt offline language/manual browser case passed (1/1).
Built-in-browser German light/dark screenshots confirmed the
aligned arrows and pencil placement, custom object text and scalar navigation.

### BluePlay debugger window ordering — 2026-10-21

Added DBG-20 and drawing-key helper assertions. Eight focused Chromium cases
passed for window ordering/focus, world show/reopen/close, Run/Pause, pending
clicks and inspector refresh. DBG-19 initially hit an overlapping terminal in
its print-only callback: hiding it was insufficient because the next output
reopened it. The fixture now explicitly activates the world before Pause;
DBG-19 and DBG-20 then both passed together. The full suite initially exposed
the same print-only overlap in DBG-14/15 (13/15 passed); after the same explicit
world activation in those fixtures, all 15 debugger cases passed together.
Built-in-browser screenshots
confirmed the world above the editor initially, the editor above it at a pause
and after a variable-only Step, and the world above it with canvas focus after
showText executes. Typecheck (zero errors/warnings), workspace, stage-helper
and frontend architecture checks passed. Ordinary non-debug frames do not run
the new drawing-content comparison; no fresh performance benchmark was run
for this window-ordering change.

### Integrated debugger inspector — 2026-10-21

The receiver property inspector now uses the same `InspectorFields` component and
runtime inspection model as floating object inspectors. Getter values refresh
automatically when the receiver is displayed and after each pause; all properties
are readonly. Local variables retain their separate list. Receiver handles are
runtime-owned and debugger-pinned, including during constructor initialization.
This supersedes the earlier rule that the debugger panel never evaluates getters.

Kotlin bundle build, typecheck, inspector-model, debugger runtime, runtime-state,
workspace and i18n checks passed. Five focused Chromium cases (DBG-03/12/13/14/18)
passed, covering construction, separate inspectors, BluePlay ticks, integrated
getter refresh, reference navigation, error details and continuing execution.
A Svelte warning from an assignment-returning error callback was corrected.
Built-in-browser visual inspection in German at 751×810 confirmed the same
readonly property table in light and dark mode, with `alter`/`rest` updating from
0/100 to 5/95 and 15/85. Shared inspector reference navigation and editing
regressions passed. The initial broader run found stale breakpoint-control,
gutter and tab selectors, plus a BluePlay regression: automatic `isClicked`
inspection consumed a pending click before the game could read it. Inspector
reads now leave the engine click pending; ordinary student reads still consume
it. All 14 debugger GUI cases passed across the final runs, including DBG-19's
Run/Act distinction. Its first fixtures were blocked by an overlapping terminal
and later sampled output before the final batched line arrived; the test now
hides that window before adding a breakpoint and waits for the manual tick's
output before checking that it stays idle. The German test-state Save action
was disabled in the initial localization run; the unchanged case passed in
isolation. All six localization cases and the offline German language/manual
case passed across these runs. BluePlay API/demo and runtime-state checks,
typecheck, i18n and Svelte architecture checks passed against the rebuilt bundle.
The built-in browser also confirmed Run resumes after the last debug step and
Act once remains paused. No user visual acceptance is claimed.

### Interactive debugger — 2026-10-20

The checked-in Kotlin bundle pauses and resumes the same coroutine at
breakpoints. Runtime smoke verified an explicit object method with no `main`,
stored properties, computed getters staying uncalled, rejection of a closing
brace as a breakpoint, and Step in reaching a constructor property initializer.
Chromium passed DBG-01 through DBG-04, including the movable debugger window,
lockout of editing controls while paused, no debugger flash on normal runs and
a breakpoint surviving recompilation. Typecheck (zero errors/warnings), i18n
(766 messages), runtime smoke, Chromium GUI and `build:kotlite` passed. The
first runtime smoke exposed that a pause did not set the resumable state; the
first method-inspector run exposed that the receiver-binding scope was missing
from debugger frames. Both were fixed and the final runs passed. An initial
DBG-03 selector also matched both values lists; the test now scopes to locals.
The first gutter browser run exposed missing empty gutter rows; the gutter now
renders rows and refreshes markers when breakpoint state changes. The corrected
test targets the executable second line, since the function declaration is not
a step. No visual/user acceptance was performed.

Follow-up: removed the standalone stepwise-start action and runtime entry point;
debugging starts from a breakpoint during normal main or method execution. The
filled, medium-gray execution arrow sits behind the red breakpoint marker inside
the existing gutter and shares the same CodeMirror source-position field as the
highlighted row, preventing arrow/highlight drift without adding gutter width.
Chromium checks its style and marker order, plus alignment after a step, and
that both clear after Continue. A tab switch could replace the document after
setting the debug position, mapping the position to the document end; document
replacement now happens first, followed by breakpoint/debug position updates.
The follow-up now also resets debug and breakpoint positions when the active
file changes, and suppresses editor change callbacks for programmatic tab
switches so they cannot erase saved breakpoints. Chromium asserts the highlight
is on the reported source line in main and an object method. The original four
debugger cases passed (2026-10-20). Latest built-in-browser run confirmed that
two breakpoints survive compilation and tab switches, and that stepping from
Main.kt line 2 to Tier.kt line 2 highlights the right row. The plain and
breakpoint arrows now share one SVG marker and measure 18×18 px at 16 px editor
text size; the filled chevron sits behind a red dot with matching size and
position on active and inactive rows. The medium-gray arrow tone is lighter
than the previous gutter-matching gray to improve dot visibility. A built-in-browser check with two-digit
line numbers confirmed matching horizontal centers and point dimensions in
light and dark mode. The browser initially showed the arrow and dots about
0.8–1 CSS px below the row center. Their CSS now positions all three at the
gutter row center; browser measurements were within 0.01 CSS px, and DBG-01
and DBG-06 assert alignment to within 0.15 CSS px. The updated automated cases could not run: Playwright hit
EPERM unlinking `test-results/.last-run.json`; using `/tmp` for output then hit
EPERM writing Vite's temporary config under `node_modules/.vite-temp`. User
visual acceptance remains open.

Follow-up: the supplied `exception.bluek.json` reproduced a `NullPointerException`
after Step had traversed all five iterations in `Tier.bellen()`. Debugger
snapshots had created a synthetic REPL binding for the local `t` object; after
`main()` returned, cleanup tried to retire that frame-local binding from the
global symbol table. Debugger-only object handles now refer directly to the
paused runtime value, without adding a synthetic binding. The built-in browser
reproduction stepped through all five iterations and completed with the
expected output and no exception (2026-10-20). The same project without
debugging also completed normally. Kotlin bundle build and `git diff --check`
passed; no automated test was run for this follow-up.

Follow-up: `for` loop control now invokes the debugger hook at the loop header
between body iterations. The first header pause remains the one supplied by the
enclosing block; a final exhausted-loop check does not add an extra pause. The
previous iteration's `i` remains in scope during the header pause, then is
removed before the next value is assigned. The built-in-browser check confirmed
the sequence `Tier.kt:10 (no i)` → `Tier.kt:11 (i=1)` → `Tier.kt:10 (i=1)` →
`Tier.kt:11 (i=2)`. `while` already exposes its condition between iterations
through the same statement hook. Kotlin bundle build passed; no automated test
was run for this follow-up.

Follow-up: while paused, the built-in browser confirmed the editor breakpoint
action removes a breakpoint from the current line and adds one to another line;
the test marker was then removed. Comment and format actions were disabled in
the accessibility tree and visibly gray. No automated test was run for this
follow-up.

Follow-up: debugger snapshots now expose the declared constructor `this`
binding, which is distinct from the receiver binding used in ordinary member
functions. This lets an `init` or property-initializer frame locate the object
in the enclosing constructor frame. Built-in-browser inspection showed
`name`, `alter` and computed `rest` before the first initializer; after one
Step, `name` displayed as `"Wuffi"`, `alter` remained uninitialized, and
`rest` stayed unevaluated. A further Step paused inside the `init` block with
`name = "Wuffi"`, `alter = 0` and `rest` still unevaluated. The debugger heading
now reads “Attribute” in German and “Properties” in English. Kotlin bundle
build and typecheck passed; no automated tests were run for this follow-up.

### BluePlay simulation debugger — 2026-10-21

DBG-14 adds breakpoint pauses to game ticks in `World.act()` and
`Actor.act()`. The runtime smoke verifies both callbacks, repeated ticks,
single-step state updates, live breakpoint edits, and expected output. The
focused Chromium GUI case passed. In the built-in browser, Act once stopped at
the world breakpoint; Continue reached the actor breakpoint in the same tick;
Step updated the actor property; and Continue completed the tick. Run then stopped
at both breakpoints on successive ticks, and removing a breakpoint while
paused let execution continue. The visible debugger snapshot showed the live
world and actor properties.

DBG-17 removes `Actor`'s three cached copies of its containing world's width,
height and cell size from the debugger property list. They are private engine
bookkeeping fields on `Actor`, not public world or student properties; public
`World` properties remain on a `World` receiver, and other student properties
are unaffected. Runtime smoke asserts that the three fields are omitted while
student `acts` and public Actor properties remain. The focused DBG-14
Chromium simulation test passed against the rebuilt bundle. An initial separate
GUI probe did not reach its actor breakpoint, so it is not counted as evidence
for DBG-17; the runtime smoke is the direct verification for the filter.

Input also remains live while paused. The first Space-release regression failed:
the UI forwarded keyup, but `LocalRuntimeClient` rejected all key/click input
in `debugPaused`, and the error was swallowed by the stage input handler. The
runtime client now permits these input commands while the interpreter is
paused. The stage also forwards keyup for keys it already registered, even if
the debugger pause removed the running/focus condition. DBG-15 passes and
confirms one shot followed by no repeated shots. DBG-16 passes for a click sent
to the stage while paused; `isClicked` consumes it once when execution resumes.

Performance was compared against the pre-debugger bundle from commit `a73216e7`
using two runs of `scripts/benchmark-blueplay.mjs` per bundle, with the debugger
unused. In the representative 180-step scenarios, mean step time was 0.48–0.57
ms for the current bundle versus 0.50–0.59 ms at baseline without shooting;
with shooting, 0.47–0.52 ms versus 0.42–0.44 ms. In the synthetic object-scaling
scenario, current versus baseline mean step times were 0.29–0.31 vs 0.26–0.30
ms at 0 shots, 2.38–2.41 vs 2.27–2.43 ms at 100, 4.47–4.87 vs 4.50–4.53 ms at
200, and 8.56–9.57 vs 8.12–8.76 ms at 400. At 400 shots the measured increase
was 0.4–0.8 ms per tick (roughly 5–9%); the default scenarios were within run
noise. The simulation debugger hook is disabled during ordinary game ticks
when no breakpoints or requested pause are active. These local timings show no
large slowdown in the tested no-debugger workloads; they are not a broad
hardware or project benchmark.

`npm run build:kotlite`, `npm run test:debugger`, focused `npm run
test:debugger:gui -- --grep DBG-14`, `npm run test:blueplay-api`, `npm run
test:blueplay-demos`, `npm run test:i18n`, and `npm run typecheck` passed. The
broader `npm run browser-smoke` stopped at the existing RT-54 expectation in
`scripts/smoke-curriculum-kotlin.mjs:692`: actual exception output includes
`Exception.<init>(Kotlin library)` and `MyEx.<init>(MyEx.kt:1)` stack frames,
while the check expects only `MyEx: y`. That check is outside the BluePlay
debugger change and remains unresolved. No user visual acceptance is claimed.

Still open from the requested acceptance: call-stack selection and per-frame
locals; bounded, expandable object/collection values;
same-frame value-change marks; unbound-breakpoint status and safe remapping on
edits; input/EOF and stale/double command race tests; multiple-main, German,
keyboard, small-viewport and stop-during-run
browser cases. The GUI panel currently shows the current frame's primitive or
type summary only. These are not claimed as completed.

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

### Accounts, private storage and static/API split — 2026-10-22

Step 1 adds optional pseudonymous accounts, owner-only private projects,
immutable seven-day public copies, content reports and a protected local
operator CLI. New links carry query identifiers only. Old stored payloads keep
their deadlines; old full-content links remain readable behind one compatibility
gate without an invented shutdown date. No inf-schule/SVN work, live migration,
DNS change, deployment, commit or push was performed.

- Helpers/builds: typecheck (zero errors/warnings), i18n (812 messages), static
  and Svelte architecture, `test:ui`, `test:project-format`, `test:project-drafts`,
  `test:workspace`, `test:program-export`, `test:bluej-export`,
  `test:bluej-selection` and `test:publication-policy` passed. The latter checks
  every one of the 42 shipped images/sounds against client/server validation,
  rejects same-name counterfeits and preserves private inputs. Player, offline
  and Svelte production builds passed. Standard-media regeneration left the
  existing frontend modules unchanged and created the API checksum manifest.
- Actual service: `test:share-server` passed with a fresh/legacy temporary SQLite
  database and restart. Covers account isolation, password changes and revoked/
  expired sessions, target-account waits without an IP ban, exact CORS/CSRF,
  revision conflicts, independent copies, nested program validation, direct
  standard-media uploads, 1 MiB UTF-8 limits, repeated publications from one IP,
  anonymous reports, CLI review/block, production `__Host-` cookie attributes,
  all public read paths, seven-day reads,
  identifier tombstones and account/report cleanup. An expired cookie does not
  disable anonymous publication. Technical feedback remains a separate route.
- Actual browsers: 34/34 focused publication/cloud/link/state cases passed;
  follow-up mobile dialog checks passed (10/10), followed by the final cloud
  receipt/publication cases (7/7). BlueJ export/reimport and conditional notices
  also passed (GUI-145/146, 2/2). Earlier player, HTML export, localization,
  testing, draft and feedback cases were exercised in their focused runs;
  corrected failures are described below. The real separate-origin API/static
  production integration passed in Chromium and WebKit at both `/` and
  `/BlueK/`: direct query links, legacy 404 path fallback, report/administrative
  block and publication. At the root it also exercises real cookie registration,
  login/logout, password change, private create/load/update/delete and restored
  local execution with the API blocked. This is a local browser integration,
  not a live GitHub Pages/DNS/TLS test.
- Offline: 6/6 actual file:// Chromium/WebKit cases passed with all HTTP blocked,
  including Kotlin execution/input, drafts/JSON, templates/standard BluePlay
  media, formatter, HTML player, bundled help and German settings. Account,
  publication and full-content-link generation controls are absent.
- Failures resolved: the initial sandbox prevented loopback binding; the
  authorized local-server run passed. Browser tests exposed the new account
  dialog's legacy-component reactivity issue, fixed by using Svelte runes.
  Stale full-link/30-day expectations, an extensionless downloaded-JSON test
  fixture, a receipt-modal test sequence and a German wording expectation were
  corrected. A workspace helper needed the new build-time API variable.
  WebKit exposed a transient duplicate status announcement, now avoided.
- Agent visual inspection: German account/error dialog and program export at
  390×720; JSON backup remains in the export footer. Human visual acceptance
  remains pending. Build warnings about the existing formatter's Node/import.meta
  fallback, runtime asset URL and chunk sizes remain; tested execution succeeded.
- Not performed: full `test:regression`, Kotlin rebuild/conformance (no Kotlin
  changed), live-database migration, actual DNS/Pages/TLS/Caddy operations,
  deployment, production load/capacity and Safari application testing. Beta
  retains its existing static host. Daily report review, finite backups, capacity
  monitoring and live acceptance are operator responsibilities documented in
  [deployment](deployment.md). No aggregate disk quota was invented.

### New, Open, Save and Share navigation — 2026-10-22

The classic workspace and sidebar remain in place. New groups templates and
examples; Open groups browser drafts, private account projects, local/BlueJ
imports and shared codes. Save owns BlueK downloads, private saves, BlueJ ZIP
and HTML export. Share owns public project/program copies. Account settings
are separated from the existing view toggles. Contextual authentication returns
to Open or Save without an implicit upload. Program options are shared with
HTML export; the former blanket JSON footer action is now the main Save choice.

- Helpers: typecheck (zero errors/warnings), i18n (829 matching messages),
  workspace controllers, UI behavior, static architecture and Svelte
  architecture passed.
- Chromium: 45/45 HTML export, program-link, browser-draft, BlueJ-import and
  localization cases passed; 13/13 focused toolbar, BlueJ export/reimport,
  project-link/state and sidebar/view-toggle cases passed. Final navigation
  and cloud cases passed 9/9, including English/German Save bounds at 390 px,
  contextual authentication, explicit upload, project opening/deletion and
  malformed receipts. Initial EXP-08 failed because its generic Save selector
  also matched Save state; exact button matching fixed it and the later
  45-case run passed.
- Real separate API/production builds: routing smoke passed in Chromium and
  WebKit at `/` and `/BlueK/`, including public/legacy links, reports/blocks and
  publication. Root runs also passed real cookie accounts/password changes,
  private CRUD through the new dialogs and execution during an API outage.
  These runs use temporary SQLite data, not a production database.
- Offline: all six file:// Chromium/WebKit tests passed with HTTP blocked.
  The downloadable offline package was rebuilt with the new navigation.
- Agent visual inspection: German desktop toolbar, Save and Share, plus Save
  at 390×844. The Share description still mentioned file exports; it was
  corrected in both catalogs and the i18n check passed again. Human visual
  acceptance remains pending. Existing formatter/import.meta build warnings
  remain; offline execution and formatting tests passed.
- At the initial storage implementation review, the full regression suite had
  not yet been run. Kotlin rebuild/conformance (no Kotlin changes), live
  deployment, production migration, commit and push were not performed.
- Full-suite follow-up, 2026-10-22: `npm run test:regression` passed all stages
  through `test:testing`, then stopped at the unchanged Kotlin-surface fixture
  `ScP.toString().startsWith("ScP")` (actual `false`, expected `true`). No
  Kotlin source or generated interpreter bundle was changed. All remaining
  script stages were run separately and passed, including offline (6/6) and
  GUI (324 cases). Three GUI assertions failed on first run: two exact-text
  expectations included unrelated rendered text/stack frames, and the template
  test still expected the old spacing/note instead of the new section labels.
  Their assertions were updated and the three affected GUI cases passed on
  focused rerun. The Kotlin-surface mismatch remains open; no full rerun after
  those test-only updates was performed.
- Share-code entry follow-up, 2026-10-22: shared project codes display in
  4-4-4 groups; opening accepts grouped codes and pasted full links. Focused
  Chromium checks EXP-14, EXP-15 and NAV-06 passed (3/3). Codes retain 12
  characters because public read endpoints currently have no per-code request
  limit; shortening them would reduce resistance to guessing.
- Share-dialog density follow-up, 2026-10-22: removed repeated expiry text,
  shortened the two action descriptions, hid unavailable README/state choices,
  and changed publication actions to compact white/red buttons that match the
  Save dialog's choice cards. Typecheck and i18n passed; focused publication,
  layout and navigation checks passed (12/12),
  followed by the English/German dialog screenshots (NAV-01, 2/2). Agent visual
  inspection confirmed the dialog is shorter and its two link actions remain
  distinct. Human visual acceptance remains pending.
- Private-project management follow-up, 2026-10-22: account-saved projects can
  be renamed in place through an owner-checked, revision-guarded API action;
  both the list label and embedded project name change. The redundant manual
  Refresh buttons were removed because selecting the account source already
  loads the list. Share-server smoke passed, including owner ACL, stale revision
  rejection and reading back the renamed embedded project name. NAV-03 and
  NAV-05 passed (2/2); typecheck and i18n passed. NAV-03 verifies rename from
  Open updates the loaded project name, while NAV-05 confirms the Save list
  sends the displayed revision and updates in place. Human visual acceptance
  remains pending.
- Content-report removal and Open dialog sizing, 2026-10-23: removed the
  public-project report control from editor/player, the public reporting API,
  operator CLI commands and current documentation. Technical “Problem melden…”
  remains separate. Existing databases are not destructively migrated; any
  legacy `content_reports` rows remain inaccessible to the app. Share-server
  smoke passed, including 404 for the removed endpoint; i18n passed. Typecheck
  passed with zero errors and six existing warnings. NAV-01 initially failed
  because its no-network assertion included the intentional account-tab load;
  the assertion now checks that non-account tabs make no requests and the
  account tab loads once. Typecheck (zero errors, six warnings), i18n,
  temporary-SQLite share-server smoke, and focused NAV-01/NAV-04 passed. The
  separate-origin routing test initially hit stale selectors for the Share and
  Open tabs; after updating them to current labels/roles, Chromium and WebKit
  passed at `/` and `/BlueK/`, including no report action, publication, player,
  accounts and private CRUD. The Open dialog keeps a 520 px maximum height while
  switching tabs; NAV-01 confirms equal height. Visual acceptance remains
  pending. Existing SQLite report rows are left untouched and are no longer
  available through the app or operator CLI.
- Browser recovery UX, 2026-10-23: the current tab's autosave is omitted from
  Open → Restore because reload restores it automatically; the list now shows
  the three newest drafts and expands on request. Loading a different project
  into non-empty work asks before replacing the project and tab autosave.
  Draft GUI suite passed (12/12), including GUI-154/155;
  project-draft storage smoke, i18n (842 messages) and typecheck (zero errors,
  six existing warnings) passed. Related GUI-43 passed. GUI-67 reached the
  Share dialog but failed on its stale expectation of one “Publish Project
  Link” action; the current dialog exposes “Create editing link” and “Create
  runnable link”. That assertion is outside this recovery change.
- Open-tab order and required save names, 2026-10-23: Restore is the rightmost
  Open tab in English and German. JSON, BlueJ, HTML and account saves check for
  a project name; blank prompt input does not proceed and keeps Save open for a
  retry. Typecheck (zero errors, six warnings), i18n (843 messages), and all 15
  project-navigation/account browser tests passed, including NAV-01/03,
  CLOUD-05 and GUI-156. GUI-67 and CLOUD-01 also passed after updating their
  selectors and dialog handling for the current Share layout and replacement
  confirmation.
- Toolbar project title, 2026-10-23: The title is centered in the window on
  wide toolbars and stays between action groups on narrower toolbars. NAV-01
  passed in English and German, including geometry checks at 1440 px and 900 px.
  Typecheck passed with zero errors and six existing warnings; `git diff
  --check` passed.
- Publication confirmation copy, 2026-10-23: Removed the extra publisher
  withdrawal/operator blocking and visit-extension sentences from the copied-
  link confirmation in English and German. The seven-day expiry notice remains.
- Account dialog and password managers, 2026-10-23: Removed automatic focus
  from the username field so opening the dialog does not summon password-manager
  suggestions. CLOUD-03 asserts the field is not focused on open; GUI verification
  checks the account form still works in English and German.
- Beta account rollout, 2026-10-23: the beta workflow builds and tests the
  account API before deployment, backs up the running service's configured
  SQLite path (or its unchanged legacy default), restarts the shared API, checks
  health, and only then updates beta static files. Backup consistency/privacy,
  API migration, publication policy, workflow YAML and shell syntax passed
  locally. The local full build could not run because Gradle was not cached and
  `services.gradle.org` was unreachable; the GitHub Actions production build
  and deployment tests passed. The first public health check failed because the
  runner could not resolve external DNS; checking the API over SSH to localhost
  fixed the workflow. Run 39915611716 passed, including the backup, API health
  check and beta static deploy. A live browser confirmed `beta.bluek.de`
  redirects to `beta.bluek.online` and exposes the account dialog; the beta API
  health and credentialed CORS preflight pass. `main` was not pushed or deployed.
