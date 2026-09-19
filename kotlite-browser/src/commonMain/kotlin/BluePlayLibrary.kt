/**
 * The public BluePlay adapter.  The engine owns the world registry, scheduler
 * and resource/collision hooks; these declarations are the small Kotlin
 * surface that makes the native library feel like ordinary student code.
 */
object BluePlayLibrary {
    const val id = "blueplay"
    const val version = 1

    // Keep this source in the browser bundle instead of adding framework files
    // to a student's project.  It is analyzed together with the project, so
    // inheritance, overriding and generic calls use Kotlite's normal rules.
    val source: String = """
        class Image(private val seed: Any? = null, private val dimension: Int = 0) {
            private var drawingColor = "rgb(0,0,0)"
            private var drawingOperations = mutableListOf<String>()
            private var imageWidth: Int = if (seed is Int) (seed as Int) else if (seed is String) bluekImageWidth(seed as String) else 30
            private var imageHeight: Int = if (seed is Int) dimension else if (seed is String) bluekImageHeight(seed as String) else 30
            var path: String = if (seed is String) (seed as String) else ""
            var transparency = 255
                set(value) { field = if (value < 0) 0 else if (value > 255) 255 else value }
            val width: Int get() = imageWidth
            val height: Int get() = imageHeight

            init {
                if (seed is Image) {
                    val copy = seed as Image
                    path = copy.path; imageWidth = copy.width; imageHeight = copy.height
                    transparency = copy.transparency; drawingColor = copy.drawingColor
                    drawingOperations = copy.drawingOperations.map { it }.toMutableList()
                }
            }
            fun setTransparency(value: Int) { transparency = value }
            fun scale(newWidth: Int, newHeight: Int) { imageWidth = if (newWidth < 1) 1 else newWidth; imageHeight = if (newHeight < 1) 1 else newHeight }
            fun setColor(red: Int, green: Int, blue: Int) { drawingColor = "rgb(" + red + "," + green + "," + blue + ")" }
            fun fill() { drawingOperations = mutableListOf("fill|" + drawingColor) }
            fun fillRect(x: Int, y: Int, width: Int, height: Int) { drawingOperations.add("fillRect|" + x + "|" + y + "|" + width + "|" + height + "|" + drawingColor) }
            fun drawRect(x: Int, y: Int, width: Int, height: Int) { drawingOperations.add("drawRect|" + x + "|" + y + "|" + width + "|" + height + "|" + drawingColor) }
            fun fillOval(x: Int, y: Int, width: Int, height: Int) { drawingOperations.add("fillOval|" + x + "|" + y + "|" + width + "|" + height + "|" + drawingColor) }
            fun drawOval(x: Int, y: Int, width: Int, height: Int) { drawingOperations.add("drawOval|" + x + "|" + y + "|" + width + "|" + height + "|" + drawingColor) }
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
                var nested = "{\"operations\":" + image.drawingJson() + ",\"width\":" + image.width + ",\"height\":" + image.height + "}"
                var encoded = ""; var index = 0
                while (index < nested.length) {
                    val character = nested.substring(index, index + 1)
                    encoded += if (character == "\\") "\\\\" else if (character == "\"") "\\\"" else if (character == "|") "\\p" else if (character == "\n") "\\n" else character
                    index += 1
                }
                drawingOperations.add("drawImage|__bluek:" + encoded + "|" + x + "|" + y + "|" + image.width + "|" + image.height)
            }
            fun clear() { drawingOperations.clear(); path = "" }
            fun drawingJson(): String {
                var json = "["; var index = 0
                while (index < drawingOperations.size) {
                    if (index > 0) json += ","
                    val operation = drawingOperations[index]
                    var escaped = ""; var characterIndex = 0
                    while (characterIndex < operation.length) {
                        val character = operation.substring(characterIndex, characterIndex + 1)
                        escaped += if (character == "\\") "\\\\" else if (character == "\"") "\\\"" else if (character == "\n") "\\n" else character
                        characterIndex += 1
                    }
                    json += "\"" + escaped + "\""; index += 1
                }
                return json + "]"
            }
        }

        open class World(val width: Int, val height: Int, val cellSize: Int = 1) {
            // Keep the declaration order analyzable: Actor refers back to
            // World, so the bridge stores the instances opaquely here while
            // getObjects<T>() restores the public generic type for callers.
            private val actors = mutableListOf<Any>()
            private val textX = mutableListOf<Int>()
            private val textY = mutableListOf<Int>()
            private val textValues = mutableListOf<String>()
            var background: Image = Image(width * cellSize, height * cellSize).also { it.setColor(255, 255, 255); it.fill() }
                set(value) { field = value; bluekRenderWorld(this) }
            var backgroundPath = ""
            var backgroundColor = "rgb(255,255,255)"
            var running = false
            var speed = 50

            fun show() { bluekShowWorld(this); bluekRenderWorld(this) }
            open fun act() {}
            fun addObject(actor: Any, x: Int, y: Int) {
                if (actors.filter { it == actor }.size == 0) actors.add(actor)
                bluekWorldAddObject(this, actor, x, y)
                bluekRenderWorld(this)
            }
            fun removeObject(actor: Any) {
                actors.remove(actor)
                bluekWorldRemoveObject(this, actor)
                bluekRenderWorld(this)
            }
            fun allObjects(): List<Any> = actors.map { it }
            inline fun <reified T> getObjects(): List<T> = allObjects().filterIsInstance<T>()
            fun getObjectsAt(x: Int, y: Int): List<Any> = actors.filter { bluekObjectX(it) == x && bluekObjectY(it) == y }
            val numberOfObjects: Int get() = actors.size
            val isClicked: Boolean get() = bluekIsWorldClicked()
            fun setBackground(fileName: String) { backgroundPath = fileName; background = Image(fileName); background.scale(width * cellSize, height * cellSize); bluekRenderWorld(this) }
            fun setBackground(red: Int, green: Int, blue: Int) {
                backgroundPath = ""
                backgroundColor = "rgb(" + red + "," + green + "," + blue + ")"
                background = Image(width * cellSize, height * cellSize).also { it.setColor(red, green, blue); it.fill() }
                bluekRenderWorld(this)
            }
            fun showText(text: String, x: Int, y: Int) {
                var index = 0
                while (index < textValues.size) {
                    if (textX[index] == x && textY[index] == y) {
                        if (text.isEmpty()) {
                            textX.removeAt(index); textY.removeAt(index); textValues.removeAt(index)
                        } else textValues[index] = text
                        bluekRenderWorld(this); return
                    }
                    index += 1
                }
                if (!text.isEmpty()) { textX.add(x); textY.add(y); textValues.add(text) }
                bluekRenderWorld(this)
            }
            fun tick() { act(); bluekWorldTick(this) }
        }

        open class Actor {
            var worldWidth = 0
            var worldHeight = 0
            var worldCellSize = 1
            var x = 0
                set(value) { field = if (worldWidth > 0) if (value < 0) 0 else if (value >= worldWidth) worldWidth - 1 else value else value; bluekRenderActor(this) }
            var y = 0
                set(value) { field = if (worldHeight > 0) if (value < 0) 0 else if (value >= worldHeight) worldHeight - 1 else value else value; bluekRenderActor(this) }
            var rotation = 0
                set(value) { field = ((value % 360) + 360) % 360; bluekRenderActor(this) }
            var image: Image? = null
                set(value) { field = value; bluekRenderActor(this) }
            val world: World get() = bluekActorWorld(this) as World
            fun setImage(path: String) { image = Image(path) }
            fun setImage(newImage: Image) { image = newImage }
            fun getImage(): Image? = image
            open fun act() {}
            fun setLocation(newX: Int, newY: Int) {
                x = if (worldWidth > 0) if (newX < 0) 0 else if (newX >= worldWidth) worldWidth - 1 else newX else newX
                y = if (worldHeight > 0) if (newY < 0) 0 else if (newY >= worldHeight) worldHeight - 1 else newY else newY
                if (worldWidth > 0) bluekRenderWorld(bluekActorWorld(this) as World)
            }
            fun getX(): Int = x
            fun getY(): Int = y
            fun setRotation(degrees: Int) { rotation = ((degrees % 360) + 360) % 360 }
            fun getRotation(): Int = rotation
            fun move(distance: Int) { setLocation(x + bluekMoveDeltaX(rotation, distance), y + bluekMoveDeltaY(rotation, distance)) }
            fun turn(degrees: Int) { setRotation(rotation + degrees) }
            fun turnTowards(targetX: Int, targetY: Int) { rotation = bluekHeading(x, y, targetX, targetY) }
            fun distanceTo(other: Actor): Int = bluekDistance(x, y, other.x, other.y)
            fun intersects(other: Actor): Boolean = bluekIntersects(this, other)
            fun isTouching(other: Actor): Boolean = intersects(other)
            inline fun <reified T : Actor> getIntersecting(): List<T> = world.getObjects<Actor>().filter { it != this && it is T && intersects(it) }.filterIsInstance<T>()
            inline fun <reified T : Actor> getOneIntersecting(): T? = getIntersecting<T>().firstOrNull()
            inline fun <reified T : Actor> isTouching(): Boolean = getIntersecting<T>().size > 0
            inline fun <reified T : Actor> removeTouching() { getOneIntersecting<T>()?.let { world.removeObject(it as Any) } }
            val isAtEdge: Boolean get() = worldWidth > 0 && worldHeight > 0 && (x <= 0 || y <= 0 || x >= worldWidth - 1 || y >= worldHeight - 1)
            val isClicked: Boolean get() = bluekIsActorClicked(this, x, y)
        }

        var currentWorld: World?
        fun activeWorld(): World = currentWorld as World
        fun showWorld(world: World) { currentWorld = world; world.show() }
        fun show() { showWorld(activeWorld()) }
        fun isKeyDown(key: String): Boolean = bluekIsKeyDown(key)
        fun start() { bluekSimulationStart(); activeWorld().running = true; bluekRenderWorld(activeWorld()) }
        fun stop() { bluekSimulationStop(); activeWorld().running = false; bluekRenderWorld(activeWorld()) }
        fun step() { activeWorld().tick(); bluekRenderWorld(activeWorld()) }
        fun getSpeed(): Int = bluekGetSpeed()
        fun setSpeed(value: Int) { bluekSetSpeed(value); if (currentWorld != null) bluekRenderWorld(activeWorld()) }
        fun playSound(fileName: String) { bluekPlaySound(fileName) }
    """.trimIndent()
}
