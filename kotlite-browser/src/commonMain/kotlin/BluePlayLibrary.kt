/**
 * The public BluePlay adapter.  The engine owns the world registry, scheduler
 * and resource/collision hooks; these declarations are the small Kotlin
 * surface that makes the native library feel like ordinary student code.
 */
object BluePlayLibrary {
    const val id = "blueplay"
    const val version = 1

    // Keep this source in the browser bundle instead of adding framework files
    // to a student's project. The stage is rendered by the session whenever a
    // command completes, so state changes here do not render individually.  It is analyzed together with the project, so
    // inheritance, overriding and generic calls use Kotlite's normal rules.
    val source: String = """
        class Image {
            private var drawingColor = "rgb(0,0,0)"
            private var drawingOperations = mutableListOf<String>()
            private var imageWidth = 1
            private var imageHeight = 1
            private var path = ""
            private var transparency = 255
            val width: Int get() = imageWidth
            val height: Int get() = imageHeight

            constructor(width: Int, height: Int) {
                imageWidth = if (width < 1) 1 else width
                imageHeight = if (height < 1) 1 else height
            }
            constructor(fileName: String) {
                imageWidth = bluekImageWidth(fileName)
                imageHeight = bluekImageHeight(fileName)
                path = fileName
            }
            constructor(other: Image) {
                imageWidth = other.width; imageHeight = other.height
                path = other.path; transparency = other.transparency
                drawingOperations = other.drawingOperations.toMutableList()
            }
            fun setTransparency(value: Int) { transparency = if (value < 0) 0 else if (value > 255) 255 else value }
            fun scale(width: Int, height: Int) {
                val w = if (width < 1) 1 else width; val h = if (height < 1) 1 else height
                val oldTransparency = transparency
                transparency = 255
                val snapshot = encodedSnapshot()
                transparency = oldTransparency
                path = ""
                drawingOperations = mutableListOf("drawImage|__bluek:" + snapshot + "|0|0|" + w + "|" + h)
                imageWidth = w; imageHeight = h
            }
            fun setColor(r: Int, g: Int, b: Int) {
                bluekCheckColor(r, g, b)
                drawingColor = "rgb(" + r + "," + g + "," + b + ")"
            }
            fun fill() { path = ""; drawingOperations = mutableListOf("fill|" + drawingColor) }
            fun fillRect(x: Int, y: Int, w: Int, h: Int) { drawingOperations.add("fillRect|" + x + "|" + y + "|" + w + "|" + h + "|" + drawingColor) }
            fun drawRect(x: Int, y: Int, w: Int, h: Int) { drawingOperations.add("drawRect|" + x + "|" + y + "|" + w + "|" + h + "|" + drawingColor) }
            fun fillOval(x: Int, y: Int, w: Int, h: Int) { drawingOperations.add("fillOval|" + x + "|" + y + "|" + w + "|" + h + "|" + drawingColor) }
            fun drawOval(x: Int, y: Int, w: Int, h: Int) { drawingOperations.add("drawOval|" + x + "|" + y + "|" + w + "|" + h + "|" + drawingColor) }
            fun drawLine(x1: Int, y1: Int, x2: Int, y2: Int) { drawingOperations.add("drawLine|" + x1 + "|" + y1 + "|" + x2 + "|" + y2 + "|" + drawingColor) }
            fun drawString(text: String, x: Int, y: Int) {
                var encoded = ""; var index = 0
                while (index < text.length) {
                    val character = text.substring(index, index + 1)
                    encoded += if (character == "\\") "\\\\" else if (character == "|") "\\p" else if (character == "\n") "\\n" else character
                    index += 1
                }
                drawingOperations.add("drawString|" + encoded + "|" + x + "|" + y + "|" + drawingColor)
            }
            fun drawImage(image: Image, x: Int, y: Int) {
                val snapshot = image.encodedSnapshot()
                drawingOperations.add("drawImage|__bluek:" + snapshot + "|" + x + "|" + y + "|" + image.width + "|" + image.height)
            }
            private fun encodedSnapshot(): String {
                val nested = bluekImageSnapshot(this)
                var encoded = ""; var index = 0
                while (index < nested.length) {
                    val character = nested.substring(index, index + 1)
                    encoded += if (character == "\\") "\\\\" else if (character == "\"") "\\\"" else if (character == "|") "\\p" else if (character == "\n") "\\n" else character
                    index += 1
                }
                return encoded
            }
            fun clear() { drawingOperations.clear(); path = "" }
        }

        open class World(val width: Int, val height: Int, val cellSize: Int) {
            private val textX = mutableListOf<Int>()
            private val textY = mutableListOf<Int>()
            private val textValues = mutableListOf<String>()
            var background: Image = Image(width * cellSize, height * cellSize).also { it.setColor(255, 255, 255); it.fill() }

            fun show() { bluekShowWorld(this) }
            open fun act() {}
            fun addObject(actor: Actor, x: Int, y: Int) { bluekWorldAddObject(this, actor, x, y) }
            fun removeObject(actor: Actor) { bluekWorldRemoveObject(this, actor) }
            fun allObjects(): List<Actor> = bluekWorldObjects<Actor>(this)
            inline fun <reified T : Actor> getObjects(): List<T> = bluekWorldObjects<T>(this)
            fun getObjectsAt(x: Int, y: Int): List<Actor> = bluekWorldObjectsAt<Actor>(this, x, y)
            val numberOfObjects: Int get() = bluekWorldObjectCount(this)
            val isClicked: Boolean get() = bluekIsWorldClicked()
            fun setBackground(fileName: String) { background = Image(fileName); background.scale(width * cellSize, height * cellSize) }
            fun setBackground(r: Int, g: Int, b: Int) {
                background = Image(width * cellSize, height * cellSize).also { it.setColor(r, g, b); it.fill() }
            }
            fun showText(text: String, x: Int, y: Int) {
                var index = 0
                while (index < textValues.size) {
                    if (textX[index] == x && textY[index] == y) {
                        if (text.isEmpty()) {
                            textX.removeAt(index); textY.removeAt(index); textValues.removeAt(index)
                        } else textValues[index] = text
                        return
                    }
                    index += 1
                }
                if (!text.isEmpty()) { textX.add(x); textY.add(y); textValues.add(text) }
            }
        }

        open class Actor {
            // Set by the engine when the actor enters or leaves a world, so
            // that the setters clamp without asking the engine.
            private var worldWidth = 0
            private var worldHeight = 0
            private var worldCellSize = 1
            var x = 0
                set(value) { field = if (worldWidth > 0) if (value < 0) 0 else if (value >= worldWidth) worldWidth - 1 else value else value }
            var y = 0
                set(value) { field = if (worldHeight > 0) if (value < 0) 0 else if (value >= worldHeight) worldHeight - 1 else value else value }
            var rotation = 0
                set(value) { field = ((value % 360) + 360) % 360 }
            var image: Image? = null
            // World-dependent members throw IllegalStateException without a world.
            val world: World get() = bluekActorWorld<World>(this)
            open fun act() {}
            fun move(distance: Int) { x += bluekMoveDeltaX(rotation, distance); y += bluekMoveDeltaY(rotation, distance) }
            fun turn(degrees: Int) { rotation += degrees }
            fun turnTowards(x: Int, y: Int) {
                if (x != this.x || y != this.y) rotation = bluekHeading(this.x, this.y, x, y)
            }
            fun distanceTo(other: Actor): Int = bluekDistance(x, y, other.x, other.y)
            fun intersects(other: Actor): Boolean = bluekIntersects(this, other)
            inline fun <reified T : Actor> getIntersecting(): List<T> = bluekIntersecting<T>(this)
            inline fun <reified T : Actor> getOneIntersecting(): T? = bluekOneIntersecting<T>(this)
            inline fun <reified T : Actor> isTouching(): Boolean = bluekIsTouching<T>(this)
            inline fun <reified T : Actor> removeTouching() { bluekRemoveTouching<T>(this) }
            val isAtEdge: Boolean get() { val currentWorld = world; return x <= 0 || y <= 0 || x >= currentWorld.width - 1 || y >= currentWorld.height - 1 }
            val isClicked: Boolean get() = bluekIsActorClicked(this)
        }

        fun isKeyDown(key: String): Boolean = bluekIsKeyDown(key)
        fun start() { bluekSimulationStart() }
        fun stop() { bluekSimulationStop() }
        fun step() { bluekStep() }
        fun getSpeed(): Int = bluekGetSpeed()
        fun setSpeed(value: Int) { bluekSetSpeed(value) }
        fun playSound(fileName: String) { bluekPlaySound(fileName) }
    """.trimIndent()
}
