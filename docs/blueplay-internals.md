# BluePlay implementation

User API: [blueplay.md](blueplay.md). Binding ownership:
[architecture.md](architecture.md).

## Library and engine

BluePlay is the built-in, versioned library `{ id: "blueplay", version: 1 }`,
not editable project source.
Reject unknown/missing library versions. Imports migrate explicitly marked old
library source files to the built-in library without duplicating them.

`BluePlayLibrary.kt` supplies interpreted World/Actor/Image classes and public
functions ahead of project source. They are normal Kotlite classes, supporting
student inheritance, overrides, properties and reified type filters. Native
`bluek*` functions in `BluePlayEngine.kt` and pixel geometry in
`BluePlayDrawing.kt` implement expensive operations.

The session engine alone owns world membership/order, actors, images, collisions
and input. World does not maintain a parallel actor list. Match actors at the
root of their parentInstance chain, using identity rather than student equals.
Report world-retained actors via hostRetained for handle reachability; release
actor hit IDs when actors leave all worlds.

The runtime contract supplies typed BluePlayStage/simulation data. API help uses
the immutable `bluePlayApi.generated.json` built from Kotlite; only explanatory
text is maintained in `bluePlayApi.ts`. It neither parses source nor executes
student code. Engine-only properties remain private/hidden.

## Scheduler

RuntimeHost is the sole scheduler. Simulation commands implement step/start/
stop/reset/speed; the client has no parallel timer. Step calls World.act then
act on still-present actors. Empty default act bodies may be skipped without
changing behavior. Calling step while Run is active is ignored.

Plan the next step after `max(0, stepInterval(speed) - elapsed)` milliseconds,
including computation/publication cost. `stepInterval` is exponential like
Greenfoot's slider (ln of the interval is a parabola through 1 s at speed 1,
30 ms at 50 and 1 ms at 100), but keeps a real delay at the fastest end; the
BlueJ BluePlay reference uses `100 - speed` ms. A speed change during a wait
continues counting from the same step start. The scheduler reads the speed from
BluePlayEngine (`bluePlaySpeed()`), so `setSpeed()` in student code and the
slider act alike; RuntimeHost keeps no copy. Do not accumulate catch-up steps. simulationTimer
waits mainly with a timer and uses event-loop tasks for the last 4 ms, avoiding
nested-browser-timer clamping while admitting input/Pause events.

Run emits narrow frame events, not full snapshots every tick. Rendering/sending
is throttled to at most once every 10 ms; intervening ticks accumulate output
and effects into the next frame. The client merges frame fields into its
existing snapshot, retaining metadata/reference identities. Run ending, through
stop or exception, publishes a full snapshot including inspection.

Key/click acknowledgments update input only, never falsely set running phase or
republish stale frames. During Run, execution commands are rejected until Pause.
During property inspection, `Actor.isClicked` and `World.isClicked` report the
pending click without consuming it. The session supplies an inspection-context
query to the engine; normal student reads still consume matching clicks once.
This protects game input when the debugger's integrated inspector refreshes
getters. Other effects in student getters execute normally.

Completing a debugged tick resumes Run if that tick began automatically,
including when its last instruction was executed with Step. A tick started
through Act remains paused after completion. Errors and explicit `stop()` still
stop the scheduler.

Reset selects main, stops scheduling and invokes it in the same session via
startBluePlayMain. It may request input. The IDE world window always renders
Act, Run/Pause and Reset.
Without main, `ExecutionWorkspace.requestMain` returns before dispatch or UI
cleanup, so Reset preserves the world, objects, terminal and history.
The IDE clears the world on runtime snapshots in the `compiling` phase. This
also covers Codepad compilation on demand and failed compilation. Compile
replaces the session but never runs main automatically; users explicitly
start main to create the new world. Source edits invalidate the session and
disable the previous world's controls until compilation removes that view.
Start/Act without a shown world is a recoverable request error. A nonfatal
failure to begin a scheduled step pauses simulation and leaves the session
ready; only fatal interpreter errors set simulation to `faulted`.
World.show pauses; pure frame rendering
does not. Its reopen effect must work even if the UI previously closed the world.

## Rendering

Do not render each setter/method. takeStage/renderBluePlay constructs frames;
step suppresses intermediate frames. Each distinct image appears once per frame,
actors referencing indices. Image descriptions refresh only after changes.

bluePlayStage.ts derives canvas content: decorateStage resolves/caches image
content; StageRenderer draws/hit-tests; stageKeyName translates keys; StageAudio
plays sound effects: `playSound` resolves the resource in the engine (given
path, then `sounds/`, otherwise “Sound file not found”) and publishes a
`{type:'sound', name:'resource', path}` effect, independent of a shown world.
StageAudio decodes each resource once with Web Audio (bounded cache, media
element fallback), starts a separate source per call and stops all on
clearWorld (Reset/Compile). Caches and alpha masks are bounded; no world state is
owned there. The IDE owns focus, pressed keys and render timing. Draw at most
once per requestAnimationFrame; unloaded images get deterministic hittable
placeholders.

Showing or explicitly activating the world raises it above editors and focuses
its canvas. A new debugger pause temporarily lowers the world below the source
editor. Status-only snapshots, automatic getter inspection and steps without a
drawing change preserve that ordering. The first changed drawing (or explicit
World.show) restores the world and keyboard focus. Compare raw frame drawing
content only while the world has yielded to debugger source; ordinary game
frames incur no extra content comparison. Cancel pending focus requests at a
new pause or when the world closes.

While a world is running, plain game keys addressed to a background source
editor are captured before CodeMirror/Vim can consume them, and canvas focus
is restored. Modifier shortcuts, Escape and Tab retain their usual routing;
modal inputs are outside this recovery path. Suppress browser defaults on
every key repeat even though only key-state changes are sent to the runtime.
WebKit can direct a repeated Space's default text input to the previously
selected contenteditable editor even when the canvas has focus. That default
input restores editor focus, edits source, invalidates the runtime and leaves
an inactive world on screen. Prevent defaults before deduplicating key state.

Canvas retains real pixel dimensions. The window body scrolls/centers content,
uses gray margins for small worlds, and maximizes to viewport without scaling.
Virtual library cards participate in diagram drag/inheritance/placement but
open documentation rather than source editors.

## Collision and resource metadata

imageAlpha decodes project resources before compile, sending transient size and
alpha masks to the worker. Export/autosave retain only resource paths/Data URLs.
Report known resource paths even without masks to distinguish missing files.
Standard images with masks and standard sounds are generated from assets and bundled; project
resources override same-named defaults.

Collision uses rotated AABB rejection, inverse rotation/scale, shared world-pixel
geometry and alpha threshold **> 16**. Drawing operations use geometric masks;
text masks are approximate. Group actors by runtime class, filter T once per
group, visit matching groups and restore world order. Cache actor geometry
(center/rotation/bounds/image version) and parsed image operations per version.
Unrotated visibility uses a cached half-pixel grid equivalent to individual
pixel checks. Never skip collision checks for performance.

Browser hit testing visits actors in reverse drawing order, converts actual
canvas bounds/cellSize to world coordinates and sends a stable ID only for a
visible pixel. Removal during an actor's own act must remain safe.

## Performance and verification

Optimizations include class grouping, cached geometry/masks, lean frame transport,
bounded image caches, time-budget checkpoints and interpreter lookup/type caches.
Keep timing claims as measured evidence, not API guarantees. Compare
`scripts/benchmark-blueplay.mjs` at 0–400 shots. GUI PERF-01/03 observe real frame
transport; engine/helpers verify order, geometry and identity separately.

`test:blueplay-api` compares all public signatures/help metadata with the
independent pinned fixture, named arguments, valid/invalid calls and unchanged
student files. `smoke-blueplay-browser` and demo tests exercise runtime;
GUI-86/RT-47 inspect rendered pixels. Actual results and gaps are in
[regression-checklist.md](regression-checklist.md).
