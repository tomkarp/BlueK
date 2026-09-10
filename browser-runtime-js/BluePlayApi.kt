/** Compiler-only declarations for the fixed BlueK browser runtime. */
external open class Actor {
    open fun act()
    var x: Int
    var y: Int
    var rotation: Int
    var image: Image?
    val world: World
    val isAtEdge: Boolean
    val isClicked: Boolean
    fun move(distance: Int)
    fun turn(degrees: Int)
    fun turnTowards(x: Int, y: Int)
    fun distanceTo(other: Actor): Int
    fun intersects(other: Actor): Boolean
}

external open class World(val width: Int, val height: Int, val cellSize: Int) {
    open fun act()
    var background: Image
    fun show()
    fun addObject(actor: Actor, x: Int, y: Int)
    fun removeObject(actor: Actor)
    fun allObjects(): Array<Actor>
    fun getObjectsAt(x: Int, y: Int): Array<Actor>
    val numberOfObjects: Int
    fun setBackground(fileName: String)
    fun setBackground(r: Int, g: Int, b: Int)
    val isClicked: Boolean
    fun showText(text: String, x: Int, y: Int)
}

external class Image {
    constructor(width: Int, height: Int)
    constructor(fileName: String)
    constructor(other: Image)
    val width: Int
    val height: Int
    var transparency: Int
    fun setTransparency(value: Int)
    fun scale(width: Int, height: Int)
    fun setColor(r: Int, g: Int, b: Int)
    fun fill()
    fun fillRect(x: Int, y: Int, width: Int, height: Int)
    fun drawRect(x: Int, y: Int, width: Int, height: Int)
    fun fillOval(x: Int, y: Int, width: Int, height: Int)
    fun drawOval(x: Int, y: Int, width: Int, height: Int)
    fun drawLine(x1: Int, y1: Int, x2: Int, y2: Int)
    fun drawString(text: String, x: Int, y: Int)
    fun drawImage(image: Image, x: Int, y: Int)
    fun clear()
}

external fun isKeyDown(key: String): Boolean
external fun playSound(fileName: String)
external fun getSpeed(): Int
external fun setSpeed(value: Int)
external fun start()
external fun stop()
external fun step()
external fun bluekStageJson(): String
external fun bluekReadln(): String
external fun bluekReadlnOrNull(): String?

external fun bluekActorGetIntersecting(actor: Actor): Array<Actor>
external fun bluekActorGetOneIntersecting(actor: Actor): Actor?
external fun bluekActorIsTouching(actor: Actor): Boolean
external fun bluekActorRemoveTouching(actor: Actor)
external fun bluekWorldAllObjects(world: World): Array<Actor>

inline fun <reified T : Actor> Actor.getIntersecting(): List<T> = bluekActorGetIntersecting(this).filterIsInstance<T>()
inline fun <reified T : Actor> Actor.getOneIntersecting(): T? = bluekActorGetOneIntersecting(this) as? T
inline fun <reified T : Actor> Actor.isTouching(): Boolean = bluekActorIsTouching(this)
inline fun <reified T : Actor> Actor.removeTouching() = bluekActorRemoveTouching(this)
inline fun <reified T : Actor> World.getObjects(): List<T> = bluekWorldAllObjects(this).filterIsInstance<T>()
