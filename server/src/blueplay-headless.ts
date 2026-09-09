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
private val keysDown = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
private val pendingSounds = java.util.concurrent.ConcurrentLinkedQueue<String>()
@Volatile private var clickPending = false
@Volatile private var clickX = -1
@Volatile private var clickY = -1

fun isKeyDown(key: String): Boolean = keysDown.contains(key.lowercase())
fun playSound(fileName: String) { pendingSounds.add(fileName) }
fun getSpeed(): Int = 50
fun setSpeed(value: Int) { }
fun start() { running = true; while (running) { stepWorld(); Thread.sleep(20) } }
fun stop() { running = false }
fun step() { stepWorld() }

internal fun worldOf(actor: Actor): World? = synchronized(simLock) { actorWorlds[actor] }
internal fun setWorldOf(actor: Actor, world: World?) = synchronized(simLock) { if (world == null) actorWorlds.remove(actor) else actorWorlds[actor] = world }
internal fun setTextOf(world: World, x: Int, y: Int, text: String) { synchronized(simLock) { val values = worldTexts.getOrPut(world) { linkedMapOf() }; if (text.isEmpty()) values.remove(Pair(x, y)) else values[Pair(x, y)] = text } }
internal fun textsOf(world: World): List<Triple<Int, Int, String>> = synchronized(simLock) { worldTexts[world]?.map { Triple(it.key.first, it.key.second, it.value) } ?: emptyList() }
fun soundsOf(): List<String> = buildList { while (true) { val sound = pendingSounds.poll() ?: break; add(sound) } }
internal fun repaintWorld() { }
internal fun showWorld(world: World) { currentWorld = world }
internal fun isActorClicked(actor: Actor): Boolean { if (clickPending && currentWorld?.allObjects()?.firstOrNull { it.x == clickX && it.y == clickY } === actor) { clickPending = false; return true }; return false }
internal fun isWorldClicked(): Boolean { if (!clickPending) return false; val hit = currentWorld?.allObjects()?.any { it.x == clickX && it.y == clickY } == true; if (!hit) { clickPending = false; return true }; return false }
internal fun imageOrPlaceholder(actor: Actor): Image = actor.image ?: Image(1, 1)
internal fun cachedImage(fileName: String): BufferedImage = imageCache.getOrPut(fileName) { listOf(File(fileName), File("images", fileName)).firstNotNullOfOrNull { file -> if (file.exists()) ImageIO.read(file) else null } ?: BufferedImage(30, 30, BufferedImage.TYPE_INT_ARGB) }
internal fun setKeyState(key: String, pressed: Boolean) { if (pressed) keysDown.add(key.lowercase()) else keysDown.remove(key.lowercase()) }
internal fun setClickPosition(x: Int, y: Int) { clickX = x; clickY = y; clickPending = true }

private fun stepWorld() { currentWorld?.let { world -> world.act(); world.allObjects().forEach { if (worldOf(it) === world) it.act() } } }
`;
