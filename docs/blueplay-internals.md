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

Plan the next step after `max(1, 100 - speed - elapsed)` milliseconds, including
computation/publication cost. Do not accumulate catch-up steps. simulationTimer
waits mainly with a timer and uses event-loop tasks for the last 4 ms, avoiding
nested-browser-timer clamping while admitting input/Pause events.

Run emits narrow frame events, not full snapshots every tick. Rendering/sending
is throttled to at most once every 10 ms; intervening ticks accumulate output,
audio and effects into the next frame. The client merges frame fields into its
existing snapshot, retaining metadata/reference identities. Run ending, through
stop or exception, publishes a full snapshot including inspection.

Key/click acknowledgments update input only, never falsely set running phase or
republish stale frames. During Run, execution commands are rejected until Pause.
Reset selects main, stops scheduling and invokes it in the same session via
startBluePlayMain. It may request input. World.show pauses; pure frame rendering
does not. Its reopen effect must work even if the UI previously closed the world.

## Rendering

Do not render each setter/method. takeStage/renderBluePlay constructs frames;
step suppresses intermediate frames. Each distinct image appears once per frame,
actors referencing indices. Image descriptions refresh only after changes.

bluePlayStage.ts derives canvas content: decorateStage resolves/caches image
content; StageRenderer draws/hit-tests; stageKeyName translates keys; StageAudio
plays sound/beep effects. Caches and alpha masks are bounded; no world state is
owned there. The IDE owns focus, pressed keys and render timing. Draw at most
once per requestAnimationFrame; unloaded images get deterministic hittable
placeholders.

Canvas retains real pixel dimensions. The window body scrolls/centers content,
uses gray margins for small worlds, and maximizes to viewport without scaling.
Virtual library cards participate in diagram drag/inheritance/placement but
open documentation rather than source editors.

## Collision and resource metadata

imageAlpha decodes project resources before compile, sending transient size and
alpha masks to the worker. Export/autosave retain only resource paths/Data URLs.
Report known resource paths even without masks to distinguish missing files.
Standard images and masks are generated from assets and bundled; project
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
