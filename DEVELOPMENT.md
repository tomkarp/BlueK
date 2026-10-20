# Developing BlueK

Read [AGENTS.md](AGENTS.md) and the binding [architecture](docs/architecture.md)
before changing the application. User documentation starts in [README.md](README.md).

## Setup

- Node.js 22, as used in CI.
- Java 21 for `build:kotlite` and the complete `build`.
- Browser tests: `npx playwright install chromium webkit` after installing packages.

```sh
npm ci
npm run dev     # http://localhost:5173
```

The interpreter bundle is checked in, so development does not normally need
Gradle. Vite forwards project-sharing `/api` requests to the optional service at
`127.0.0.1:8787`; start it with `npm run share:server` for short links. Feedback
requests use the configured service at `https://bluek.online`, so local development
does not need a copy of its GitHub token. Set `BLUEK_FEEDBACK_PROXY_TARGET` to a
local service URL when developing the backend. Server-only credentials are
described in [feedback](docs/feedback.md).

## Build pipeline

Student Kotlin is interpreted, not compiled. `npm run build` builds these tools:

1. **build:kotlite**: Gradle compiles `kotlite-browser` and the vendored
   interpreter with Kotlin 2.2.21/JS IR, links `kotlite-stdlib` 1.1.0 and runs
   webpack. The output `frontend/public/kotlite/bluek-kotlite-browser.js` and
   generated `frontend/src/bluePlayApi.generated.json` must be updated together.
2. **build:player**: builds the embedded player worker/runtime and UI into
   `frontend/public/player/bluek-player.html` (generated, not committed).
3. **build:offline**: embeds the same Svelte IDE, Blob worker, interpreter,
   standard images, templates, formatter WASM and player template into
   `dist-offline/BlueK-offline/BlueK.html`. Packages it with instructions and
   copies the ZIP into `frontend/public/downloads/`.
4. **vite build**: builds the hosted IDE into `frontend/dist/`.

`npm run build:svelte` builds the frontend without rebuilding Kotlin.
`npm run build:standard-images` regenerates the committed image/alpha-mask,
sound and BlueJ library modules after changing `assets/standard-images/`,
`assets/standard-sounds/` or `assets/bluej-blueplay/`. The latter holds the
JVM version of BluePlay that BlueJ exports contain; it starts as a copy of the
final BlueJ version and is maintained here. `npm run test:bluej-export` checks
the export; `node scripts/check-bluej-export-kotlinc.mjs` additionally compiles
every exported example with `kotlinc` (optional, needs the Kotlin compiler).
`assets/standard-images-originals/` keeps the high-resolution source graphics
of 14 standard images under the same names; no build step reads them.

`predev` builds the player template if missing or older than the interpreter,
and the offline ZIP only if missing. An existing offline ZIP may therefore
be stale during development; explicitly rebuild it when needed.
Preview a production build with a static server, for example:

```sh
python3 -m http.server 4173 --directory frontend/dist
```

## Source ownership

| Path | Responsibility |
| --- | --- |
| `frontend/src/components/` | Svelte presentation and local UI interaction |
| `frontend/src/workspace/` | Typed controllers owning project, editor, execution, object, test, BluePlay and terminal UI state |
| `frontend/src/` | Runtime client/worker/host, project I/O, formatters, rendering and player |
| `runtime-contract/src/index.ts` | Shared typed commands, snapshots and metadata |
| `kotlite-browser/` | Kotlin/JS session, native stdlib additions, BluePlay library/engine, testing |
| `vendor/kotlite-interpreter/` | Parser, analyzer and interpreter; changes recorded in `PATCH.md` |
| `jvm/` | Gradle 8.14.1 wrapper; directory name is historical |
| `frontend/public/` | Checked-in interpreter and templates; generated player/download assets |
| `scripts/`, `tests/gui/` | Build scripts, runtime/helper tests, Playwright tests |
| `server/`, `data/` | Optional SQLite share service and attributed word list |

Session changes belong in `KotliteSession.kt`; language semantics in the
vendored interpreter. Stdlib additions belong in `BlueKStdlibModule.kt`, while
changes to existing binary stdlib functions can use
`ExecutionEnvironment.patchFunction` in `KotliteSession.resetInterpreter`.
BluePlay public API lives in `BluePlayLibrary.kt`; native engine/drawing logic
in `BluePlayEngine.kt`/`BluePlayDrawing.kt`.

## Tests

After Kotlin changes, rebuild the interpreter **before** tests: they use the
checked-in browser bundle. Select checks appropriate to the changed behavior;
a helper passing does not prove a visible browser interaction.

| Command | Scope |
| --- | --- |
| `npm run typecheck` | TypeScript and Svelte diagnostics |
| `npm run test:regression` | Combined checks, runtime/helpers, offline package and GUI suite |
| `npm run browser-smoke` | Architecture rules, bundle, BluePlay API/runtime, curriculum Kotlin and runtime state |
| `npm run test:runtime-state` | Real client/host/bundle with worker substitute: identity, snapshots, input, concurrency and stale replies |
| `npm run test:debugger` / `npm run test:debugger:gui` | Real Kotlin-session pause/resume and getter-safety smoke; focused Chromium step and breakpoint interactions |
| `npm run test:references` | Session namespace and reachability |
| `npm run test:testing` | Test lifecycle, saved state, recording, failure and cancellation |
| `npm run test:testing:portable` | Generated Kotlin unchanged under kotlin.test/JUnit Jupiter; requires Java, Gradle and Maven Central |
| `npm run test:generics` | Generics, reified types, inline control flow and analysis boundaries |
| `npm run test:kotlin-surface` | Promised stdlib operations and explicit known gaps |
| `npm run test:argument-diagnostics` | Kotlin call diagnostics and positions: scope/receiver reachability, argument types and overload/rejection boundaries |
| `npm run test:control-flow` | Block-function completion, returns/throws/loops/finally, lambda/expression-body boundaries and Boolean if-conditions using the checked-in bundle |
| `npm run test:control-flow:kotlin` | Compile the same fixtures with installed `kotlinc` and execute accepted programs with Java; prints the compiler version and checks diagnostics/positions/output |
| `npm run test:flow-state` | Definite initialization, nullability and simple-capture fixtures in split projects, checked against the bundled interpreter |
| `npm run test:flow-state:kotlin` | Compile the same flow-state fixtures with installed Kotlin/JVM and run accepted programs |
| `npm run test:blueplay-api` | Independent pinned BlueJ API, help manifest and original student examples |
| `npm run test:blueplay-demos` | Space Invaders template in the interpreter |
| `npm run test:inspector`, `test:codepad-flow`, `test:project-format`, `test:program-export`, `test:blueplay-stage`, `test:player-worker`, `test:ui` | Focused TypeScript/helper behavior |
| `npm run test:window-interaction` | Window geometry, minimum sizes, pointer cancellation and title buttons |
| `npm run test:workspace` | Compiled Svelte controllers, cloneable arguments, isolated app instances and stale results |
| `npm run test:project-drafts` | Draft ownership, migration, locks, storage failure and unchanged saves |
| `npm run test:offline` | Build/ZIP checks and real Chromium/WebKit file:// execution without HTTP |
| `npm run test:gui` | Chromium against a dedicated Vite server on port 5194 |
| `npm run test:share-server` | Share service with a temporary SQLite database |
| `node scripts/smoke-share-routing.mjs` | Production build below `/BlueK/` with a SPA fallback and the real share service (temporary database); four share-link forms, transitional `/load/`, player/developer navigation and unavailable/blocked codes in Chromium/WebKit |
| `npm run test:performance` | Interpreter benchmarks with thresholds; avoid competing heavy loads |
| `npm run test:conformance` | Pinned official Kotlin box tests; separate from regression suite, downloads corpus initially |
| `node scripts/benchmark-blueplay.mjs` | Tick/frame and collision costs with 0–400 shots |
| `node scripts/check-interactive-core.mjs` | Direct bundle input/suspension check |

GUI reports: `playwright-report/`; screenshots/traces: `test-results/`.
Coverage IDs, actual results and remaining acceptance gaps:
[regression checklist](docs/regression-checklist.md).

`npm run test:interfaces` checks split-project interface guards, inherited
methods and qualified super calls against the bundled interpreter;
`npm run test:interfaces:kotlin` runs the same cases with installed Kotlin/JVM.
`npm run test:bluej-selection` covers discovery and isolated import of projects
inside a collection ZIP or folder.

Conformance takes roughly five minutes. `-- --report` lists failures;
`-- --update` replaces the baseline in `scripts/conformance-baseline.txt`.
Do not silently update it to hide a regression.

For readable CPU profiles, build
`./jvm/gradlew -p kotlite-browser jsBrowserDevelopmentWebpack`, then run:

```sh
BLUEK_BUNDLE=kotlite-browser/build/kotlin-webpack/js/developmentExecutable/bluek-kotlite-browser.js node --cpu-prof scripts/benchmark-blueplay.mjs
```

Open the resulting `.cpuprofile` in Chrome DevTools.

## Interface translations

See [localization](docs/localization.md) for message catalogs, language ownership
and translation checks.

## Deployment

`main` deploys to bluek.online and GitHub Pages; `beta` to beta.bluek.online.
Pushes trigger full builds through `.github/workflows/`.
See [deployment instructions](docs/deployment.md) for Caddy, secrets and the
optional share service. Commit and push only when explicitly requested.
