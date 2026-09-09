export const bluePlayHeadlessSource = `
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO

private val actorWorlds = java.util.WeakHashMap<Actor, World>()
private val worldTexts = java.util.WeakHashMap<World, MutableMap<Pair<Int, Int>, String>>()
private val imageCache = java.util.concurrent.ConcurrentHashMap<String, BufferedImage>()
private var currentWorld: World? = null
private var running = false
internal val simLock = Any()

fun isKeyDown(key: String): Boolean = false
fun playSound(fileName: String) { }
fun getSpeed(): Int = 50
fun setSpeed(value: Int) { }
fun start() { running = true; while (running) { stepWorld(); Thread.sleep(20) } }
fun stop() { running = false }
fun step() { stepWorld() }

internal fun worldOf(actor: Actor): World? = synchronized(simLock) { actorWorlds[actor] }
internal fun setWorldOf(actor: Actor, world: World?) = synchronized(simLock) { if (world == null) actorWorlds.remove(actor) else actorWorlds[actor] = world }
internal fun setTextOf(world: World, x: Int, y: Int, text: String) { synchronized(simLock) { val values = worldTexts.getOrPut(world) { linkedMapOf() }; if (text.isEmpty()) values.remove(Pair(x, y)) else values[Pair(x, y)] = text } }
internal fun textsOf(world: World): List<Triple<Int, Int, String>> = synchronized(simLock) { worldTexts[world]?.map { Triple(it.key.first, it.key.second, it.value) } ?: emptyList() }
internal fun repaintWorld() { }
internal fun showWorld(world: World) { currentWorld = world }
internal fun isActorClicked(actor: Actor): Boolean = false
internal fun isWorldClicked(): Boolean = false
internal fun imageOrPlaceholder(actor: Actor): Image = actor.image ?: Image(1, 1)
internal fun cachedImage(fileName: String): BufferedImage = imageCache.getOrPut(fileName) { listOf(File(fileName), File("images", fileName)).firstNotNullOfOrNull { file -> if (file.exists()) ImageIO.read(file) else null } ?: BufferedImage(30, 30, BufferedImage.TYPE_INT_ARGB) }

private fun stepWorld() { currentWorld?.let { world -> world.act(); world.allObjects().forEach { if (worldOf(it) === world) it.act() } } }
`;
