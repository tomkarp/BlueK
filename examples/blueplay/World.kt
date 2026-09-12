open class World(val width: Int, val height: Int, val cellSize: Int = 1) {
    var actor: Actor? = null
    var backgroundColor = "rgb(255,255,255)"
    var running = false
    var speed = 50
    fun actorType(actor: Actor): String = "Actor"
    fun render() {
        var objects = "[]"
        actor?.let { current -> objects = "[{\"type\":\"${actorType(current)}\",\"x\":${current.x},\"y\":${current.y},\"rotation\":${current.rotation}}]" }
        bluekStageUpdate("{\"stage\":{\"width\":$width,\"height\":$height,\"cellSize\":$cellSize,\"backgroundColor\":\"$backgroundColor\",\"speed\":$speed,\"running\":$running,\"objects\":$objects}}")
    }
    fun show() { render() }
    open fun act() {}
    fun tick() { act(); actor?.act() }
    fun addObject(actor: Actor, x: Int, y: Int) {
        this.actor = actor
        actor.x = x
        actor.y = y
    }
    fun removeObject(actor: Actor) { if (this.actor == actor) this.actor = null }
    val numberOfObjects: Int get() = if (actor == null) 0 else 1
    val isClicked: Boolean get() = bluekIsWorldClicked()
}
