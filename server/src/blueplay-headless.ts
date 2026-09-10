export const bluePlayHeadlessSource = `
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

private val actorWorlds = java.util.WeakHashMap<Actor, World>()
private val worldTexts = java.util.WeakHashMap<World, MutableMap<Pair<Int, Int>, String>>()
private val imageCache = java.util.concurrent.ConcurrentHashMap<String, BufferedImage>()
private var currentWorld: World? = null
@Volatile private var running = false
@Volatile private var speedValue = 50
@Volatile private var loopThread: Thread? = null
internal val simLock = Any()
private val keysDown = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
private val pendingSounds = java.util.concurrent.ConcurrentLinkedQueue<String>()
private val pendingErrors = java.util.concurrent.ConcurrentLinkedQueue<String>()
@Volatile private var clickPending = false
@Volatile private var clickX = -1
@Volatile private var clickY = -1

fun isKeyDown(key: String): Boolean = keysDown.contains(key.lowercase())
fun playSound(fileName: String) { pendingSounds.add(fileName) }
fun getSpeed(): Int = speedValue
fun setSpeed(value: Int) { speedValue = value.coerceIn(1, 1000) }
fun start() {
    if (running) return
    running = true
    loopThread = Thread {
        while (running) {
            stepWorld()
            try { Thread.sleep((1000L / speedValue).coerceAtLeast(1L)) } catch (_: InterruptedException) { }
        }
    }.also { it.isDaemon = true; it.name = "bluek-blueplay"; it.start() }
}
fun stop() { running = false; loopThread?.interrupt(); loopThread = null }
fun step() { if (!running) stepWorld() }

internal fun worldOf(actor: Actor): World? = synchronized(simLock) { actorWorlds[actor] }
internal fun setWorldOf(actor: Actor, world: World?) = synchronized(simLock) { if (world == null) actorWorlds.remove(actor) else actorWorlds[actor] = world }
internal fun setTextOf(world: World, x: Int, y: Int, text: String) { synchronized(simLock) { val values = worldTexts.getOrPut(world) { linkedMapOf() }; if (text.isEmpty()) values.remove(Pair(x, y)) else values[Pair(x, y)] = text } }
internal fun textsOf(world: World): List<Triple<Int, Int, String>> = synchronized(simLock) { worldTexts[world]?.map { Triple(it.key.first, it.key.second, it.value) } ?: emptyList() }
fun soundsOf(): List<String> = buildList { while (true) { val sound = pendingSounds.poll() ?: break; add(sound) } }
fun errorsOf(): List<String> = buildList { while (true) { val error = pendingErrors.poll() ?: break; add(error) } }
internal fun repaintWorld() { }
internal fun showWorld(world: World) { stop(); currentWorld = world }
private fun actorAt(cellX: Int, cellY: Int): Actor? {
    val world = currentWorld ?: return null
    val px = cellX * world.cellSize + world.cellSize / 2
    val py = cellY * world.cellSize + world.cellSize / 2
    return world.allObjects().asReversed().firstOrNull { actor ->
        val image = imageOrPlaceholder(actor)
        val left = actor.x * world.cellSize + world.cellSize / 2 - image.width / 2
        val top = actor.y * world.cellSize + world.cellSize / 2 - image.height / 2
        px in left until (left + image.width) && py in top until (top + image.height)
    }
}
internal fun isActorClicked(actor: Actor): Boolean { if (!clickPending || actorAt(clickX, clickY) !== actor) return false; clickPending = false; return true }
internal fun isWorldClicked(): Boolean { if (!clickPending || actorAt(clickX, clickY) != null) return false; clickPending = false; return true }
internal fun imageOrPlaceholder(actor: Actor): Image = actor.image ?: Image(30, 30)
internal fun cachedImage(fileName: String): BufferedImage = imageCache.getOrPut(fileName) { listOf(File(fileName), File("images", fileName)).firstNotNullOfOrNull { file -> if (file.exists()) ImageIO.read(file) else null } ?: BufferedImage(30, 30, BufferedImage.TYPE_INT_ARGB) }
internal fun setKeyState(key: String, pressed: Boolean) { if (pressed) keysDown.add(key.lowercase()) else keysDown.remove(key.lowercase()) }
internal fun setClickPosition(x: Int, y: Int) { clickX = x; clickY = y; clickPending = true }

private fun stepWorld() {
    try { currentWorld?.let { world -> world.act(); world.allObjects().forEach { if (worldOf(it) === world) it.act() } } }
    catch (error: Throwable) { running = false; pendingErrors.add(error.cause?.message ?: error.message ?: "BluePlay simulation error") }
}
`;
