import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

open class Actor {
    private var owner: World? = null
    val world: World get() = owner ?: error("The actor is not in a world.")
    var image: Image? = null
    var x: Int = 0
        set(value) { field = owner?.let { value.coerceIn(0, it.width - 1) } ?: value }
    var y: Int = 0
        set(value) { field = owner?.let { value.coerceIn(0, it.height - 1) } ?: value }
    var rotation: Int = 0
        set(value) { field = ((value % 360) + 360) % 360 }
    open fun act() {}
    fun move(distance: Int) { val radians = rotation * PI / 180.0; x += (cos(radians) * distance).roundToInt(); y += (sin(radians) * distance).roundToInt() }
    fun turn(degrees: Int) { rotation += degrees }
    fun turnTowards(x: Int, y: Int) { if (x != this.x || y != this.y) rotation = (atan2((y - this.y).toDouble(), (x - this.x).toDouble()) * 180.0 / PI).roundToInt() }
    fun distanceTo(other: Actor): Int { val dx = (other.x - x).toDouble(); val dy = (other.y - y).toDouble(); return sqrt(dx * dx + dy * dy).roundToInt() }
    val isAtEdge: Boolean get() = x <= 0 || y <= 0 || x >= world.width - 1 || y >= world.height - 1
    val isClicked: Boolean get() = isActorClicked(this)
    fun intersects(other: Actor): Boolean { val a = image ?: Image(30, 30); val b = other.image ?: Image(30, 30); val cs = world.cellSize; val ax = x * cs + cs / 2; val ay = y * cs + cs / 2; val bx = other.x * cs + cs / 2; val by = other.y * cs + cs / 2; return kotlin.math.abs(ax - bx) * 2 < a.width + b.width && kotlin.math.abs(ay - by) * 2 < a.height + b.height }
    internal fun attach(world: World) { owner = world }
    internal fun detach() { owner = null }
    inline fun <reified T : Actor> getIntersecting(): List<T> = world.allObjects().filter { it !== this && it is T && intersects(it) }.map { it as T }
    inline fun <reified T : Actor> getOneIntersecting(): T? = getIntersecting<T>().firstOrNull()
    inline fun <reified T : Actor> isTouching(): Boolean = getIntersecting<T>().isNotEmpty()
    inline fun <reified T : Actor> removeTouching() { getOneIntersecting<T>()?.let(world::removeObject) }
}
