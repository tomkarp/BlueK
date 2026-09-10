open class World(val width: Int, val height: Int, val cellSize: Int) {
    private val actors = mutableListOf<Actor>()
    private val texts = linkedMapOf<Pair<Int, Int>, String>()
    var background: Image = Image(width * cellSize, height * cellSize)
    fun show() { showWorld(this) }
    open fun act() {}
    fun addObject(actor: Actor, x: Int, y: Int) { if (actor !in actors) actors.add(actor); actor.attach(this); actor.x = x; actor.y = y }
    fun removeObject(actor: Actor) { if (actors.remove(actor)) actor.detach() }
    fun allObjects(): List<Actor> = actors.toList()
    inline fun <reified T : Actor> getObjects(): List<T> = allObjects().filterIsInstance<T>()
    fun getObjectsAt(x: Int, y: Int): List<Actor> = allObjects().filter { it.x == x && it.y == y }
    val numberOfObjects: Int get() = actors.size
    fun setBackground(fileName: String) { background = Image(fileName); background.scale(width * cellSize, height * cellSize) }
    fun setBackground(r: Int, g: Int, b: Int) { background = Image(width * cellSize, height * cellSize).apply { setColor(r, g, b); fill() } }
    val isClicked: Boolean get() = isWorldClicked()
    fun showText(text: String, x: Int, y: Int) { if (text.isEmpty()) texts.remove(Pair(x, y)) else texts[Pair(x, y)] = text }
    internal fun textEntries(): List<Triple<Int, Int, String>> = texts.map { Triple(it.key.first, it.key.second, it.value) }
}
