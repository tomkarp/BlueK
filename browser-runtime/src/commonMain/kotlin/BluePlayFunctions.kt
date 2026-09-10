import kotlin.js.JsExport

private var currentWorld: World? = null
private var running = false
private var speedValue = 50
private val keysDown = mutableSetOf<String>()
private var clickX = -1
private var clickY = -1
private var clickPending = false
private val pendingSounds = mutableListOf<String>()

fun isKeyDown(key: String): Boolean = key.lowercase() in keysDown
fun playSound(fileName: String) { pendingSounds.add(fileName) }
@OptIn(kotlin.js.ExperimentalJsExport::class) @JsExport
fun getSpeed(): Int = speedValue
@OptIn(kotlin.js.ExperimentalJsExport::class) @JsExport
fun setSpeed(value: Int) { speedValue = value.coerceIn(1, 100) }
@OptIn(kotlin.js.ExperimentalJsExport::class) @JsExport
fun start() { running = true }
@OptIn(kotlin.js.ExperimentalJsExport::class) @JsExport
fun stop() { running = false }
@OptIn(kotlin.js.ExperimentalJsExport::class) @JsExport
fun step() { if (!running) oneStep() }
fun showWorld(world: World) { currentWorld = world }
fun repaintWorld() {}
fun isWorldClicked(): Boolean = consumeClick { actorAt(it.first, it.second) == null }
fun isActorClicked(actor: Actor): Boolean = consumeClick { actorAt(it.first, it.second) === actor }

@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekKey(key: String, pressed: Boolean) { if (pressed) keysDown.add(key.lowercase()) else keysDown.remove(key.lowercase()) }
@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekClick(x: Int, y: Int) { clickX = x; clickY = y; clickPending = true }
internal fun currentWorldState(): World? = currentWorld
internal fun runningState(): Boolean = running
internal fun oneStep() { currentWorld?.let { world -> world.act(); world.allObjects().toList().forEach { it.act() } } }
@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekStep() { if (running) oneStep() }
@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekPause() { running = false }
@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekSetSpeed(value: Int) { setSpeed(value) }
@OptIn(kotlin.js.ExperimentalJsExport::class)
@JsExport
fun bluekAct() { if (!running) oneStep() }

private fun consumeClick(predicate: (Pair<Int, Int>) -> Boolean): Boolean {
    if (!clickPending || !predicate(Pair(clickX, clickY))) return false
    clickPending = false
    return true
}

private fun actorAt(x: Int, y: Int): Actor? = currentWorld?.allObjects()?.asReversed()?.firstOrNull { actor ->
    val image = actor.image
    val left = actor.x * (currentWorld?.cellSize ?: 1) + (currentWorld?.cellSize ?: 1) / 2 - (image?.width ?: 30) / 2
    val top = actor.y * (currentWorld?.cellSize ?: 1) + (currentWorld?.cellSize ?: 1) / 2 - (image?.height ?: 30) / 2
    x in left..(left + (image?.width ?: 30)) && y in top..(top + (image?.height ?: 30))
}

internal fun bluekStageJson(): String {
    val world = currentWorld ?: return "null"
    val actors = world.allObjects().joinToString(",") { actor ->
        val image = actor.image
        val imagePath = image?.fileName?.let { ",\"imagePath\":\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" } ?: ""
        "{\"type\":\"Actor\",\"x\":${actor.x},\"y\":${actor.y},\"rotation\":${actor.rotation},\"imageWidth\":${image?.width ?: 30},\"imageHeight\":${image?.height ?: 30}$imagePath}"
    }
    val texts = world.textEntries().joinToString(",") { "{\"x\":${it.first},\"y\":${it.second},\"text\":\"${it.third.replace("\\", "\\\\").replace("\"", "\\\"")}\"}" }
    val background = world.background
    val backgroundPath = background.fileName?.let { ",\"backgroundPath\":\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" } ?: ""
    val backgroundColor = background.backgroundColor?.let { ",\"backgroundColor\":\"$it\"" } ?: ""
    val sounds = pendingSounds.joinToString(",") { "\"${it.replace("\\", "\\\\").replace("\"", "\\\"")}\"" }
    pendingSounds.clear()
    return "{\"width\":${world.width},\"height\":${world.height},\"cellSize\":${world.cellSize},\"running\":$running,\"speed\":$speedValue$backgroundPath$backgroundColor,\"objects\":[$actors],\"texts\":[$texts],\"sounds\":[$sounds]}"
}
