# BluePlay API reference audit

Audit performed 30 September 2026; corrections on 30 September–1 October.
Current API: [blueplay.md](blueplay.md).

## Independent reference

Use the original [tomkarp/BluePlay BlueJ project at c8ace580](https://github.com/tomkarp/BluePlay/tree/c8ace580f0506571fc34f287280a3e04eba7c876),
including World.kt, Actor.kt, Image.kt, BluePlayFunctions.kt, student files and
API documentation. The downloaded reference is in
`tests/fixtures/blueplay-reference/`; do not regenerate it from BlueK's code.
Actor.image is nullable in the reference source despite its documentation table.
Engine internals and JVM/AWT fields are not student API.

## Reproduced defects and corrections

The original audit tested BlueK `21bc5cc`, bundle SHA-256
`3d53458154591b5e013252523c8b3ca1bf63bed5be11aeb3ec00f71425f3fab0`.
Twenty independent Node/VM probes found ten invalid rejections of original-valid
calls and ten accepted probes including undesired extensions/behavior changes.
The original three student files also loaded and ran successfully; this alone
did not establish full API compatibility.

| Defect | Corrected contract |
| --- | --- |
| allObjects/getObjectsAt returned List<Any>; add/removeObject accepted Any | List<Actor> results and Actor parameters |
| Missing getObjects<T : Actor> bound | Reject non-Actor type arguments |
| Synthetic Image constructor parameters/types | Three real typed constructors; original named arguments |
| Wrong named arguments for color, drawing, scale and turnTowards | Original parameter names/signatures |
| Extra setImage/setLocation/getX/showWorld/global show/Image() helpers | Removed from public student API; examples use properties and world.show |
| Public engine-only properties | Private and hidden from manifest/help/inspectors |
| Zero/negative image sizes and turnTowards at own position | Clamp size to at least one; retain rotation at own location |
| drawImage lost loaded source path/transparency; scale changed only surface size | Copy content/transparency at call time and scale existing pixels |
| Hand-maintained incomplete API help | Generated immutable signatures, constructors/properties/methods with explanations |

An extra pre-fix frame probe verified missing drawImage data but did not inspect
canvas pixels. No JVM/BlueJ execution occurred; reference behavior was inferred
from its source.

## Verification evidence

After correction, `test:blueplay-api` checked public signatures, 14 valid and
28 invalid calls, named arguments, unchanged original student files, object
lifetime and image copies. GUI-91 exercised all four help dialogs, with desktop
and narrow screenshots visually inspected by the agent. GUI-86/RT-47 checked
actual canvas pixels. Further runs: [regression-checklist.md](regression-checklist.md).

World.show pauses; step during Run is ignored; rendering alone never pauses.
Actor.world remains non-null World and throws without membership. Automatic
inspection catches ordinary getter errors per property while interpreter faults
remain fatal. Text rasterization is not promised pixel-identical to AWT;
text collision is approximate. No full JVM parity or user visual acceptance is
implied by the automated results.
