# Test and state implementation

User instructions: [testing.md](testing.md).
Binding runtime ownership: [architecture.md](architecture.md).

- The vendored parser/AST owns annotation metadata and source positions.
  Test discovery and source generation use these, never UI regex.
- `BlueKTesting` belongs to the existing `KotliteSession`: discovery, results,
  replay journal and recording live in the worker. Publish typed `testing`
  snapshot data and test/state commands through the sole runtime client.
- Statement boundaries come from parser metadata. Preserve multiline string
  contents when indenting generated source. Replay chronology may require val
  assignment in init rather than moving all constructors into field initializers.
- Constructor/setup/test/teardown use the normal suspendable interpreter path,
  including enterCall/leaveCall, input, depth limits and generation checks.
- `TestWorkspace` owns only selection, dialog drafts and UI actions.
  `ProjectWorkspace` owns confirmed source changes, optional `testTarget` card
  links and `defaultTestClass`. Rename updates associations; they do not affect
  Kotlin semantics. Import/discovery includes classes without Test methods.
- Source/compile invalidation ends recording. Preview confirmation checks file
  revision and must not overwrite a source changed since preview generation.
- State replacement removes all class properties, BeforeTest methods and init
  blocks after the corresponding warning. Retain all other methods. Do not
  rely on marker comments. Do not automatically open editor/test panel for state
  save/load; open it for runs/recording.
- `inspectGet` evaluations are absent from the replay journal. Explicit get and
  codepad actions remain. Unused synthetic results/local bindings are elided,
  retaining effectful call/constructor execution. Required aliases and shared
  references must retain identity.
- Links carry state flags in the full-link fragment (`&state=1`) or short-link
  query (`?state=1`, optionally `?readme=1&state=1`). Auto-load delegates to the
  existing compile/state workflow after import; file import/autosave do not
  auto-load. Missing default disables the export option.

## Verification

- `npm run test:testing`: actual client/host/bundle, lifecycle, ignore/imports,
  failures, state roundtrips, recording, Stop and Cancel.
- `npm run test:testing:portable`: unchanged generated code with Kotlin 2.2.21,
  kotlin-test-junit5 and JUnit Jupiter 6.0.0 in a clean Gradle project; includes
  multiline arguments, init chronology, shared references and named assertions.
  Requires Java/Maven Central; artifacts in `.cache/kotlin-test-portability/`.
- `tests/gui/testing.spec.ts`: real Chromium card, state, recording, result,
  rerun and cancellation workflows. Project-format tests cover serialized links
  and defaults.
- Actual runs and manual acceptance are recorded separately in
  [regression-checklist.md](regression-checklist.md), RT-101–103/GUI-104–119.
