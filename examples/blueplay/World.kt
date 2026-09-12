open class World(val width: Int, val height: Int, val cellSize: Int = 1) {
    private val actors = mutableListOf<Actor>()
    var backgroundColor = "rgb(255,255,255)"
    var background = Image("")
    var running = false
    var speed = 50
    fun actorType(actor: Actor): String = "Actor"
    fun render() {
        var objects = "["
        var first = true
        for (current in actors) {
            if (!first) objects += ","
            first = false
            val imagePath = current.image.path
            objects += "{\"type\":\"${actorType(current)}\",\"x\":${current.x},\"y\":${current.y},\"rotation\":${current.rotation},\"imagePath\":\"$imagePath\"}"
        }
        objects += "]"
        val backgroundPath = background.path
        bluekStageUpdate("{\"stage\":{\"width\":$width,\"height\":$height,\"cellSize\":$cellSize,\"backgroundColor\":\"$backgroundColor\",\"backgroundPath\":\"$backgroundPath\",\"speed\":$speed,\"running\":$running,\"objects\":$objects}}")
    }
    fun show() { render() }
    open fun act() {}
    fun tick() { act(); for (current in actors) current.act() }
    fun addObject(actor: Actor, x: Int, y: Int) {
        if (actors.count { it == actor } == 0) {
            actors.add(actor)
        }
        actor.x = x
        actor.y = y
    }
    fun removeObject(actor: Actor) {
        if (actors.count { it == actor } > 0) {
            actors.remove(actor)
        }
    }
    fun allObjects(): List<Actor> = actors
    val numberOfObjects: Int get() = actors.size
    val isClicked: Boolean get() = bluekIsWorldClicked()
}
