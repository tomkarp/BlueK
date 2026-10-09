# BluePlay

BluePlay is the game library used in the inf-schule “OOP with Kotlin” course.
BlueK supplies a browser version of its BlueJ student API. Choose a BluePlay
project under **New Project**; the library cards are read-only API references,
not editable project files. Double-click a library card to open help.

## Worlds and execution

Create a subclass of World and add Actors, then show the world from main:

```kotlin
class MyWorld : World(600, 400, 1)

fun main() {
    val world = MyWorld()
    world.show()
}
```

The world window has, from left to right, **Act**, **Run** and **Reset**, then
**Speed**. While the world runs, Run turns into **Pause**; the three buttons keep
the same size in every state. Exported players use the same controls.
Speed works exponentially like Greenfoot's slider: about 1 s per step at 1,
30 ms at the default 50 and 1 ms at 100; the left half therefore slows down
considerably. Run performs its first step at once, and raising the speed
shortens a wait that is already running. Programs tuned for BlueJ's BluePlay
(`100 - speed` ms) run somewhat faster at the default speed.
One step calls World.act and then act on actors still present in the world.
Showing a world pauses simulation and reopens a previously closed world window.
Reset invokes the chosen main again in the existing session; it does not rerun
top-level property initialization. Keyboard/mouse input remains available during
Run. Pause before using codepad/object operations.

The canvas retains its real pixel size (`width * cellSize`, `height * cellSize`).
Large worlds scroll; maximizing changes the window, not the world's scale.

## Supported API

The in-app help provides complete signatures, parameter names and explanations.
This table is an overview, not an overload reference.

| Element | Public API |
| --- | --- |
| World | `World(width: Int, height: Int, cellSize: Int)`, width/height/cellSize, background, show, act, addObject, removeObject, allObjects, getObjects<T : Actor>, getObjectsAt, numberOfObjects, isClicked, setBackground, showText |
| Actor | `Actor()`, x/y/rotation, `image: Image?`, `world: World`, act, move, turn, turnTowards, distanceTo, intersects, isTouching<T>, getIntersecting<T>, getOneIntersecting<T>, removeTouching<T>, isAtEdge, isClicked |
| Image | `Image(width: Int, height: Int)`, `Image(fileName: String)`, `Image(other: Image)`, width/height, setColor, fill, fillRect, drawRect, fillOval, drawOval, drawLine, drawString, drawImage, clear, scale, setTransparency |
| Functions | isKeyDown, start, stop, step, getSpeed, setSpeed, playSound |

Use Kotlin properties such as `actor.image = Image("duck.png")`, not Java-style
setImage/getX helpers. `cellSize` is a required World constructor argument.
Actor.world and world-dependent collision/properties throw IllegalStateException
when the actor has no world. Movement, rotation and image changes can occur
without world membership. Inspectors display getter errors without ending the
session.

Movement supports arbitrary angles and rounds to whole cells. Coordinates are
clamped to world boundaries. turnTowards at the actor's own location retains
its rotation. Membership/collision use object identity, even with overridden
equals. Transparent image pixels do not collide or receive clicks.

## Images and sounds

Standard images such as `duck.png`, `cat.png` and `pizza.png` are bundled.
A project resource with the same path takes precedence. Only project resources
are saved/exported/listed as project files.

Missing images raise “Image file not found”. Image dimensions are at least one
pixel. drawImage copies source content/transparency at call time; scale changes
existing content. Loaded images can have additional drawing operations.

BluePlay's 13 standard sounds are bundled as well: `beep.wav`, `cat.wav`,
`dog.wav`, `explosion.wav`, `frog.wav`, `hit.wav`, `jump.wav`, `lose.wav`,
`magic.wav`, `pickup.wav`, `shoot.wav`, `step.wav` and `win.wav`. Like the
standard images they are not stored in the project, and a project sound with
the same name takes precedence.

Add sounds with the **Audio** button of a BluePlay project. It lists the
project's sounds and the standard sounds and previews them. Project sounds can
be renamed and, after confirmation, removed; standard sounds cannot. A rename
keeps the file type (a name without extension gets the old one) and refuses a
name another project sound already has. Calls in the source keep the old name,
so update `playSound` calls yourself. Accepted
formats are **WAV** and **MP3**, at most 1 MB per file: WAV for short effects
and BlueJ compatibility, MP3 for longer sounds or music. Other formats such as
OGG or M4A are rejected because not every browser or BlueJ plays them; files
the browser cannot decode are rejected as well. Adding or removing a sound
requires Compile.

`playSound("pop.wav")` plays `sounds/pop.wav` once; `playSound("sounds/pop.wav")`
works too. Sounds overlap and also play without a shown world, e.g. from the
codepad. A missing file raises “Sound file not found”. Reset and Compile stop
playing sounds. Audible output depends on the device and on the browser's
autoplay rules, which allow sound after a click or key press.

Add images with the **Images** button. Accepted formats are **PNG** and
**JPEG** (`.jpg`/`.jpeg`), at most 1 MB and 2048 pixels per side, for actors as
well as world backgrounds. Collisions, `isTouching` and clicks use the image's
alpha channel pixel by pixel (alpha above 16, as in BlueJ): transparent PNG
pixels never collide, while a JPEG has no transparency and collides as its full
rectangle. GIF (only its first frame would be used and transparency is 1-bit),
WebP (not readable by BlueJ), SVG (no fixed pixels for a mask), BMP and AVIF are
rejected; convert them to PNG. Project images can be renamed and, after
confirmation, removed like sounds; the file type is kept (`.jpg` and `.jpeg`
count as one type). Standard images cannot be changed but are replaced by a
project image with the same name. Adding, renaming or removing requires
Compile; `Image("…")` calls in the source keep their old names.

## Compatibility

Signatures and original student files are checked against the pinned
[BlueJ reference](../tests/fixtures/blueplay-reference/README.md).
JVM/AWT internals, java.awt.Color and file access are outside the browser API.
Browser font metrics/antialiasing are not pixel-identical to AWT; text collision
uses a geometric approximation. No universal frame-rate guarantee is made.

Developer references: [engine and scheduler](blueplay-internals.md),
[API audit](blueplay-api-audit.md).
