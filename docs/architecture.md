# BlueK architecture

Binding development contract; see [AGENTS.md](../AGENTS.md).
Svelte is the only maintained frontend. Build commands are in
[DEVELOPMENT.md](../DEVELOPMENT.md).

## Principles

- The worker runtime owns object state, name bindings, class metadata and phase.
  UI views derive from its published `RuntimeSnapshot`; no second mutable copy.
- Modules receive narrow typed capabilities such as `InspectorRuntime` or
  `CodepadClient`. No general event bus or alternate runtime path.
- `LocalRuntimeClient` is the sole gateway to the runtime.
- Kotlin grammar, signatures, types and diagnostics come from Kotlite, never
  source-text regex or a second parser in the UI.

## Layers and ownership

```text
Svelte components ← UI workspace controllers
                              │
                    LocalRuntimeClient
                              │ typed worker commands/replies/events
                    runtimeWorker → RuntimeHost
                              │ KotliteSessionBridge
                    KotliteSession (Kotlin/JS)
                              │
           Kotlite interpreter + BluePlayEngine + BlueKTesting
```

One worker generation contains one `KotliteSession` and one live interpreter.
Compile replaces all three. Student source is interpreted as AST nodes;
only the tools are compiled at build time.

### Main thread

| Owner | Responsibility |
| --- | --- |
| `SvelteApp.svelte` | Creates one controller per domain, wires components, global shortcuts and Escape ordering |
| `ProjectWorkspace.svelte.ts` | Files, library, resources, README/name, card geometry, import/templates, autosave and export |
| `EditorWorkspace.svelte.ts` | Editor windows/tabs, diagnostics and CodeMirror registrations |
| `ExecutionWorkspace.svelte.ts` | Sole runtime client, published snapshot, compile/main/reset/codepad coordination |
| `ObjectWorkspace.svelte.ts` | Call dialogs, menus and inspector window data; bench/field values are derived |
| `TestWorkspace.svelte.ts` | Test selection, recording controls, dialog drafts and confirmed source transfer |
| `BluePlayWorkspace.svelte.ts` | World window, canvas/input/audio presentation |
| `TerminalWorkspace.svelte.ts` | Terminal output/window presentation |
| `WorkspaceUi.svelte.ts` | Shared focus, status, settings and pane sizes |

Controllers use one `$state`/`$derived` instance per domain. Host interfaces
are narrow `Pick` capabilities; foreign domain data is `Readonly`. Mutations
such as closing a window or clearing diagnostics use named owner actions.
Runtime snapshots remain `$state.raw`; project/library data cross the worker
boundary without Svelte proxies. Reactive argument drafts are copied to plain
arrays before a runtime call.

Effects/subscriptions belong to the app instance and are cleaned up on unmount.
Connection setup reads UI state with `untrack` to prevent reconnecting on edits.
Components in `components/` own presentation and local interaction; they never
create a worker, runtime client or independent runtime store.

Supporting modules:

- `uiTypes.ts`: presentation types only. `uiActions.ts`: focus/click boundaries
  and popup placement. `windowInteraction.ts`: shared pointer/window geometry.
- `editorActions.ts`: editor/Markdown lifecycle, formatting, comments and Vim
  interaction, with editor registrations and error callback only.
- `classDiagramInteraction.ts`: card drag and arrow DOM measurements.
  `objectMenuMethods.ts`: visible method derivation from metadata.
- `runtimeMetadata.ts`: cards and inherited members from the Kotlite manifest.
  `mainEntries.ts`: entry points from metadata, not source text.
- `projectBrowserIO.ts`: browser file/directory reads, downloads, links and
  clipboard; owns neither project nor runtime.
- `projectFormat.ts`: validates unknown external payloads, resource/card data,
  `testTarget` and default test class; no DOM/Svelte/runtime dependency.
  `projectTemplates.ts`: HTTP templates online, fresh embedded copies offline.
- `blueJImport.ts`: chooses the shallowest `package.bluej` in a ZIP/folder,
  imports Kotlin/resources/positions and substitutes the built-in library for
  historical BluePlay framework files.
- `kotlinFormatterClient.ts`: bundled ktfmt WASM, independent of runtime state.
  Offline builds provide embedded gzip bytes; no CDN dependency.
- `terminalText.ts`: interprets raw output control sequences for IDE and player;
  text style/layout is presentation, never a replacement runtime output store.

### Browser drafts

`projectDraftStorage.ts` owns storage I/O and exclusive document-lifetime draft
ownership. Session Storage contains the draft ID only; one Local Storage entry
per ID contains project data. Edits, template changes and explicit link imports
replace that tab's entry without version history. Storage events derive Recent
work from the saved entries. Web Locks prevent copied tabs sharing writes; the
fallback forks on restoration. Legacy single-project autosave is migrated.

Deleting saved drafts requires confirmation and keeps settings/open projects.
An unchanged tab does not recreate a deleted entry on close or BFCache return;
subsequent edits may save again. Normalize payloads before fingerprinting so
JSON field order cannot create false updates. Keep the fingerprint when
reclaiming the same draft; reset it when ownership requires a new ID.

Link README/state options belong to transfer. After link import,
`ProjectWorkspace` delegates default-state loading to
`TestWorkspace.loadDefaultFixture`, using the ordinary compile/state path and
opening no test panel.

### Worker and contract

`runtime-contract/src/index.ts` defines commands, replies, metadata, snapshots
and project types. Presentation details do not belong in this protocol.
`runtimeWorker.ts` initializes the interpreter bundle once and dispatches to
`RuntimeHost`. Hosted, player and offline worker factories differ only in how
they supply the bundle. Client, protocol and runtime ownership stay identical.

`RuntimeHost` owns phases, execution IDs, output collection, passive inspection
and the sole BluePlay scheduler. `KotliteSession` owns source history, interpreter,
namespace, handles, input/continuations and manifest. `BluePlayEngine` owns world,
actor, image, collision and input state. `BlueKTesting` owns discovery, results,
replay journal and recording in that same session.

## Build

Kotlin/JS builds the vendored interpreter and `kotlite-browser` with the binary
stdlib. The checked-in bundle and generated BluePlay API manifest feed hosted,
player and offline builds. The help UI formats immutable manifest data without
executing student code. See [build pipeline](../DEVELOPMENT.md#build-pipeline).

## Runtime

### Generations and phases

Compile terminates the old worker, rejects pending requests, creates a UUID
`generationId`, starts a worker and loads project/library/resources. Every reply
and event carries the generation. Client epoch, host execution ID and input
request ID prevent late or duplicate results from being applied. Related UI
dialogs/handles are invalidated. Source edits invalidate the session.

| Phase | Meaning |
| --- | --- |
| `uncompiled` | No runnable session |
| `compiling` | Loading/analyzing a new project |
| `ready` | A command can start |
| `running` | A command runs; competing execution requests are rejected |
| `waitingForInput` | A suspended command waits for a line or EOF |
| `faulted` | Interpreter/transport fault; Compile or Reset required |

Stop terminates the worker and returns to `uncompiled`. Ordinary Reset
recompiles the last submitted project; BluePlay Reset invokes the selected main
in the same session. Analysis failure executes nothing. Compile failure remains
uncompiled and cannot be bypassed by compile-on-demand.

Ordinary program exceptions end only the command (`fatal: false`, `ready`);
interpreter calls clean up through `finally`. No rollback or replay repair:
prior side effects remain. Uncaught main/act exceptions also print a red stack
trace and stop Run. Interpreter faults such as `InterpreterStateException`
remain non-catchable by student code; passive backing-field inspection may
still be possible.

### Protocol

Commands include eval/main/create/invoke/get/set, inspection, bind/remove,
input/key/click, simulation and test/state operations; worker commands add
compile. `WorkerReply` combines result and snapshot; events stream start,
output, snapshot, input requests and simulation frames.

Snapshots publish generation/revision/phase, metadata, valid-handle inspections,
references, live IDs, errors, testing data and simulation/stage data. Ordinary
completed commands publish a full snapshot. Running BluePlay publishes narrow
frame events instead, retaining other snapshot field identities; stopping Run
publishes a full snapshot. Streaming text is batched about every 16 ms, with
immediate first output and flushing before input/completion and prolonged waits.

### Incremental analysis

`KotliteSession` keeps successful source history and a live interpreter.
Interactive commands append ordinary Kotlin fragments. `ReplAnalyzer` parses
and analyzes the entire history plus the new fragment, but evaluates only new
nodes: classes first, functions next, other code in source order. Old
constructors, initializers and effects do not rerun. Commit the new history
only on successful execution; do not reconstruct failed calls from outputs.

Project loading uses `startLoadProject`, validates every file AST before
initialization and joins source with file-position mappings, library and
source-unit boundaries. With BluePlay enabled, reject project files named
World.kt, Actor.kt, Image.kt or BluePlayFunctions.kt rather than silently loading
a duplicate library. Multiple main functions receive internal aliases; manifest
and UI retain their public name. Only error diagnostics prevent loading;
warning diagnostics remain visible in the editor. Analyze declarations together
and initialize top-level properties in file order. Forward lookup is restricted
to its source unit: a future codepad overload must not change old resolution,
and library source must not see project declarations.
Detailed analyzer contracts: [Kotlite](kotlite.md#forward-declarations).

### Suspension and checkpoints

Input stores one continuation and emits `inputRequested`; a matching line or
EOF resumes it. EOF is null for `readLine`/`readlnOrNull`, an error for `readln`.
Ordinary loops synchronously check a 10 ms work budget and yield using a
MessageChannel (`setImmediate` in Node). Each new execution/resumption resets
that budget. Code without loops may occupy the worker until completion; Stop
still works by external worker termination.

All calls use `enterCall`/`leaveCall`. Asynchronous execution resets the JS stack
through a microtask every 32 nested calls; depth is capped at 1,000.
`Thread.sleep(Int/Long)` uses an injected timer continuation, never busy waiting.
Synchronous session APIs reject suspension.

Binary stdlib callbacks need replay after suspension. Non-replayable callbacks
and interpreter internals must reject pausing before it occurs. See the binding
[suspension contract](kotlite.md#suspension-and-native-callbacks).

## Objects, names and handles

These are distinct:

- **Identity**: actual `ClassInstance` roots, compared with `===`, never student
  `equals`. Aliases and method results refer to the same object.
- **Binding**: stable Kotlite symbol, origin (`interactive`/`persistent`) and
  `onBench`; current values are read from the interpreter, not copied into an
  alias table. Persistent `var` reassignment updates its derived bench view.
- **Handle**: an internal object ID backed by a synthetic typed declaration
  whose value is written directly to the symbol table. Invocations address it
  without constructing an object again.

Codepad/project declarations are persistent; constructor-dialog and new Get
names are interactive. `bind` to an existing name and identical instance is
idempotent and shows the bench view; a different value conflicts. `remove`
frees interactive names, but only hides persistent bindings. Stale identity
removal is rejected. Snapshot references derive the bench and inspector titles.

Successful source history is immutable. Name release is recorded at a source
boundary: analyze old uses under their old symbol, then remove that symbol
from the analyzer scope. Redeclaration receives a new symbol. Never delete old
source or rerun alias initializers to make a name available.

### Reachability

Unnamed results initially have provisional handles. Once reachable from the
namespace, a handle is only a view, not another owner. Recompute reachability
after commands/removal; unreachable handles expire, inspectors close and old
Get actions disable. A newly returned detached value can receive a new
provisional handle without reviving an expired one.

`reachableRuntimeValues` follows backing fields, inheritance, lambda captures,
native collections/maps/pairs and explicit host-wrapper references. Identity
cycle detection keeps traversal linear. Never invoke getters, student equality
or lazy iterators. Lambda captures retain property holders; iterator wrappers
expose their source through `retainedRuntimeValues`. Opaque wrappers must expose
retained references explicitly; BluePlay contributes actors via `hostRetained`.
This invalidates UI handles, not JavaScript's garbage collector.

## Inspector

Windows own IDs/geometry only. Runtime snapshots own field/getter values and
errors; there is no UI getter cache. Passive snapshots read backing fields,
including inherited fields, with `readBackingPropertyByDeclaredName`; they do
not call getters or student `toString`. Collection previews are bounded.

Opening/refreshing an inspector invokes properties through `inspectGet` in the
normal interpreter path, catching ordinary exceptions per property. Evaluation
continues after such errors; interpreter faults remain fatal. Private getters
use typed runtime access. Coalesce concurrent refreshes, invalidate requests
on compile/close and rerun if refreshed while another pass was pending.
Automatic inspection calls do not enter the test-state journal.

Getter errors appear in normal value cells with tooltip/full-message action.
Field edits use typed runtime `set`; displayed object/collection text is not
valid editable Kotlin and begins with an empty input. Empty Enter cancels;
clicking a bench object inserts its snapshot name. Simulation inspection uses
the last completed tick. Shared window activation orders editors, inspectors
and terminal; context menus sit above them, modal action dialogs above menus.

## Codepad and main

`codepadFlow.ts` compiles on demand, executes eval and discards stale-generation
results. Every non-Unit result can receive a handle, including primitive values.
Get uses `bind`; removing a persistent name's bench view does not erase its
codepad variable.

`mainEntries.ts` derives `main()` and `main(args: Array<String>)` from metadata;
args is empty. Main/reset/export choose the only candidate or ask each time
when several exist. The chosen file is explicit and validated by the host;
no remembered selection. Invalidation closes pending choices. Direct codepad
`main()` retains its session name binding; project actions use explicit files.

## Export and offline

`programExport.ts` validates `{ format: "bluek-program", version: 1, mainFile,
blueKUrl, project }`, reusing project validation. The embedded JSON escapes
HTML-sensitive characters and U+2028/U+2029; embedded scripts escape closing
script tokens/comments. `playerMain.ts` creates a Blob worker, using the same
client, runtime and resource preparation as the IDE. Decompression avoids
`Blob.stream()` for WebKit file:// compatibility.

Console exports start immediately; Restart recompiles. BluePlay exports load
paused with Step/Run/Reset/Speed. Project download preserves JSON; Open in BlueK
is offered only within the 1 MB link limit. IDE export compiles on demand,
chooses main, checks unchanged generation, obtains the generated template and
downloads HTML.

The offline IDE embeds the same app, formatter, assets and player template.
Only worker/asset factories change; no alternate execution model. Short links
are hidden, full links target the public site, removing the project hash keeps
the local file path intact.

## Related contracts and remaining work

- [BluePlay engine/scheduler/rendering](blueplay-internals.md)
- [Test discovery, state replay and recording](testing-internals.md)
- [Generics and inline control flow](kotlite-generics.md)
- [Interpreter boundaries and technical debt](kotlite.md#remaining-technical-debt)
- [Actual regression evidence](regression-checklist.md)

Remaining work includes truly incremental analysis, lexical call-parent scopes,
full cross-class type inference and broader generic-superclass metadata checks.
Split future UI work by ownership without extra runtime clients/global stores.
