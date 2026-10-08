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

The world window has **Act**, **Run/Pause**, **Reset** and **Speed** controls.
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

Adding your own images/sounds through the UI is not enabled yet. Import them
through a BlueJ project or project JSON. playSound uses project sounds.

## Compatibility

Signatures and original student files are checked against the pinned
[BlueJ reference](../tests/fixtures/blueplay-reference/README.md).
JVM/AWT internals, java.awt.Color and file access are outside the browser API.
Browser font metrics/antialiasing are not pixel-identical to AWT; text collision
uses a geometric approximation. No universal frame-rate guarantee is made.

Developer references: [engine and scheduler](blueplay-internals.md),
[API audit](blueplay-api-audit.md).
