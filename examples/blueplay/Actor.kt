open class Actor {
    var x = 0
    var y = 0
    var rotation = 0
    var image = Image("")
    var worldWidth = 0
    var worldHeight = 0
    fun setImage(path: String) { image = Image(path) }
    open fun act() {}
    fun move(distance: Int) { x += distance }
    fun turn(degrees: Int) { rotation += degrees }
    val isAtEdge: Boolean get() = worldWidth > 0 && worldHeight > 0 && (x <= 0 || y <= 0 || x >= worldWidth - 1 || y >= worldHeight - 1)
    val isClicked: Boolean get() = bluekIsActorClicked(x, y)
}
