# BlueK development

This file is shared by all coding agents (Codex, Claude, …). Do not add
tool-specific instruction files such as `CLAUDE.md`; extend this file or
`docs/` instead.

Read first: `docs/architecture.md` (binding), `DEVELOPMENT.md` (build and
tests) and the section "Aktuelle Grenzen" in `README.md`. Project
documentation is written in German.

## Rules

- Maintain `docs/regression-checklist.md` when changing GUI or runtime
  behavior. Preserve stable IDs and distinguish user confirmation,
  helper/runtime tests, actual browser tests, and untested visual acceptance.
- For regression fixes, add or extend a meaningful behavior test where
  practical. Run affected tests and record actual results, including failures
  or blockers. Never report tests as passed that were only written.
- Svelte is the only maintained frontend. Preserve its existing architecture
  unless the user explicitly requests architectural changes.
- The user prioritizes clear ownership and narrow typed interfaces. Follow
  `docs/architecture.md`; keep runtime state authoritative and derive UI views
  instead of maintaining duplicate copies. No second runtime store, no general
  event bus, no Kotlin grammar or source-text regex in the UI.
- Kotlin language semantics belong in `vendor/kotlite-interpreter/`, which is
  the source of truth for the interpreter (not the GitHub fork). Record every
  change there in `vendor/kotlite-interpreter/PATCH.md`. Missing stdlib
  functions go natively into `kotlite-browser/.../BlueKStdlibModule.kt`
  together with `docs/kotlin-surface.md` and `scripts/smoke-kotlin-surface.mjs`.
- Keep the suspension contract (`docs/kotlite.md`, RT-37/RT-38): a host
  function that pauses (input, sleep) checks `Interpreter.canSuspend` first
  and otherwise throws `InterpreterStateException`, which no program `catch`
  may handle. Stdlib code is replayed after a suspended callback, so a library
  function that changes its receiver between callbacks must be excluded in
  `StdlibReplayMetadata` and get a suspendable `patchFunction` replacement.
- After Kotlin changes run `npm run build:kotlite`. The bundle in
  `frontend/public/kotlite/` is committed and used by all tests.
- BluePlay is a built-in, versioned project library, not project source
  files. Keep template creation (New Project) available.
- Keep the documentation consistent with the code: update "Aktuelle Grenzen"
  in `README.md` when supported Kotlin changes. Completed implementation
  prompts go to `docs/archive/`, not into `docs/`.
- Do not commit or push without an explicit request.
