# BlueK development

Shared instructions for coding agents. Do not add tool-specific files such as
`CLAUDE.md`; extend this file or the relevant document instead.

## Read first

- [Architecture](docs/architecture.md): binding ownership and runtime contracts.
- [Development](DEVELOPMENT.md): setup, build pipeline and test commands.
- [Kotlin support](docs/kotlin-support.md): current user-facing limitations.

## Documentation

- Write maintained project documentation in **English**.
- Keep `README.md` a short user-facing overview. Put user instructions and
  reference material in `docs/`; agent instructions belong here. Technical
  contracts belong in focused development documents linked from this file.
- Keep documentation consistent with the code. Update `docs/kotlin-support.md`
  when supported Kotlin changes, and `docs/kotlin-surface.md` for stdlib changes.
- Remove obsolete plans and duplicated implementation narratives once their
  useful contracts and evidence are captured in maintained documents. Preserve
  third-party licenses, attribution and unmodified external test references.
- Maintain `docs/regression-checklist.md` when changing GUI/runtime behavior.
  Preserve stable IDs and distinguish user confirmation, helper/runtime tests,
  actual browser tests, and visual acceptance not yet performed. Keep concise
  dated results, including failures and blockers; test source holds detailed cases.

## Implementation rules

- Svelte is the only maintained frontend. Preserve its architecture unless
  explicitly asked to change it. Runtime state is authoritative; derive UI views
  from the snapshot. Use narrow typed capabilities, no second runtime store,
  general event bus, or Kotlin grammar/source-text regex in the UI.
- Kotlin semantics belong in `vendor/kotlite-interpreter/`, the source of truth,
  rather than the historical GitHub fork. Record every change in its `PATCH.md`.
  Add missing stdlib functions natively in
  `kotlite-browser/.../BlueKStdlibModule.kt`, with `docs/kotlin-surface.md` and
  `scripts/smoke-kotlin-surface.mjs` updated together.
- Preserve the [suspension contract](docs/kotlite.md#suspension-and-native-callbacks)
  (RT-37/38). Pausing host functions check `Interpreter.canSuspend` first and
  throw `InterpreterStateException` otherwise; student `catch` must never catch
  this fault. Exclude receiver-mutating native callbacks from `StdlibReplayMetadata`
  and supply suspendable `patchFunction` replacements.
- Every interpreted call uses `Interpreter.enterCall`/`leaveCall` for depth
  limits and stack reset (RT-42), including new paths that invoke student code.
  Only diagnostics with severity `error` fail compilation; show warnings and run.
- After Kotlin changes, run `npm run build:kotlite`. The checked-in bundle in
  `frontend/public/kotlite/` is used by all runtime tests.
- BluePlay is a built-in versioned library, not editable project source.
  Keep its **New Project** templates available.
- Follow [localization](docs/localization.md) for interface text. Keep complete
  sentences/paragraphs together. Translate terms only when natural; otherwise
  retain the exact English term. Compiler/runtime diagnostics stay English.
- For regression fixes, add or extend a meaningful behavior test where practical.
  Run affected tests and record actual results, failures and blockers. Never
  describe an unwritten or unrun test as passed.
- Do not commit or push without an explicit request.

## Technical references

- [Interpreter and suspension](docs/kotlite.md)
- [Generics and inline calls](docs/kotlite-generics.md)
- [BluePlay engine](docs/blueplay-internals.md) and [reference audit](docs/blueplay-api-audit.md)
- [Test/state implementation](docs/testing-internals.md)
- [Interface languages](docs/localization.md)
- [Regression evidence](docs/regression-checklist.md)
- [Deployment](docs/deployment.md)
- [Vendored interpreter changes](vendor/kotlite-interpreter/PATCH.md)
